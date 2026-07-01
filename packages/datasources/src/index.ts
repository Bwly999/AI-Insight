/**
 * @ai-insight/datasources — 数据源统一出口（搜索 / RSS / 爬虫 / 正文提取）。
 *
 * 仅 server 依赖。所有出站经 packages/datasources/src/http.ts（undici，全局代理）。
 */
// http & 代理
export {
  configureProxy,
  rawFetch,
  fetchJson,
  fetchText,
  postJson,
  DEFAULT_UA,
  HttpError,
} from "./http.js";

// 归一化 / 去重 / 时间范围
export { normalizeUrl, normalizeTitle, dedupeItems } from "./normalize.js";
export {
  timeRangeToMs,
  timeRangeToStartDate,
  timeRangeToDuckDf,
  filterByTimeRange,
} from "./time-range.js";

// 引擎配置（注入式，见 §4.1）
export { engineConfigFromEnv, type EngineConfig, EMPTY_ENGINE_CONFIG } from "./config.js";

// 引擎注册表（见 §4.3）
export {
  registerSearchEngine,
  registerExtractEngine,
  createSearchEngine,
  createExtractEngine,
  createSearchEngines,
  createExtractEngines,
  listSearchEngineIds,
  listExtractEngineIds,
  type SearchEngineFactory,
  type ExtractEngineFactory,
} from "./registry.js";

// 搜索
export {
  fanoutSearch,
  createDefaultEngines,
  type SearchEngine,
  type SearchInput,
  type FanoutOptions,
  exaParamsSchema,
  arxivParamsSchema,
} from "./search/index.js";

// 爬虫
export {
  fanoutCrawl,
  createDefaultCrawlers,
  type CrawlerAdapter,
} from "./crawler/index.js";

// RSS
export { fetchRss } from "./rss.js";

// 正文提取
export {
  extractContent,
  extractContentWith,
  buildExtractEngines,
  type ExtractEngine,
  type ExtractInput,
  type ExtractResult,
} from "./extract/index.js";
