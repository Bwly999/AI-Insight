/**
 * extract 命令 — 单命令 + --engine 单选(或 all 走 fallback 链)。
 *
 * 见 docs/design §5.1。
 *
 * 用法：
 *   aiinsight extract <url> --engine jina
 *   aiinsight extract <url>                    # 默认 all: jina→firecrawl→local
 */
import { parseArgs } from "node:util";
import {
  buildExtractEngines,
  extractContentWith,
  listExtractEngineIds,
  type EngineConfig,
} from "@ai-insight/datasources";
import { parseEngineFlags } from "../engine-flags.js";

export async function extractCommand(argv: string[], cfg: EngineConfig): Promise<number> {
  const allEngineIds = listExtractEngineIds();
  const { rest, errors: nsErrors } = parseEngineFlags(argv, new Set(allEngineIds), {});
  if (nsErrors.length) {
    for (const e of nsErrors) console.error(`error: ${e}`);
    return 1;
  }

  const { values, positionals } = parseArgs({
    args: rest,
    options: {
      engine: { type: "string", default: "all" },
      format: { type: "string", short: "f", default: "json" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowNegative: true,
    strict: false,
  });

  if (values.help) {
    printHelp(allEngineIds);
    return 0;
  }

  const url = positionals[0];
  if (!url) {
    console.error("error: 缺少 URL。用法: aiinsight extract <url>");
    return 1;
  }

  const engineChoice = (values.engine as string) ?? "all";

  // 构造引擎链
  const allEngines = buildExtractEngines(cfg);
  let chain;
  if (engineChoice === "all") {
    // fallback 链：全部已配置引擎，注册顺序
    chain = allEngines.filter((e) => e.isConfigured());
  } else {
    if (!allEngineIds.includes(engineChoice)) {
      console.error(`error: 未知引擎: ${engineChoice}（已知: ${allEngineIds.join(", ")}）`);
      return 1;
    }
    const found = allEngines.find((e) => e.name === engineChoice);
    if (!found) {
      console.error(`error: 引擎未注册: ${engineChoice}`);
      return 1;
    }
    chain = [found];
  }

  if (chain.length === 0) {
    console.error("error: 没有已配置的提取引擎可用。");
    return 1;
  }

  const result = await extractContentWith(url, chain);

  const format = (values.format as string) ?? "json";
  if (format === "text") {
    if (result.title) console.log(`# ${result.title}\n`);
    console.log(result.content);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
  return 0;
}

function printHelp(allEngineIds: string[]): void {
  console.log(`aiinsight extract — 正文提取

用法:
  aiinsight extract <url> [--engine <id|all>] [--format json|text]

选项:
      --engine <id>   提取引擎: ${allEngineIds.join(", ")} 或 all(默认，fallback 链)
  -f, --format <f>    输出: json(默认) / text(纯 markdown)
  -h, --help          帮助

fallback 链 (engine=all): jina → firecrawl → local`);
}
