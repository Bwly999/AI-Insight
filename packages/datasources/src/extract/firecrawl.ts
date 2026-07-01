/**
 * Firecrawl 提取引擎 — scrapeUrl 返回 markdown。
 *
 * 接受注入的 EngineConfig.firecrawlApiKey（不再直读 process.env）。
 */
import { Type } from "@sinclair/typebox";
import FirecrawlApp from "firecrawl";
import type { EngineConfig } from "../config.js";
import type { ExtractEngine, ExtractInput, ExtractResult } from "./types.js";

/** Firecrawl 提取特有参数：无。 */
export const firecrawlExtractParamsSchema = Type.Object({});

export class FirecrawlExtractor implements ExtractEngine {
  readonly name = "firecrawl";
  readonly label = "Firecrawl";
  readonly paramsSchema = firecrawlExtractParamsSchema;
  private client: FirecrawlApp | null;

  constructor(cfg: EngineConfig = {}) {
    const key = cfg.firecrawlApiKey ?? "";
    this.client = key ? new FirecrawlApp({ apiKey: key }) : null;
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  async extract(input: ExtractInput): Promise<ExtractResult> {
    if (!this.client) throw new Error("Firecrawl: no API key");
    const res = await this.client.scrapeUrl(input.url, { formats: ["markdown"] });
    if (!("success" in res) || !res.success) {
      throw new Error("Firecrawl scrape failed");
    }
    const md = (res as { markdown?: string }).markdown;
    if (!md) throw new Error("Firecrawl: empty markdown");
    return {
      url: input.url,
      title: (res as { metadata?: { title?: string } }).metadata?.title,
      content: md.slice(0, 20000),
      engine: this.name,
    };
  }
}
