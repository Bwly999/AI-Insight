/**
 * Jina Reader 提取引擎 — 支持自托管 URL（见 Q6 / §6.2）。
 *
 * 无 key 也能用（key 仅提升限流）。
 * URL 构造：自托管 jinaUrl + url；否则官方 https://r.jina.ai/<url>。
 *
 * 接受注入的 EngineConfig.jinaUrl / jinaApiKey（不再直读 process.env）。
 */
import { Type } from "@sinclair/typebox";
import { fetchText } from "../http.js";
import type { EngineConfig } from "../config.js";
import type { ExtractEngine, ExtractInput, ExtractResult } from "./types.js";

interface JinaJsonResponse {
  code?: number;
  data?: {
    title?: string;
    content?: string;
    description?: string;
    url?: string;
  };
}

/** Jina 特有参数：无（自托管 URL 由全局 config 控制，非 per-call）。 */
export const jinaParamsSchema = Type.Object({});

const OFFICIAL_JINA = "https://r.jina.ai/";

export class JinaExtractor implements ExtractEngine {
  readonly name = "jina";
  readonly label = "Jina Reader";
  readonly paramsSchema = jinaParamsSchema;
  private jinaUrl: string;
  private apiKey: string;

  constructor(cfg: EngineConfig = {}) {
    // 自托管 URL 优先；否则官方。规范化：去尾斜杠。
    const base = (cfg.jinaUrl ?? "").trim().replace(/\/+$/, "");
    this.jinaUrl = base || OFFICIAL_JINA;
    this.apiKey = cfg.jinaApiKey ?? "";
  }

  isConfigured(): boolean {
    // 无 key 也能用，永远可用
    return true;
  }

  async extract(input: ExtractInput): Promise<ExtractResult> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Return-Format": "markdown",
    };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const endpoint = `${this.jinaUrl}/${input.url}`;
    const raw = await fetchText(endpoint, {
      headers,
      timeoutMs: 25000,
    });

    let json: JinaJsonResponse;
    try {
      json = JSON.parse(raw) as JinaJsonResponse;
    } catch {
      // 非 JSON（可能是纯文本 markdown）
      return { url: input.url, content: raw.slice(0, 20000), engine: this.name };
    }
    if (!json.data?.content) {
      throw new Error("Jina: empty content");
    }
    return {
      url: input.url,
      title: json.data.title,
      content: json.data.content.slice(0, 20000),
      engine: this.name,
    };
  }
}
