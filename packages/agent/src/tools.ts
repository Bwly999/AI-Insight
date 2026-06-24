/**
 * 6 个自定义工具 — defineTool(TypeBox 参数)。
 *
 * 每个工具是工厂函数，闭包绑定该 Run 的上下文（config、report 回调）。
 * 返回 ToolDefinition[]，注入 createInsightSession 的 customTools。
 *
 * 工具返回 AgentToolResult：{ content: [{type:"text", text}], details }。
 */
import { Type, type Static } from "@sinclair/typebox";
import { defineTool } from "@earendil-works/pi-coding-agent";
import {
  fanoutSearch,
  fanoutCrawl,
  fetchRss,
  extractContent,
  type SearchEngine,
  type CrawlerAdapter,
} from "@ai-insight/datasources";
import type { ConversationConfig } from "@ai-insight/shared-types";
import type { DataSourceItem } from "@ai-insight/shared-types";

/** 工具上下文（绑定到一次 Run）。 */
export interface ToolContext {
  /** Run 配置（时间范围、标签偏好、lens）。 */
  config: ConversationConfig;
  /** 搜索引擎实例（注入便于测试/复用）。 */
  engines?: SearchEngine[];
  /** 爬虫适配器实例。 */
  crawlers?: CrawlerAdapter[];
  /** RSS 源：feedUrl → { sourceName, tags }。MVP 从 data_sources 取。 */
  rssFeeds: { feedUrl: string; sourceName: string; tags: import("@ai-insight/shared-types").DataSourceTag[] }[];
  /** 启用的爬虫平台 id 列表。 */
  enabledPlatforms?: string[];
  /** save_report 回调：把报告落库（由 server 注入）。 */
  saveReport: (data: { title: string; markdown: string }) => Promise<void>;
  /** 工具命中信号收集（供证据面板/统计）。 */
  onItems?: (items: DataSourceItem[], toolName: string) => void;
}

// ─── 工具参数 schema ──────────────────────────────────────────────────────
const searchParams = Type.Object({
  query: Type.String({ description: "搜索查询词（建议用英文/中英混合以提高命中率）" }),
  tags: Type.Optional(Type.Array(Type.String(), { description: "标签偏好（覆盖默认）" })),
  limit: Type.Optional(Type.Number({ description: "每引擎取多少条，默认 8" })),
});

const crawlParams = Type.Object({
  keywords: Type.Optional(Type.Array(Type.String(), { description: "标题关键词过滤（不传=全部热点）" })),
  platforms: Type.Optional(Type.Array(Type.String(), { description: "平台 id（不传=全部启用平台）。可选: hackernews,github-trending-today,weibo,zhihu,sspai,tencent-hot" })),
  limit: Type.Optional(Type.Number({ description: "每平台取多少条，默认 8" })),
});

const rssParams = Type.Object({
  keywords: Type.Optional(Type.Array(Type.String(), { description: "关键词过滤" })),
  tags: Type.Optional(Type.Array(Type.String(), { description: "标签过滤" })),
  limit: Type.Optional(Type.Number({ description: "每源取多少条，默认 10" })),
});

const extractParams = Type.Object({
  url: Type.String({ description: "要提取正文的 URL" }),
});

const listDatasourcesParams = Type.Object({
  tags: Type.Optional(Type.Array(Type.String(), { description: "按标签过滤" })),
});

const saveReportParams = Type.Object({
  title: Type.String({ description: "报告标题" }),
  markdown: Type.String({ description: "报告 markdown 全文（结构化、含数据来源）" }),
});

