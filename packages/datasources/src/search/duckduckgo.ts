/**
 * 搜索引擎统一接口 + DuckDuckGo 实现。
 *
 * 接口设计（改进自 union-search：原项目无统一接口，引擎各自散落）：
 *   search(input): Promise<DataSourceItem[]>
 * 归一化到 DataSourceItem（强制在引擎边界归一，而非合并时）。
 *
 * 三引擎：DuckDuckGo(无 key, cheerio) / Exa(raw fetch) / Firecrawl(SDK) / arxiv(无 key)。
 *
 * 引擎接受注入的 EngineConfig（不再直读 process.env），
 * 使 CLI（JSON 注入）与 server（DB/env 注入）共用同一份代码。
 */
import type { TSchema } from "@sinclair/typebox";
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
  /** 引擎特有参数（由 CLI 从 --<engine>.<param> flag 解析注入；引擎自行解释）。 */
  params?: Record<string, unknown>;
}

/**
 * 搜索引擎统一接口。
 *
 * `paramsSchema`：引擎特有参数的 TypeBox schema。
 * CLI 据此自动生成 `--<name>.<param>` flag 并静态校验。
 * 无特有参数的引擎（如 ddg）留空。
 */
export interface SearchEngine {
  /** 引擎 id（用于 --engines 选项与注册表 key，如 "ddg"）。 */
  readonly name: string;
  /** 展示名（用于 sourceName 与帮助文本，如 "DuckDuckGo"）。 */
  readonly label: string;
  /** 是否已配置（缺 key 的引擎返回 false，扇出时跳过）。 */
  isConfigured(): boolean;
  /** 执行搜索，返回归一化 DataSourceItem[]。 */
  search(input: SearchInput): Promise<DataSourceItem[]>;
  /** 引擎特有参数 schema（CLI 据此生成命名空间 flag）。 */
  readonly paramsSchema?: TSchema;
}

// ─────────────────────────────────────────────────────────────────────────────
// DuckDuckGo — 无 key，HTML 抓取（移植 union-search 选择器 + cheerio）
// ─────────────────────────────────────────────────────────────────────────────

const DDG_URL = "https://html.duckduckgo.com/html/";

export class DuckDuckGoEngine implements SearchEngine {
  readonly name = "ddg";
  readonly label = "DuckDuckGo";

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

      // DDG 的 href 可能是 /l/?uddg=<encoded> 重定向，解包成真实 URL。
      // 先补全相对路径（/l/?uddg=... → https://duckduckgo.com/l/?uddg=...），
      // 再解包 uddg query 参数拿到真正的目标 URL。
      if (href && !href.startsWith("http")) {
        try {
          href = new URL(href, "https://duckduckgo.com").toString();
        } catch {
          /* keep */
        }
      }
      try {
        const u = new URL(href);
        const uddg = u.searchParams.get("uddg");
        if (uddg) href = decodeURIComponent(uddg);
      } catch {
        /* 非法 URL，保持原样 */
      }
      if (!title || !href) return;

      items.push({
        id: `search:duckduckgo:${href}`,
        sourceType: "search",
        sourceName: this.label,
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
