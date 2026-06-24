/**
 * 爬虫注册表 + 扇出聚合。
 *
 * 平台 catalog（platform id 对齐 newsnow SourceID）：
 *   hackernews / github-trending-today / weibo / zhihu / sspai / tencent-hot
 *
 * 默认 tags：中文平台(china 类)→ news；技术平台(HN/GitHub/少数派)→ tech。
 */
import type { DataSourceItem, DataSourceTag, TimeRange } from "@ai-insight/shared-types";
import { dedupeItems } from "../normalize.js";
import { filterByTimeRange } from "../time-range.js";
import { HackerNewsCrawler } from "./hackernews.js";
import { GitHubTrendingCrawler } from "./github.js";
import { WeiboCrawler } from "./weibo.js";
import { ZhihuCrawler } from "./zhihu.js";
import { SspaiCrawler } from "./sspai.js";
import { TencentCrawler } from "./tencent.js";
import { normalizeCrawlerItem, type CrawlerAdapter } from "./types.js";

export type { CrawlerAdapter, CrawlerRawItem } from "./types.js";
export {
  HackerNewsCrawler,
  GitHubTrendingCrawler,
  WeiboCrawler,
  ZhihuCrawler,
  SspaiCrawler,
  TencentCrawler,
};

/** 默认全部 6 个爬虫适配器实例。 */
export function createDefaultCrawlers(): CrawlerAdapter[] {
  return [
    new HackerNewsCrawler(),
    new GitHubTrendingCrawler(),
    new WeiboCrawler(),
    new ZhihuCrawler(),
    new SspaiCrawler(),
    new TencentCrawler(),
  ];
}

export interface CrawlOptions {
  /** 启用哪些平台（platform id）；不传 = 全部。 */
  platforms?: string[];
  /** 关键词过滤（标题包含即保留；不传 = 不过滤）。 */
  keywords?: string[];
  timeRange?: TimeRange;
  /** 每平台取多少条。 */
  perPlatformLimit?: number;
  /** 附加标签。 */
  tags?: DataSourceTag[];
}

/** 各平台的默认标签。 */
const PLATFORM_TAGS: Record<string, DataSourceTag[]> = {
  hackernews: ["tech", "news"],
  "github-trending-today": ["tech"],
  weibo: ["social", "news"],
  zhihu: ["social", "news"],
  sspai: ["tech", "product"],
  "tencent-hot": ["news"],
};

/**
 * 扇出抓取：并发调用选定平台 → 归一化 → 关键词过滤 → 时间过滤 → 去重。
 * 返回扁平 DataSourceItem[] + 每平台命中数。
 */
export async function fanoutCrawl(
  opts: CrawlOptions = {},
  crawlers?: CrawlerAdapter[],
): Promise<{ items: DataSourceItem[]; perPlatform: Record<string, number> }> {
  const list = crawlers ?? createDefaultCrawlers();
  const enabled = list.filter(
    (c) => !opts.platforms || opts.platforms.includes(c.platform),
  );

  const results = await Promise.allSettled(
    enabled.map((c) => c.fetch().catch(() => [] as never[])),
  );

  const perPlatform: Record<string, number> = {};
  let all: DataSourceItem[] = [];
  results.forEach((r, i) => {
    const c = enabled[i];
    const tags = [...(PLATFORM_TAGS[c.platform] ?? []), ...(opts.tags ?? [])];
    if (r.status === "fulfilled") {
      const sliced = opts.perPlatformLimit
        ? r.value.slice(0, opts.perPlatformLimit)
        : r.value;
      perPlatform[c.platform] = sliced.length;
      all = all.concat(sliced.map((it) => normalizeCrawlerItem(it, c.platform, c.name, tags)));
    } else {
      perPlatform[c.platform] = 0;
      console.warn(`[crawl] ${c.platform} failed:`, (r.reason as Error)?.message);
    }
  });

  // 关键词过滤（标题/摘要命中任一关键词）
  if (opts.keywords?.length) {
    const kws = opts.keywords.map((k) => k.toLowerCase());
    all = all.filter((it) => {
      const hay = `${it.title} ${it.summary ?? ""}`.toLowerCase();
      return kws.some((k) => hay.includes(k));
    });
  }

  const filtered = opts.timeRange ? filterByTimeRange(all, opts.timeRange) : all;
  const deduped = dedupeItems(filtered);
  return { items: deduped, perPlatform };
}
