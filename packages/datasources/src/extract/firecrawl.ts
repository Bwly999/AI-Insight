/**
 * Firecrawl 提取引擎 — 直调 Firecrawl REST API（v1/scrape），返回 markdown。
 *
 * 不用官方 firecrawl SDK：SDK 内部用 axios（自带实例），无法注入本仓库的
 * undici 局部 dispatcher，导致 firecrawl 出站走直连、绕过管理端代理设置。
 * 改为经 http.ts 的 postJson 发请求，与 jina/local 等引擎一致地走模块级
 * dispatcher —— 管理端"代理"设置因此对 firecrawl 同样生效。
 *
 * 接受注入的 EngineConfig.firecrawlApiKey（不再直读 process.env）。
 */
import { Type } from "@sinclair/typebox";
import { postJson } from "../http.js";
import type { EngineConfig } from "../config.js";
import type { ExtractEngine, ExtractInput, ExtractResult } from "./types.js";

/** Firecrawl scrape 响应里的文档（data 字段）。 */
interface ScrapeDocument {
  markdown?: string;
  html?: string;
  metadata?: {
    title?: string;
    [key: string]: unknown;
  };
}

interface ScrapeResponse {
  success?: boolean;
  data?: ScrapeDocument;
  warning?: string;
  error?: string;
}

/** Firecrawl 提取特有参数：无。 */
export const firecrawlExtractParamsSchema = Type.Object({});

export class FirecrawlExtractor implements ExtractEngine {
  readonly name = "firecrawl";
  readonly label = "Firecrawl";
  readonly paramsSchema = firecrawlExtractParamsSchema;
  private apiKey: string;

  constructor(cfg: EngineConfig = {}) {
    this.apiKey = cfg.firecrawlApiKey ?? "";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async extract(input: ExtractInput): Promise<ExtractResult> {
    if (!this.apiKey) throw new Error("Firecrawl: no API key");
    const res = await postJson<ScrapeResponse>(
      "https://api.firecrawl.dev/v1/scrape",
      { url: input.url, formats: ["markdown"] },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeoutMs: 30000,
      },
    );
    if (!res.success || !res.data) {
      throw new Error(`Firecrawl scrape failed: ${res.error ?? "unknown"}`);
    }
    const md = res.data.markdown;
    if (!md) throw new Error("Firecrawl: empty markdown");
    return {
      url: input.url,
      title: res.data.metadata?.title,
      content: md.slice(0, 20000),
      engine: this.name,
    };
  }
}