// ─── 工具工厂 ─────────────────────────────────────────────────────────────
export function createInsightTools(ctx: ToolContext) {
  const now = () => new Date().toISOString();

  const searchTool = defineTool({
    name: "search",
    label: "搜索",
    description: "扇出聚合搜索引擎（DuckDuckGo/Exa/Firecrawl）搜索。返回去重后的信号列表。时间范围自动应用当前 Run 配置。",
    promptSnippet: "search({query}): 聚合搜索引擎，按时间窗过滤",
    parameters: searchParams,
    async execute(_id, params) {
      const limit = params.limit ?? 8;
      const { items, perEngine } = await fanoutSearch(
        {
          query: params.query,
          timeRange: ctx.config.timeRange,
          tags: (params.tags ?? ctx.config.tagPrefs) as never,
          perEngineLimit: limit,
        },
        ctx.engines,
      );
      ctx.onItems?.(items, "search");
      const summary = `搜索「${params.query}」命中 ${items.length} 条（${Object.entries(perEngine).map(([k, v]) => `${k}:${v}`).join(", ")}）`;
      return {
        content: [{ type: "text" as const, text: formatItems("search", summary, items) }],
        details: { found: items.length, perEngine },
      };
    },
  });

  const crawlTool = defineTool({
    name: "crawl",
    label: "抓取热点",
    description: "抓取热点平台（HN/GitHub Trending/微博/知乎/少数派/腾讯新闻）的实时热点列表。返回去重后的信号。",
    promptSnippet: "crawl({keywords?,platforms?}): 抓取平台热点",
    parameters: crawlParams,
    async execute(_id, params) {
      const { items, perPlatform } = await fanoutCrawl(
        {
          platforms: params.platforms ?? ctx.enabledPlatforms,
          keywords: params.keywords,
          timeRange: ctx.config.timeRange,
          perPlatformLimit: params.limit ?? 8,
          tags: ctx.config.tagPrefs,
        },
        ctx.crawlers,
      );
      ctx.onItems?.(items, "crawl");
      const summary = `抓取热点命中 ${items.length} 条（${Object.entries(perPlatform).map(([k, v]) => `${k}:${v}`).join(", ")}）`;
      return {
        content: [{ type: "text" as const, text: formatItems("crawl", summary, items) }],
        details: { found: items.length, perPlatform },
      };
    },
  });

  const rssTool = defineTool({
    name: "fetch_rss",
    label: "RSS 检索",
    description: "检索已启用的 RSS 订阅源，按关键词/时间范围过滤。返回去重后的信号。",
    promptSnippet: "fetch_rss({keywords?,tags?}): 检索 RSS 源",
    parameters: rssParams,
    async execute(_id, params) {
      const limit = params.limit ?? 10;
      const all: DataSourceItem[] = [];
      await Promise.all(
        ctx.rssFeeds.map((f) =>
          fetchRss(f.feedUrl, {
            sourceName: f.sourceName,
            tags: (params.tags ?? ctx.config.tagPrefs) as never,
            timeRange: ctx.config.timeRange,
            keywords: params.keywords,
            limit,
          })
            .then((items) => all.push(...items))
            .catch(() => {}),
        ),
      );
      ctx.onItems?.(all, "fetch_rss");
      const summary = `RSS 检索命中 ${all.length} 条（${ctx.rssFeeds.length} 源）`;
      return {
        content: [{ type: "text" as const, text: formatItems("rss", summary, all) }],
        details: { found: all.length, sourceCount: ctx.rssFeeds.length },
      };
    },
  });

  const extractTool = defineTool({
    name: "extract_content",
    label: "提取正文",
    description: "提取某个 URL 的正文（markdown）。对关键信号深入阅读时调用。fallback 链：Jina→Firecrawl→本地。",
    promptSnippet: "extract_content({url}): 提取网页正文",
    parameters: extractParams,
    async execute(_id, params) {
      const res = await extractContent(params.url);
      return {
        content: [{ type: "text" as const, text: `# ${res.title ?? "(无标题)"}\n\n来源: ${res.url} (引擎: ${res.engine})\n\n${res.content}` }],
        details: { engine: res.engine, url: res.url, length: res.content.length },
      };
    },
  });

  const listTool = defineTool({
    name: "list_datasources",
    label: "列出数据源",
    description: "列出当前可用的数据源（搜索引擎 / 爬虫平台 / RSS 源），帮助决定调用哪些工具。",
    promptSnippet: "list_datasources(): 列出可用数据源",
    parameters: listDatasourcesParams,
    async execute() {
      const lines: string[] = ["## 可用数据源", ""];
      lines.push("**搜索引擎（search）**：DuckDuckGo, Exa, Firecrawl");
      lines.push(`**爬虫平台（crawl）**：${(ctx.enabledPlatforms ?? []).join(", ") || "(无)"}`);
      lines.push(`**RSS 源（fetch_rss）**：${ctx.rssFeeds.map((f) => `${f.sourceName}`).join(", ") || "(无)"}`);
      lines.push(`**当前时间窗**：${ctx.config.timeRange}  **标签偏好**：${ctx.config.tagPrefs.join(",")}`);
      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        details: {},
      };
    },
  });

  const saveReportTool = defineTool({
    name: "save_report",
    label: "交付报告",
    description: "交付洞察报告。综合研判后调用此工具，把报告 markdown 提交。这是洞察的核心交付动作。",
    promptSnippet: "save_report({title,markdown}): 交付洞察报告（核心交付动作）",
    parameters: saveReportParams,
    async execute(_id, params) {
      await ctx.saveReport({ title: params.title, markdown: params.markdown });
      return {
        content: [{ type: "text" as const, text: `报告「${params.title}」已交付。可在报告页查看。` }],
        details: { saved: true, title: params.title },
      };
    },
  });

  return [searchTool, crawlTool, rssTool, extractTool, listTool, saveReportTool];
}

/** 把 DataSourceItem[] 格式化为给 LLM 看的紧凑文本。 */
function formatItems(tool: string, summary: string, items: DataSourceItem[]): string {
  if (items.length === 0) return `${summary}\n\n(无结果)`;
  const rows = items
    .slice(0, 30)
    .map((it, i) => {
      const heat = it.heat != null ? ` [热度${it.heat}]` : "";
      const date = it.publishedAt ? ` (${it.publishedAt.slice(0, 10)})` : "";
      const src = `「${it.sourceName}」`;
      const summary = it.summary ? ` — ${it.summary.slice(0, 120)}` : "";
      return `${i + 1}. ${src}${it.title}${heat}${date}${summary}\n   ${it.url}`;
    })
    .join("\n");
  return `${summary}\n\n${rows}`;
}
