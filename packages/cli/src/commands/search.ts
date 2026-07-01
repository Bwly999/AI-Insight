/**
 * search 命令 — 单命令 + --engines 多选，扇出聚合（对齐 fanoutSearch）。
 *
 * 见 docs/design §5.1。
 *
 * 用法：
 *   aiinsight search "AI Agent" --engines ddg,exa --time 1w --limit 8
 *   aiinsight search "LLM" --engines arxiv --arxiv.categories cs.AI,cs.CL
 */
import { parseArgs } from "node:util";
import type { TSchema } from "@sinclair/typebox";
import {
  createSearchEngines,
  fanoutSearch,
  listSearchEngineIds,
  type EngineConfig,
  type SearchEngine,
} from "@ai-insight/datasources";
import { parseEngineFlags, describeParams } from "../engine-flags.js";
import { parseListArg } from "../args.js";

export async function searchCommand(argv: string[], cfg: EngineConfig): Promise<number> {
  // 引擎 id 列表（用于命名空间校验 & 帮助）
  const allEngineIds = listSearchEngineIds();

  // 构造全部引擎实例（轻量，不触发网络）以获取各引擎 paramsSchema，
  // 供 parseEngineFlags 判断哪些参数是数组型（需逗号/空格拆分）。
  const allEngines = createSearchEngines(cfg);
  const schemaByEngine: Record<string, TSchema | undefined> = {};
  for (const e of allEngines) schemaByEngine[e.name] = e.paramsSchema;

  // 先剥离命名空间 flag，剩下的给 parseArgs
  const { engineParams, rest, errors: nsErrors } = parseEngineFlags(argv, new Set(allEngineIds), schemaByEngine);
  if (nsErrors.length) {
    for (const e of nsErrors) console.error(`error: ${e}`);
    return 1;
  }

  const { values, positionals } = parseArgs({
    args: rest,
    options: {
      engines: { type: "string", short: "e", default: "" },
      time: { type: "string", short: "t", default: "" },
      limit: { type: "string", short: "l", default: "8" },
      tags: { type: "string", default: "" },
      format: { type: "string", short: "f", default: "json" },
      help: { type: "boolean", short: "h", default: false },
      "list-engines": { type: "boolean", default: false },
    },
    allowNegative: true,
    strict: false,
  });

  if (values.help) {
    printHelp(allEngineIds);
    return 0;
  }

  if (values["list-engines"]) {
    for (const e of allEngines) {
      const params = describeParams((e as SearchEngine).paramsSchema);
      const paramStr = params.length ? `  params: ${params.map((p) => `--${e.name}.${p.name}`).join(", ")}` : "";
      const cfgFlag = e.isConfigured() ? "" : "  (未配置)";
      console.log(`${e.name}\t${e.label}${cfgFlag}${paramStr}`);
    }
    return 0;
  }

  const query = positionals[0];
  if (!query) {
    console.error("error: 缺少查询词。用法: aiinsight search \"<query>\"");
    return 1;
  }

  // 解析 --engines（逗号或空格分隔；空 = 全部已配置）
  const enginesArg = (values.engines as string) ?? "";
  const selected = enginesArg ? parseListArg(enginesArg) : undefined; // undefined = 全部已配置

  // 校验选中的引擎 id 合法
  if (selected) {
    const unknown = selected.filter((id) => !allEngineIds.includes(id));
    if (unknown.length) {
      console.error(`error: 未知引擎: ${unknown.join(", ")}（已知: ${allEngineIds.join(", ")}）`);
      return 1;
    }
  }

  // 筛选选中的 + 已配置的（复用已构造的 allEngines）
  const engines = allEngines.filter(
    (e) => e.isConfigured() && (!selected || selected.includes(e.name)),
  );

  if (engines.length === 0) {
    console.error("error: 没有已配置的引擎可用。用 `aiinsight config set` 配置 key，或检查 --engines。");
    return 1;
  }

  const timeRange = (values.time as string) || undefined;
  const tagsStr = (values.tags as string) ?? "";
  const tags = tagsStr ? parseListArg(tagsStr) : undefined;

  const result = await fanoutSearch(
    {
      query,
      timeRange: timeRange as never,
      tags: tags as never,
      perEngineLimit: parseInt(values.limit as string, 10) || 8,
      engines: selected,
      params: engineParams,
    },
    engines,
  );

  const format = (values.format as string) ?? "json";
  if (format === "table") {
    printTable(result.items, result.perEngine);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
  return 0;
}

function printTable(
  items: { title: string; url: string; sourceName: string; publishedAt?: string }[],
  perEngine: Record<string, number>,
): void {
  console.error(`命中: ${items.length} 条  各引擎: ${JSON.stringify(perEngine)}\n`);
  if (items.length === 0) {
    console.log("(无结果)");
    return;
  }
  items.slice(0, 30).forEach((it, i) => {
    const date = it.publishedAt ? ` (${it.publishedAt.slice(0, 10)})` : "";
    console.log(`${i + 1}. [${it.sourceName}] ${it.title}${date}`);
    console.log(`   ${it.url}`);
  });
  if (items.length > 30) console.log(`   ... 还有 ${items.length - 30} 条（--format json 查看全部）`);
}

function printHelp(allEngineIds: string[]): void {
  console.log(`aiinsight search — 聚合搜索

用法:
  aiinsight search "<query>" [--engines <id,id>] [--time <range>] [--limit <n>]
                              [--engine.param value ...] [--format json|table]

选项:
  -e, --engines <id,id>   引擎 id（逗号分隔）；默认全部已配置。已知: ${allEngineIds.join(", ")}
  -t, --time <range>      时间窗: 1d 3d 1w 1m 6m 1y all
  -l, --limit <n>         每引擎取多少条（默认 8）
      --tags <t,t>        标签过滤
  -f, --format <f>        输出: json(默认) / table
      --list-engines      列出引擎 + 特有参数
  -h, --help              帮助

引擎命名空间 flag（约定 b）:
  仅当引擎在 --engines 中才合法。逗号分隔值自动转数组。
  示例: --arxiv.categories cs.AI,cs.CL   --exa.type neural
  用 \`search --list-engines\` 查看各引擎参数。`);
}
