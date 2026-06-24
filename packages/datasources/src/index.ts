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

// 搜索
export {
  fanoutSearch,
  createDefaultEngines,
  type SearchEngine,
  type SearchInput,
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
export { extractContent, type ExtractResult } from "./extract.js";
