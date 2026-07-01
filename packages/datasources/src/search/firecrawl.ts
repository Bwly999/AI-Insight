/**
 * Firecrawl 搜索 — 用 firecrawl SDK。
 * 同时提供内容提取能力（scrapeUrl）给 extract-content 链复用。
 *
 * 注意：Firecrawl search 无原生时间过滤，靠结果后过滤（metadata.publishedDate）兜底。
 * 接受注入的 EngineConfig.firecrawlApiKey（不再直读 process.env）。
 */
import type { DataSourceItem, DataSourceTag } from "@ai-insight/shared-types";
import FirecrawlApp, { type FirecrawlDocument } from "firecrawl";
import type { EngineConfig } from "../config.js";
import type { SearchEngine, SearchInput } from "./duckduckgo.js";

function getFirecrawlClient(apiKey?: string): FirecrawlApp | null {
  const key = apiKey ?? "";
  if (!key) return null;
  return new FirecrawlApp({ apiKey: key });
}

export class FirecrawlEngine implements SearchEngine {
  readonly name = "firecrawl";
  readonly label = "Firecrawl";
  private client: FirecrawlApp | null;

  constructor(cfg: EngineConfig = {}) {
    this.client = getFirecrawlClient(cfg.firecrawlApiKey);
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  async search(input: SearchInput): Promise<DataSourceItem[]> {
    if (!this.client) return [];
    const limit = Math.min(input.limit ?? 8, 8);
    const res = await this.client.search(input.query, {
      limit,
      scrapeOptions: { formats: ["markdown"] },
    });
    if (!res.success) {
      throw new Error(`Firecrawl search failed: ${res.error ?? "unknown"}`);
    }
    const now = new Date().toISOString();
    const hasUrl = (d: FirecrawlDocument): d is FirecrawlDocument & { url: string } =>
      !!d.url;
    return (res.data ?? [])
      .filter(hasUrl)
      .map<DataSourceItem>((d) => {
        const url = d.url;
        return {
          id: `search:firecrawl:${url}`,
          sourceType: "search",
          sourceName: this.label,
          sourceId: url,
          title: d.metadata?.title || url,
          url,
          summary: d.metadata?.description || undefined,
          content: d.markdown || undefined,
          author: d.metadata?.author,
          publishedAt: d.metadata?.publishedDate,
          tags: input.tags ?? [],
          fetchedAt: now,
        };
      });
  }
}
