/**
 * 时间范围处理 — 统一 TimeRange → 各引擎/过滤器的具体形态。
 *
 * 设计：时间窗作为一等输入（区别于 union-search 的 per-engine 散乱），
 * 能透传给搜索引擎的透传（DDG df / Exa startPublishedDate），
 * 不能透传的做结果后过滤（按 publishedAt）。
 */
import type { TimeRange, DataSourceItem } from "@ai-insight/shared-types";

/** TimeRange → 过去 N 毫秒（all = 不过滤）。 */
export function timeRangeToMs(range: TimeRange): number | null {
  const DAY = 24 * 60 * 60 * 1000;
  const map: Record<TimeRange, number | null> = {
    "1d": DAY,
    "3d": 3 * DAY,
    "1w": 7 * DAY,
    "1m": 30 * DAY,
    "6m": 180 * DAY,
    "1y": 365 * DAY,
    all: null,
  };
  return map[range];
}

/** TimeRange → ISO 日期字符串（用于 Exa startPublishedDate 等）。 */
export function timeRangeToStartDate(range: TimeRange): string | undefined {
  const ms = timeRangeToMs(range);
  if (ms == null) return undefined;
  return new Date(Date.now() - ms).toISOString().slice(0, 10); // YYYY-MM-DD
}

/** DuckDuckGo 的 df 参数：d/w/m/y。3d/6m 等就近归并。 */
export function timeRangeToDuckDf(range: TimeRange): string | undefined {
  const map: Partial<Record<TimeRange, string>> = {
    "1d": "d",
    "3d": "d",
    "1w": "w",
    "1m": "m",
    "6m": "m",
    "1y": "y",
    all: undefined,
  };
  return map[range];
}

/**
 * 按 publishedAt 过滤 DataSourceItem（后过滤兜底）。
 * 过滤掉早于 (now - ms) 的条目；无 publishedAt 的条目保留（无法判断）。
 */
export function filterByTimeRange(
  items: DataSourceItem[],
  range: TimeRange,
): DataSourceItem[] {
  const ms = timeRangeToMs(range);
  if (ms == null) return items;
  const cutoff = Date.now() - ms;
  return items.filter((it) => {
    if (!it.publishedAt) return true; // 无时间信息，保留
    const t = new Date(it.publishedAt).getTime();
    if (Number.isNaN(t)) return true;
    return t >= cutoff;
  });
}
