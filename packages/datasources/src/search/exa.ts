/**
 * Exa 搜索 — raw fetch POST api.exa.ai/search。
 * Auth: x-api-key（注意不是 Bearer）。
 * 时间过滤: startPublishedDate（ISO 日期）。
 *
 * 接受注入的 EngineConfig.exaApiKey（不再直读 process.env）。
 */
import { Type } from "@sinclair/typebox";
import type { DataSourceItem, DataSourceTag, TimeRange } from "@ai-insight/shared-types";
import { postJson } from "../http.js";
import { timeRangeToStartDate } from "../time-range.js";
import type { EngineConfig } from "../config.js";
import type { SearchEngine, SearchInput } from "./duckduckgo.js";

interface ExaResult {
  title: string;
  url: string;
  score?: number;
  id?: string;
  publishedDate?: string;
  text?: string;
  author?: string;
}

interface ExaResponse {
  results?: ExaResult[];
  requestId?: string;
}

/** Exa 特有参数：搜索类型 keyword/neural/auto。 */
export const exaParamsSchema = Type.Object({
  type: Type.Optional(Type.Union([Type.Literal("keyword"), Type.Literal("neural"), Type.Literal("auto")], {
    description: "搜索类型：keyword(关键词) / neural(神经) / auto(自选，默认)",
  })),
});

export class ExaEngine implements SearchEngine {
  readonly name = "exa";
  readonly label = "Exa";
  readonly paramsSchema = exaParamsSchema;
  private apiKey: string;

  constructor(cfg: EngineConfig = {}) {
    this.apiKey = cfg.exaApiKey ?? "";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async search(input: SearchInput): Promise<DataSourceItem[]> {
    if (!this.apiKey) return [];
    const limit = Math.min(input.limit ?? 10, 10);
    const startDate = input.timeRange
      ? timeRangeToStartDate(input.timeRange)
      : undefined;

    const body: Record<string, unknown> = {
      query: input.query,
      numResults: limit,
      type: (input.params?.type as string) ?? "auto", // 让 Exa 自选 keyword / neural
      contents: { text: { maxCharacters: 500 } }, // 内联正文片段
    };
    if (startDate) body.startPublishedDate = startDate;

    const data = await postJson<ExaResponse>("https://api.exa.ai/search", body, {
      headers: {
        "x-api-key": this.apiKey,
      },
      timeoutMs: 20000,
    });

    const now = new Date().toISOString();
    return (data.results ?? []).map<DataSourceItem>((r) => ({
      id: `search:exa:${r.id ?? r.url}`,
      sourceType: "search",
      sourceName: this.label,
      sourceId: r.id ?? r.url,
      title: r.title || r.url,
      url: r.url,
      summary: r.text,
      author: r.author,
      publishedAt: r.publishedDate,
      tags: input.tags ?? [],
      heat: r.score != null ? Math.round(r.score * 100) : undefined,
      fetchedAt: now,
    }));
  }
}
