/**
 * arXiv 搜索引擎 — 移植自 ref/Signex/.claude/skills/fetch-arxiv/scripts/search.py。
 *
 * 通过 arXiv 公开 API（Atom feed）搜索学术预印本。
 * 完全免费，无需 API key。
 *
 * 特有参数（paramsSchema）：categories / sortBy / sortOrder。
 * 时间过滤：arXiv 无原生时间参数，靠 publishedAt 后过滤（filterByTimeRange）。
 */
import { Type } from "@sinclair/typebox";
import type { DataSourceItem, DataSourceTag, TimeRange } from "@ai-insight/shared-types";
import { fetchText } from "../http.js";
import { filterByTimeRange } from "../time-range.js";
import { XMLParser } from "fast-xml-parser";
import type { SearchEngine, SearchInput } from "./duckduckgo.js";

const ARXIV_API = "http://export.arxiv.org/api/query";
const ARXIV_ID_RE = /(\d{4}\.\d{4,5})/;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

/** arXiv 特有参数 schema → CLI 自动生成 --arxiv.categories / --arxiv.sortBy 等 flag。 */
export const arxivParamsSchema = Type.Object({
  categories: Type.Optional(Type.Array(Type.String(), {
    description: "arXiv 分类过滤（如 cs.AI, cs.CL），多分类为 OR 关系",
  })),
  sortBy: Type.Optional(Type.Union(
    [Type.Literal("submittedDate"), Type.Literal("relevance"), Type.Literal("lastUpdatedDate")],
    { description: "排序：submittedDate(默认) / relevance / lastUpdatedDate" },
  )),
  sortOrder: Type.Optional(Type.Union(
    [Type.Literal("descending"), Type.Literal("ascending")],
    { description: "排序方向：descending(默认) / ascending" },
  )),
});

interface ArxivLink {
  "@_href"?: string;
  "@_type"?: string;
}

interface ArxivAuthor {
  name?: string;
}

interface ArxivEntry {
  id?: string;
  title?: string;
  summary?: string;
  published?: string;
  updated?: string;
  author?: ArxivAuthor | ArxivAuthor[];
  link?: ArxivLink | ArxivLink[];
  "arxiv:comment"?: { "#text"?: string };
  "arxiv:journal_ref"?: { "#text"?: string };
  "arxiv:doi"?: { "#text"?: string };
  category?: { "@_term"?: string } | { "@_term"?: string }[];
}

interface ArxivFeed {
  entry?: ArxivEntry | ArxivEntry[];
}

/** 从 entry URL 提取裸 arXiv ID（去版本号）。 */
function extractArxivId(entryId: string): string {
  const m = ARXIV_ID_RE.exec(entryId);
  return m ? m[1] : entryId;
}

/** 构造 arXiv search_query。 */
function buildQuery(keyword: string, categories?: string[]): string {
  // URL 编码交给 fetch 层；这里只拼逻辑表达式
  let q = `all:${keyword}`;
  if (categories?.length) {
    const catExpr = categories.map((c) => `cat:${c}`).join("+OR+");
    q = `${q}+AND+(${catExpr})`;
  }
  return q;
}

export class ArxivEngine implements SearchEngine {
  readonly name = "arxiv";
  readonly label = "arXiv";
  readonly paramsSchema = arxivParamsSchema;

  isConfigured(): boolean {
    return true; // 公开 API，无 key
  }

  async search(input: SearchInput): Promise<DataSourceItem[]> {
    const limit = Math.min(input.limit ?? 20, 100);
    const categories = input.params?.categories as string[] | undefined;
    const sortBy = (input.params?.sortBy as string) ?? "submittedDate";
    const sortOrder = (input.params?.sortOrder as string) ?? "descending";

    const searchQuery = buildQuery(input.query, categories);
    const params = new URLSearchParams({
      search_query: searchQuery,
      start: "0",
      max_results: String(limit),
      sortBy,
      sortOrder,
    });
    const url = `${ARXIV_API}?${params.toString()}`;

    const xml = await fetchText(url, {
      timeoutMs: 30000,
      headers: { "User-Agent": "AI-Insight/1.0 arXiv Engine" },
    });

    const parsed = parser.parse(xml) as { feed?: ArxivFeed };
    const feed = parsed.feed;
    const rawEntries = feed?.entry
      ? Array.isArray(feed.entry)
        ? feed.entry
        : [feed.entry]
      : [];

    let items: DataSourceItem[] = rawEntries.map((e) => {
      const entryId = e.id ?? "";
      const arxivId = extractArxivId(entryId);
      const title = (e.title ?? "").replace(/\n/g, " ").trim();
      const abstract = (e.summary ?? "").trim();
      const authors = Array.isArray(e.author) ? e.author : e.author ? [e.author] : [];
      const authorStr = authors.map((a) => a.name).filter(Boolean).join(", ");

      // PDF 链接
      let pdfUrl = `https://arxiv.org/pdf/${arxivId}`;
      const links = Array.isArray(e.link) ? e.link : e.link ? [e.link] : [];
      for (const l of links) {
        if (l["@_type"] === "application/pdf" && l["@_href"]) {
          pdfUrl = l["@_href"];
          break;
        }
      }

      const absUrl = `https://arxiv.org/abs/${arxivId}`;
      return {
        id: `search:arxiv:${arxivId}`,
        sourceType: "search" as const,
        sourceName: this.label,
        sourceId: arxivId,
        title: title || absUrl,
        url: absUrl,
        summary: abstract,
        content: abstract, // arxiv 摘要即核心内容
        author: authorStr || undefined,
        publishedAt: e.published ?? e.updated,
        tags: (input.tags ?? []) as DataSourceTag[],
        fetchedAt: new Date().toISOString(),
      };
    });

    // 时间过滤（arXiv 无原生时间参数，后过滤兜底）
    if (input.timeRange) {
      items = filterByTimeRange(items, input.timeRange);
    }
    return items;
  }
}
