/**
 * config 命令 — 读写 CLI 本地 JSON 配置（选项 α，明文 key）。
 *
 * 见 docs/design §5.1 / §6。
 *
 * 用法：
 *   aiinsight config set <dotted.key> <value>
 *   aiinsight config get <dotted.key>
 *   aiinsight config list
 *   aiinsight config path
 */
import { parseArgs } from "node:util";
import {
  readConfig,
  writeConfig,
  configPath,
  getConfigValue,
  setConfigValue,
} from "../config-store.js";

export function configCommand(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: "boolean", short: "h", default: false },
    },
    allowNegative: true,
    strict: false,
  });

  if (values.help) {
    printHelp();
    return 0;
  }

  const sub = positionals[0];

  switch (sub) {
    case "set": {
      const key = positionals[1];
      const value = positionals[2];
      if (!key || value === undefined) {
        console.error("error: 用法 config set <key> <value>");
        return 1;
      }
      const cfg = readConfig();
      const next = setConfigValue(cfg, key, value);
      writeConfig(next);
      console.log(`已设置 ${key}（写入 ${configPath()}）`);
      return 0;
    }
    case "get": {
      const key = positionals[1];
      if (!key) {
        console.error("error: 用法 config get <key>");
        return 1;
      }
      const cfg = readConfig();
      const v = getConfigValue(cfg, key);
      console.log(v === undefined ? "(未设置)" : typeof v === "string" ? v : JSON.stringify(v));
      return 0;
    }
    case "list": {
      const cfg = readConfig();
      console.log(JSON.stringify(cfg, null, 2));
      return 0;
    }
    case "path": {
      console.log(configPath());
      return 0;
    }
    default:
      console.error(`error: 未知子命令 "${sub}"。可用: set / get / list / path`);
      return 1;
  }
}

function printHelp(): void {
  console.log(`aiinsight config — 读写本地配置

用法:
  aiinsight config set <key> <value>   设置值（自动创建中间对象）
  aiinsight config get <key>           读取值
  aiinsight config list                列出全部配置
  aiinsight config path                显示配置文件路径

常用 key:
  engines.exa.apiKey <sk-xxx>          Exa 搜索 key
  engines.firecrawl.apiKey <sk-xxx>    Firecrawl key
  engines.jina.url <http://my-jina>    自托管 Jina URL
  engines.jina.apiKey <key>            Jina key（可选）
  proxy.url <http://host:port>         出站代理

文件: ~/.aiinsight/config.json（AIINSIGHT_CONFIG env 可覆盖）`);
}
