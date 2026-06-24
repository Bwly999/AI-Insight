/**
 * 微博实时热搜 — 移植 newsnow/server/sources/weibo.ts。
 * HTML 抓取 s.weibo.com/top/summary；需 Cookie/UA/referer（newsnow 内置 Cookie）。
 * 微博热搜按排名给 heat（top1=100，递减）。
 */
import * as cheerio from "cheerio";
import { fetchText } from "../http.js";
import type { CrawlerAdapter, CrawlerRawItem } from "./types.js";

const BASE = "https://s.weibo.com";
const URL = `${BASE}/top/summary?cate=realtimehot`;

export class WeiboCrawler implements CrawlerAdapter {
  readonly platform = "weibo";
  readonly name = "微博";

  async fetch(): Promise<CrawlerRawItem[]> {
    const html = await fetchText(URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        // newsnow 内置 Cookie（公开热搜抓取）
        Cookie:
          "SUB=_2AkMWIuNSf8NxqwJRmP8dy2rhaoV2ygrEieKgfhKJJRMxHRl-yT9jqk86tRB6PaLNvQZR6zYUcYVT1zSjoSreQHidcUq7",
        Referer: URL,
      },
      timeoutMs: 15000,
    });

    const $ = cheerio.load(html);
    const items: CrawlerRawItem[] = [];
    const rows = $("#pl_top_realtimehot table tbody tr").slice(1);

    rows.each((idx, row) => {
      const $row = $(row);
      const $link = $row
        .find("td.td-02 a")
        .filter((_, el) => {
          const href = $(el).attr("href");
          return !!(href && !href.includes("javascript:void(0);"));
        })
        .first();

      if (!$link.length) return;
      const title = $link.text().trim();
      const href = $link.attr("href");
      if (!title || !href) return;

      const flag = $row.find("td.td-03").text().trim();
      // 按排名给 heat：top1=100，50 名后趋近 0
      const heat = Math.max(0, 100 - idx * 2);

      items.push({
        id: title,
        title,
        url: `${BASE}${href}`,
        mobileUrl: `${BASE}${href}`,
        hotText: flag || `${idx + 1}`,
        heat,
      });
    });

    return items;
  }
}
