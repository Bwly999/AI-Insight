/**
 * RSS — MVP 最小实现：即时 fetch + fast-xml-parser 解析。
 *
 * 设计文档 v1 的「后台轮询建索引 + FTS5 检索」属范围外（留框架）。
 * 此处提供即时 fetch_rss：拉指定 feed URL → 归一化 DataSourceItem[]。
 * Agent 的 fetch_rss 工具调此；时间范围/关键词过滤复用通用函数。
 */
import type { DataSourceItem, DataSourceTag } from "@ai-insight/shared-types";
import { XMLParser } from "fast-xml-parser";
import { fetchText } from "./http.js";
import { dedupeItems } from "./normalize.js";
import { filterByTimeRange } from "./time-range.js";
import type { TimeRange } from "@ai-insight/shared-types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

interface ParsedFeed {
  rss?: {
    channel?: {
      item?: RssItem | RssItem[];
    };
  };
  feed?: {
    entry?: RssItem | RssItem[]; // Atom
  };
}

interface RssItem {
  title?: string;
  link?: string | { href?: string };
  pubDate?: string;
  published?: string;
  updated?: string;
  description?: string;
  summary?: string;
  author?: string | { name?: string };
}

/** 解析 RSS/Atom feed → DataSourceItem[]。 */
export async function fetchRss(
  feedUrl: string,
  opts: {
    sourceName: string;
    tags?: DataSourceTag[];
    timeRange?: TimeRange;
    keywords?: string[];
    limit?: number;
  },
): Promise<DataSourceItem[]> {
  const xml = await fetchText(feedUrl, { timeoutMs: 20000 });
  const parsed = parser.parse(xml) as ParsedFeed;

  const rawItems: RssItem[] =
    parsed.rss?.channel?.item
      ? Array.isArray(parsed.rss.channel.item)
        ? parsed.rss.channel.item
        : [parsed.rss.channel.item]
      : parsed.feed?.entry
        ? Array.isArray(parsed.feed.entry)
          ? parsed.feed.entry
          : [parsed.feed.entry]
        : [];

  const now = new Date().toISOString();
  let items: DataSourceItem[] = rawItems.map((r) => {
    const link =
      typeof r.link === "string" ? r.link : r.link?.href ?? "";
    const author =
      typeof r.author === "string" ? r.author : r.author?.name;
    const publishedAt = r.pubDate ?? r.published ?? r.updated;
    return {
      id: `rss:${opts.sourceName}:${link}`,
      sourceType: "rss",
      sourceName: opts.sourceName,
      sourceId: link,
      title: r.title ?? "(无标题)",
      url: link,
      summary: r.description ?? r.summary,
      author,
      publishedAt,
      tags: opts.tags ?? [],
      fetchedAt: now,
    };
  });

  // 关键词过滤
  if (opts.keywords?.length) {
    const kws = opts.keywords.map((k) => k.toLowerCase());
    items = items.filter((it) => {
      const hay = `${it.title} ${it.summary ?? ""}`.toLowerCase();
      return kws.some((k) => hay.includes(k));
    });
  }

  // 时间过滤
  if (opts.timeRange) items = filterByTimeRange(items, opts.timeRange);

  // 去重 + 限量
  items = dedupeItems(items);
  if (opts.limit) items = items.slice(0, opts.limit);
  return items;
}
