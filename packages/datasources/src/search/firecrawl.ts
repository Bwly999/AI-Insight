/**
 * Firecrawl 搜索 — 直调 Firecrawl REST API（v1/search）。
 *
 * 不用官方 firecrawl SDK：SDK 内部用 axios（自带实例），无法注入本仓库的
 * undici 局部 dispatcher，导致 firecrawl 出站走直连、绕过管理端代理设置。
 * 改为经 http.ts 的 postJson 发请求，与 Exa/Arxiv 等引擎一致地走模块级
 * dispatcher —— 管理端"代理"设置因此对 firecrawl 同样生效。
 *
 * 注意：Firecrawl search 无原生时间过滤，靠结果后过滤（metadata.publishedDate）兜底。
 * 接受注入的 EngineConfig.firecrawlApiKey（不再直读 process.env）。
 */
import type { DataSourceItem } from "@ai-insight/shared-types";
import { postJson } from "../http.js";
import type { EngineConfig } from "../config.js";
import type { SearchEngine, SearchInput } from "./duckduckgo.js";

/** Firecrawl search 响应里的单条文档。 */
interface FirecrawlDocument {
  url?: string;
  markdown?: string;
  title?: string;
  description?: string;
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
    publishedDate?: string;
    [key: string]: unknown;
  };
}

interface SearchResponse {
  success?: boolean;
  data?: FirecrawlDocument[];
  warning?: string;
  error?: string;
}

export class FirecrawlEngine implements SearchEngine {
  readonly name = "firecrawl";
  readonly label = "Firecrawl";
  private apiKey: string;

  constructor(cfg: EngineConfig = {}) {
    this.apiKey = cfg.firecrawlApiKey ?? "";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async search(input: SearchInput): Promise<DataSourceItem[]> {
    if (!this.apiKey) return [];
    const limit = Math.min(input.limit ?? 8, 8);
    // 不带 scrapeOptions：只取 URL/title/description，避免对每条结果抓取正文
    // 耗费 scrape 额度（一次 search ≈ 8 credits）。正文按需由 extract 链抓取。
    const data = await postJson<SearchResponse>(
      "https://api.firecrawl.dev/v1/search",
      {
        query: input.query,
        limit,
        lang: "en",
        country: "us",
        scrapeOptions: { formats: [] },
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeoutMs: 60000,
      },
    );

    if (!data.success) {
      throw new Error(`Firecrawl search failed: ${data.error ?? "unknown"}`);
    }
    const now = new Date().toISOString();
    return (data.data ?? [])
      .filter((d): d is FirecrawlDocument & { url: string } => !!d.url)
      .map<DataSourceItem>((d) => {
        const url = d.url;
        return {
          id: `search:firecrawl:${url}`,
          sourceType: "search",
          sourceName: this.label,
          sourceId: url,
          title: d.metadata?.title || d.title || url,
          url,
          summary: d.metadata?.description || d.description || undefined,
          // search 不再抓正文；content 留空，由 extract 链按需 scrapeUrl 获取。
          content: d.markdown || undefined,
          author: d.metadata?.author,
          publishedAt: d.metadata?.publishedDate,
          tags: input.tags ?? [],
          fetchedAt: now,
        };
      });
  }
}
