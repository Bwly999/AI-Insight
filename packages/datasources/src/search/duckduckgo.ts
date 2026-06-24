/**
 * 搜索引擎统一接口 + 实现。
 *
 * 接口设计（改进自 union-search：原项目无统一接口，引擎各自散落）：
 *   search(input): Promise<DataSourceItem[]>
 * 归一化到 DataSourceItem（强制在引擎边界归一，而非合并时）。
 *
 * 三引擎：DuckDuckGo(无 key, cheerio) / Exa(raw fetch) / Firecrawl(SDK)。
 */
import type { DataSourceItem, DataSourceTag, TimeRange } from "@ai-insight/shared-types";
import { fetchText } from "../http.js";
import { timeRangeToDuckDf } from "../time-range.js";
import * as cheerio from "cheerio";

/** 搜索引擎输入。 */
export interface SearchInput {
  query: string;
  timeRange?: TimeRange;
  tags?: DataSourceTag[];
  limit?: number;
}

/** 搜索引擎统一接口。 */
export interface SearchEngine {
  /** 引擎名（用于 sourceName）。 */
  readonly name: string;
  /** 是否已配置（缺 key 的引擎返回 false，扇出时跳过）。 */
  isConfigured(): boolean;
  search(input: SearchInput): Promise<DataSourceItem[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// DuckDuckGo — 无 key，HTML 抓取（移植 union-search 选择器 + cheerio）
// ─────────────────────────────────────────────────────────────────────────────

const DDG_URL = "https://html.duckduckgo.com/html/";

export class DuckDuckGoEngine implements SearchEngine {
  readonly name = "DuckDuckGo";

  isConfigured(): boolean {
    return true;
  }

  async search(input: SearchInput): Promise<DataSourceItem[]> {
    const limit = Math.min(input.limit ?? 10, 10);
    const df = input.timeRange ? timeRangeToDuckDf(input.timeRange) : undefined;

    // DDG lite 用 POST + form data；df=d/w/m/y 控制时间窗
    const form = new URLSearchParams();
    form.set("q", input.query);
    form.set("b", "");
    form.set("l", "wt-wt"); // 全球
    if (df) form.set("df", df);

    const html = await fetchText(DDG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
        // 避免 DDG 反爬把请求当机器
        Referer: "https://duckduckgo.com/",
      },
      body: form.toString(),
    });

    const $ = cheerio.load(html);
    const items: DataSourceItem[] = [];
    const now = new Date().toISOString();

    $(".result").each((_, el) => {
      if (items.length >= limit) return;
      const $el = $(el);
      const $a = $el.find("h2 a").first();
      const title = $a.text().trim();
      let href = $a.attr("href") ?? "";
      const snippet = $el.find(".result__snippet, a.result__snippet").text().trim();

      // DDG 的 href 可能是 /l/?uddg= 重定向，解包
      if (href && !href.startsWith("http")) {
        try {
          href = new URL(href, "https://duckduckgo.com").toString();
        } catch {
          /* keep */
        }
      }
      if (!title || !href) return;

      items.push({
        id: `search:duckduckgo:${href}`,
        sourceType: "search",
        sourceName: this.name,
        sourceId: href,
        title,
        url: href,
        summary: snippet || undefined,
        tags: input.tags ?? [],
        fetchedAt: now,
      });
    });

    return items;
  }
}
