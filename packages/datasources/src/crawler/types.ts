/**
 * 爬虫（crawler）适配器 — 移植 newsnow 的 SourceGetter 模式。
 *
 * 关键改进（相对 newsnow）：
 *  - 全局 myFetch/defineSource → 显式 import（newsnow 用 Nitro auto-import）
 *  - 结构化 metrics（heat/score/author）而非 freeform extra.info
 *  - 归一化到 DataSourceItem（与搜索统一），便于 Agent 一视同仁
 *
 * SourceGetter = () => Promise<CrawlerRawItem[]>，与 newsnow 等价。
 */
import type { DataSourceItem, DataSourceTag, ItemSourceType } from "@ai-insight/shared-types";

/** 爬虫原始条目（贴近 newsnow NewsItem，但提取结构化 metrics）。 */
export interface CrawlerRawItem {
  /** 源内唯一 id */
  id: string | number;
  title: string;
  url: string;
  mobileUrl?: string;
  pubDate?: number | string;
  /** 摘要 / 描述 */
  summary?: string;
  /** 作者 */
  author?: string;
  /** 热度 0-100（结构化；用于 UI 热度条） */
  heat?: number;
  /** 原始热度文本（如 "✰ 1234"、"2w 观看"） */
  hotText?: string;
  /** 图标 URL */
  icon?: string;
}

/**
 * Crawler 适配器接口（对齐 newsnow SourceGetter，但带元数据）。
 * type 固定为 crawler；platform = newsnow 的 SourceID。
 */
export interface CrawlerAdapter {
  /** 平台 id（对齐 newsnow SourceID：hackernews / github-trending-today / ...） */
  readonly platform: string;
  /** 展示名 */
  readonly name: string;
  /** 抓取热点列表 */
  fetch(): Promise<CrawlerRawItem[]>;
}

/** 把 CrawlerRawItem 归一化为 DataSourceItem。 */
export function normalizeCrawlerItem(
  item: CrawlerRawItem,
  platform: string,
  name: string,
  tags: DataSourceTag[] = [],
): DataSourceItem {
  const now = new Date().toISOString();
  return {
    id: `crawler:${platform}:${item.id}`,
    sourceType: "crawler" as ItemSourceType,
    sourceName: name,
    sourceId: String(item.id),
    title: item.title,
    url: item.url,
    summary: item.summary,
    author: item.author,
    publishedAt: toIso(item.pubDate),
    tags,
    heat: item.heat,
    fetchedAt: now,
  };
}

/** pubDate（可能是毫秒时间戳或字符串）→ ISO。 */
function toIso(pubDate?: number | string): string | undefined {
  if (pubDate == null) return undefined;
  if (typeof pubDate === "number") {
    // newsnow 有些是秒，有些是毫秒
    const ms = pubDate > 1e12 ? pubDate : pubDate * 1000;
    return new Date(ms).toISOString();
  }
  return pubDate;
}
