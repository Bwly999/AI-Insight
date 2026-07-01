/**
 * 搜索引擎统一接口 + DuckDuckGo 实现（基于 duck-duck-scrape 库）。
 *
 * 接口设计（改进自 union-search：原项目无统一接口，引擎各自散落）：
 *   search(input): Promise<DataSourceItem[]>
 * 归一化到 DataSourceItem（强制在引擎边界归一，而非合并时）。
 *
 * DuckDuckGo 用 duck-duck-scrape（基于 needle，非 undici）：
 *   - 绕开 undici ProxyAgent 在 Windows 上的 UV_HANDLE_CLOSING 原生崩溃
 *   - 用 DDG 内部 API 端点，返回结构化结果（非 HTML 抓取），更稳定
 *   - 代理通过 needleOptions.proxy 透传（needle 的 CONNECT 隧道）
 *
 * 引擎接受注入的 EngineConfig（不再直读 process.env），
 * 使 CLI（JSON 注入）与 server（DB/env 注入）共用同一份代码。
 */
import type { TSchema } from "@sinclair/typebox";
import { search as ddgSearch, SafeSearchType, SearchTimeType } from "duck-duck-scrape";
import type { NeedleOptions } from "needle";
import type { DataSourceItem, DataSourceTag, TimeRange } from "@ai-insight/shared-types";
import { timeRangeToDuckDf } from "../time-range.js";
import type { EngineConfig } from "../config.js";

/** 搜索引擎输入。 */
export interface SearchInput {
  query: string;
  timeRange?: TimeRange;
  tags?: DataSourceTag[];
  limit?: number;
  /** 引擎特有参数（由 CLI 从 --<engine>.<param> flag 解析注入；引擎自行解释）。 */
  params?: Record<string, unknown>;
}

/**
 * 搜索引擎统一接口。
 *
 * `paramsSchema`：引擎特有参数的 TypeBox schema。
 * CLI 据此自动生成 `--<name>.<param>` flag 并静态校验。
 * 无特有参数的引擎（如 ddg）留空。
 */
export interface SearchEngine {
  /** 引擎 id（用于 --engines 选项与注册表 key，如 "ddg"）。 */
  readonly name: string;
  /** 展示名（用于 sourceName 与帮助文本，如 "DuckDuckGo"）。 */
  readonly label: string;
  /** 是否已配置（缺 key 的引擎返回 false，扇出时跳过）。 */
  isConfigured(): boolean;
  /** 执行搜索，返回归一化 DataSourceItem[]。 */
  search(input: SearchInput): Promise<DataSourceItem[]>;
  /** 引擎特有参数 schema（CLI 据此生成命名空间 flag）。 */
  readonly paramsSchema?: TSchema;
}

// ─────────────────────────────────────────────────────────────────────────────
// DuckDuckGo — 基于 duck-duck-scrape（needle），绕开 undici Windows 崩溃
// ─────────────────────────────────────────────────────────────────────────────

/** TimeRange → duck-duck-scrape 的 SearchTimeType（d/w/m，all→a）。 */
function timeRangeToSearchTimeType(range: TimeRange): SearchTimeType {
  const df = timeRangeToDuckDf(range); // d/w/m/y
  switch (df) {
    case "d":
      return SearchTimeType.DAY;
    case "w":
      return SearchTimeType.WEEK;
    case "m":
      return SearchTimeType.MONTH;
    default:
      return SearchTimeType.ALL;
  }
}

export class DuckDuckGoEngine implements SearchEngine {
  readonly name = "ddg";
  readonly label = "DuckDuckGo";
  /** needle options：透传 proxy（绕开 undici，用 needle 的 CONNECT 隧道）。 */
  private needleOptions: NeedleOptions;

  constructor(cfg: EngineConfig = {}) {
    this.needleOptions = cfg.proxyUrl ? { proxy: cfg.proxyUrl } : {};
  }

  isConfigured(): boolean {
    return true; // 无 key
  }

  async search(input: SearchInput): Promise<DataSourceItem[]> {
    const limit = Math.min(input.limit ?? 10, 10);
    const time = input.timeRange ? timeRangeToSearchTimeType(input.timeRange) : undefined;

    const results = await ddgSearch(
      input.query,
      {
        safeSearch: SafeSearchType.MODERATE,
        ...(time ? { time } : {}),
      },
      this.needleOptions,
    );

    if (results.noResults || !results.results?.length) return [];

    const now = new Date().toISOString();
    return results.results.slice(0, limit).map<DataSourceItem>((r) => ({
      id: `search:duckduckgo:${r.url}`,
      sourceType: "search",
      sourceName: this.label,
      sourceId: r.url,
      title: r.title || r.url,
      url: r.url,
      // rawDescription 不含加粗标签的干扰（description 含 <b> 标签）
      summary: r.rawDescription || r.description || undefined,
      tags: input.tags ?? [],
      fetchedAt: now,
    }));
  }
}
