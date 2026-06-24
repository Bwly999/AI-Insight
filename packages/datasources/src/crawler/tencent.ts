/**
 * 腾讯新闻综合早报 — 移植 newsnow/server/sources/tencent.ts。
 * JSON API（getTagInfo）；articleList 里的 link_info.url 为正文链接。
 */
import { fetchJson } from "../http.js";
import type { CrawlerAdapter, CrawlerRawItem } from "./types.js";

const URL = "https://i.news.qq.com/web_backend/v2/getTagInfo?tagId=aEWqxLtdgmQ%3D";

interface TencentArticle {
  id: number | string;
  title: string;
  desc?: string;
  link_info?: { url?: string };
}

export interface TencentRes {
  data: {
    tabs: Array<{
      articleList: TencentArticle[];
    }>;
  };
}

export class TencentCrawler implements CrawlerAdapter {
  readonly platform = "tencent-hot";
  readonly name = "腾讯新闻";

  async fetch(): Promise<CrawlerRawItem[]> {
    const res = await fetchJson<TencentRes>(URL, {
      headers: { Referer: "https://news.qq.com/" },
      timeoutMs: 15000,
    });

    const articles = res.data?.tabs?.[0]?.articleList ?? [];
    return articles
      .filter((a) => a.title && a.link_info?.url)
      .map((a, idx) => ({
        id: a.id,
        title: a.title,
        url: a.link_info!.url!,
        summary: a.desc,
        heat: Math.max(10, 70 - idx * 2),
      })) as CrawlerRawItem[];
  }
}
