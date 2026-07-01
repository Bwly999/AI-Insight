#!/usr/bin/env node
/**
 * aiinsight CLI 入口 — 路由到 search / extract / config 命令。
 *
 * 独立跑时读 ~/.aiinsight/config.json 构造 EngineConfig（选项 α）。
 * 加载优先级：flag > JSON > env(兼容) > default。
 *
 * 接入系统（模型 B）：server 不走此入口，进程内直接用 datasources 注册表。
 */
import { configureProxy } from "@ai-insight/datasources";
import { readConfig, toEngineConfig } from "./config-store.js";
import { searchCommand } from "./commands/search.js";
import { extractCommand } from "./commands/extract.js";
import { configCommand } from "./commands/config.js";

async function main(): Promise<number> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help" || argv[0] === "help") {
    printRootHelp();
    return 0;
  }

  const cmd = argv[0];
  const rest = argv.slice(1);

  switch (cmd) {
    case "search":
    case "extract": {
      // 读 JSON config（选项 α）→ 注入 EngineConfig；配置代理
      const cliCfg = readConfig();
      const engineCfg = toEngineConfig(cliCfg);
      if (engineCfg.proxyUrl) configureProxy(engineCfg.proxyUrl);

      if (cmd === "search") {
        return await searchCommand(rest, engineCfg);
      }
      return await extractCommand(rest, engineCfg);
    }
    case "config":
      return configCommand(rest);
    case "-v":
    case "--version":
      console.log("aiinsight 0.1.0");
      return 0;
    default:
      console.error(`error: 未知命令 "${cmd}"。可用: search / extract / config`);
      console.error("运行 `aiinsight --help` 查看帮助。");
      return 1;
  }
}

function printRootHelp(): void {
  console.log(`aiinsight — 通用数据源能力 CLI（搜索 + 正文提取）

用法:
  aiinsight <command> [options]

命令:
  search    聚合搜索（多引擎扇出 + 去重）
  extract   正文提取（jina / firecrawl / local）
  config    读写本地配置（API key / 自托管 URL / 代理）

快速开始:
  aiinsight config set engines.exa.apiKey sk-xxx
  aiinsight search "AI Agent" --engines ddg,exa --time 1w
  aiinsight extract https://example.com/article

运行 \`aiinsight <command> --help\` 查看命令详情。`);
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error(`error: ${(e as Error).message}`);
  process.exit(1);
});
