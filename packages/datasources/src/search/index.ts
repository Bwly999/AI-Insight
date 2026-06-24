/**
 * 搜索扇出聚合 — 并发调用启用的引擎 → 时间过滤 → 去重。
 *
 * Promise.allSettled：单引擎失败不影响其它（移植自 union-search 思路，
 * 但 union-search 用 subprocess + JSON 恢复，本实现直接 in-process）。
 */
import type { DataSourceItem, DataSourceTag, TimeRange } from "@ai-insight/shared-types";
import { dedupeItems } from "../normalize.js";
import { filterByTimeRange } from "../time-range.js";
import { DuckDuckGoEngine } from "./duckduckgo.js";
import { ExaEngine } from "./exa.js";
import { FirecrawlEngine } from "./firecrawl.js";
import type { SearchEngine } from "./duckduckgo.js";

export type { SearchEngine, SearchInput } from "./duckduckgo.js";
export { DuckDuckGoEngine, ExaEngine, FirecrawlEngine };

export interface FanoutOptions {
  query: string;
  timeRange?: TimeRange;
  tags?: DataSourceTag[];
  /** 每引擎取多少条。 */
  perEngineLimit?: number;
  /** 启用哪些引擎（按 name）；不传 = 全部已配置引擎。 */
  engines?: string[];
}

/** 默认三引擎实例（缺 key 的 isConfigured()=false，扇出时自动跳过）。 */
export function createDefaultEngines(): SearchEngine[] {
  return [new DuckDuckGoEngine(), new ExaEngine(), new FirecrawlEngine()];
}

/**
 * 扇出搜索：并发调用已配置引擎 → 时间过滤 → 去重。
 * 返回扁平 DataSourceItem[]，并附带每引擎命中数。
 */
export async function fanoutSearch(
  opts: FanoutOptions,
  engines?: SearchEngine[],
): Promise<{ items: DataSourceItem[]; perEngine: Record<string, number> }> {
  const list = engines ?? createDefaultEngines();
  const enabled = list.filter(
    (e) => e.isConfigured() && (!opts.engines || opts.engines.includes(e.name)),
  );

  const results = await Promise.allSettled(
    enabled.map((e) =>
      e.search({
        query: opts.query,
        timeRange: opts.timeRange,
        tags: opts.tags,
        limit: opts.perEngineLimit ?? 8,
      }),
    ),
  );

  const perEngine: Record<string, number> = {};
  let all: DataSourceItem[] = [];
  results.forEach((r, i) => {
    const name = enabled[i].name;
    if (r.status === "fulfilled") {
      perEngine[name] = r.value.length;
      all = all.concat(r.value);
    } else {
      perEngine[name] = 0;
      // 单引擎失败不阻断，记录但继续
      console.warn(`[search] ${name} failed:`, (r.reason as Error)?.message);
    }
  });

  const filtered = opts.timeRange
    ? filterByTimeRange(all, opts.timeRange)
    : all;
  const deduped = dedupeItems(filtered);
  return { items: deduped, perEngine };
}
