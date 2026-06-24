/**
 * 少数派热门文章 — 移植 newsnow/server/sources/sspai.ts。
 * JSON API（tag/page/get，热门文章标签）；按时间排序给 heat。
 */
import { fetchJson } from "../http.js";
import type { CrawlerAdapter, CrawlerRawItem } from "./types.js";

const URL =
  "https://sspai.com/api/v1/article/tag/page/get?limit=30&offset=0&created_at=TIMESTAMP&tag=%E7%83%AD%E9%97%A8%E6%96%87%E7%AB%A0&released=false";

interface SspaiRes {
  data: Array<{ id: number; title: string }>;
}

export class SspaiCrawler implements CrawlerAdapter {
  readonly platform = "sspai";
  readonly name = "少数派";

  async fetch(): Promise<CrawlerRawItem[]> {
    const url = URL.replace("TIMESTAMP", String(Date.now()));
    const res = await fetchJson<SspaiRes>(url, { timeoutMs: 15000 });

    return (res.data ?? []).map((k, idx) => ({
      id: k.id,
      title: k.title,
      url: `https://sspai.com/post/${k.id}`,
      // 少数派无原生热度，按列表序给 heat（前几条略高）
      heat: Math.max(10, 70 - idx * 2),
    })) as CrawlerRawItem[];
  }
}
