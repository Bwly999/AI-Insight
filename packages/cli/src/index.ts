/**
 * @ai-insight/cli — 通用数据源能力命令行（search / extract / config）。
 *
 * 见 docs/design/skills-融合-cli-通用数据源能力.md §5。
 *
 * 程序化使用入口（供测试与其他包 import 命令处理函数）。
 */
export { searchCommand } from "./commands/search.js";
export { extractCommand } from "./commands/extract.js";
export { configCommand } from "./commands/config.js";
export { parseEngineFlags, describeParams } from "./engine-flags.js";
export {
  readConfig,
  writeConfig,
  configPath,
  getConfigValue,
  setConfigValue,
  toEngineConfig,
  type CliConfig,
} from "./config-store.js";
