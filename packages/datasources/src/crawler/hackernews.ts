/**
 * Hacker News 热门 — 移植 newsnow/server/sources/hackernews.ts。
 * HTML 抓取（cheerio）；分数从 #score_<id> 提取为结构化 heat。
 */
import * as cheerio from "cheerio";
import { fetchText } from "../http.js";
import type { CrawlerAdapter, CrawlerRawItem } from "./types.js";

const BASE = "https://news.ycombinator.com";

/** HN 分数（如 "512 points"）→ heat 0-100（对数压缩）。 */
export function scoreToHeat(score: number): number {
  if (score <= 0) return 0;
  // HN 热帖常见 100-1000 分；log 压缩到 0-100
  return Math.min(100, Math.round(Math.log10(score + 1) * 33));
}

export class HackerNewsCrawler implements CrawlerAdapter {
  readonly platform = "hackernews";
  readonly name = "Hacker News";

  async fetch(): Promise<CrawlerRawItem[]> {
    const html = await fetchText(BASE, { timeoutMs: 15000 });
    const $ = cheerio.load(html);
    const items: CrawlerRawItem[] = [];

    $(".athing").each((_, el) => {
      const $el = $(el);
      const $a = $el.find(".titleline a").first();
      const title = $a.text().trim();
      const id = $el.attr("id");
      if (!title || !id) return;
      const scoreText = $(`#score_${id}`).text();
      const score = parseInt(scoreText, 10) || 0;
      items.push({
        id,
        title,
        url: `${BASE}/item?id=${id}`,
        hotText: scoreText,
        heat: scoreToHeat(score),
      });
    });

    return items;
  }
}
