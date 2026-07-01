/**
 * 本地降级提取引擎 — fetch HTML → 极简正文提取（去 script/style，取文本）。
 *
 * 精度不如 jina/firecrawl，但零依赖、无限流。
 * fallback 链的最后一环（jina → firecrawl → local）。
 */
import { Type } from "@sinclair/typebox";
import { fetchText } from "../http.js";
import type { ExtractEngine, ExtractInput, ExtractResult } from "./types.js";

/** 本地提取特有参数：无。 */
export const localExtractParamsSchema = Type.Object({});

export class LocalExtractor implements ExtractEngine {
  readonly name = "local";
  readonly label = "Local (fallback)";
  readonly paramsSchema = localExtractParamsSchema;

  isConfigured(): boolean {
    return true; // 无依赖，永远可用
  }

  async extract(input: ExtractInput): Promise<ExtractResult> {
    const html = await fetchText(input.url, { timeoutMs: 15000 });
    // 去 script/style/head/nav
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return {
      url: input.url,
      title: titleMatch?.[1]?.trim(),
      content: cleaned.slice(0, 20000) || "(无法提取正文)",
      engine: this.name,
    };
  }
}
