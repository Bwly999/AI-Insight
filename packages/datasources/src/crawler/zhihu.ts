/**
 * 知乎热榜 — 移植 newsnow/server/sources/zhihu.ts。
 * JSON API（hot-list-web）；热度文本从 metrics_area 提取，按排名给 heat。
 */
import { fetchJson } from "../http.js";
import type { CrawlerAdapter, CrawlerRawItem } from "./types.js";

const URL =
  "https://www.zhihu.com/api/v3/feed/topstory/hot-list-web?limit=20&desktop=true";

interface ZhihuData {
  data: Array<{
    target: {
      title_area: { text: string };
      excerpt_area: { text: string };
      metrics_area: { text: string };
      link: { url: string };
    };
  }>;
}

export class ZhihuCrawler implements CrawlerAdapter {
  readonly platform = "zhihu";
  readonly name = "知乎";

  async fetch(): Promise<CrawlerRawItem[]> {
    const res = await fetchJson<ZhihuData>(URL, {
      headers: { Referer: "https://www.zhihu.com/hot" },
      timeoutMs: 15000,
    });

    return (res.data ?? []).map((k, idx) => {
      const linkUrl = k.target.link.url;
      return {
        id: linkUrl.match(/(\d+)$/)?.[1] ?? linkUrl,
        title: k.target.title_area.text,
        url: linkUrl,
        summary: k.target.excerpt_area?.text,
        hotText: k.target.metrics_area?.text,
        // 知乎热榜约 50 条；按排名给 heat
        heat: Math.max(0, 100 - idx * 2),
      } as CrawlerRawItem;
    });
  }
}
