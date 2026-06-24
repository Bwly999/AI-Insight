/**
 * GitHub Trending — 移植 newsnow/server/sources/github.ts。
 * HTML 抓取 trending 页；star 数提取为 heat。
 */
import * as cheerio from "cheerio";
import { fetchText } from "../http.js";
import type { CrawlerAdapter, CrawlerRawItem } from "./types.js";

const TRENDING_URL = "https://github.com/trending?spoken_language_code=";

/** 解析 "1,234" / "12.3k" star → 数字。 */
export function parseStars(s: string): number {
  const t = s.replace(/[,\s]/g, "").toLowerCase();
  const m = t.match(/([\d.]+)(k|m)?/);
  if (!m) return 0;
  let n = parseFloat(m[1]);
  if (m[2] === "k") n *= 1_000;
  else if (m[2] === "m") n *= 1_000_000;
  return Math.round(n);
}

/** star → heat 0-100。trending top 通常 100-5000 star/天。 */
function starsToHeat(stars: number): number {
  if (stars <= 0) return 0;
  return Math.min(100, Math.round(Math.log10(stars + 1) * 25));
}

export class GitHubTrendingCrawler implements CrawlerAdapter {
  readonly platform = "github-trending-today";
  readonly name = "GitHub Trending";

  async fetch(): Promise<CrawlerRawItem[]> {
    const html = await fetchText(TRENDING_URL, { timeoutMs: 20000 });
    const $ = cheerio.load(html);
    const items: CrawlerRawItem[] = [];

    $("main .Box div[data-hpc] > article").each((_, el) => {
      const $el = $(el);
      const $a = $el.find("> h2 a").first();
      const title = $a.text().replace(/[\n]+/g, "").trim();
      const href = $a.attr("href");
      if (!title || !href) return;
      const starText = $el.find('[href$="stargazers"]').text().replace(/\s+/g, "").trim();
      const stars = parseStars(starText);
      const desc = $el.find("> p").text().replace(/[\n]+/g, "").trim();
      items.push({
        id: href,
        title,
        url: `https://github.com${href}`,
        summary: desc || undefined,
        hotText: starText ? `✰ ${starText}` : undefined,
        heat: starsToHeat(stars),
      });
    });

    return items;
  }
}
