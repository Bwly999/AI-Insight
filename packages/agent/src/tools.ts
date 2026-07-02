/**
 * 自定义工具 — defineTool(TypeBox 参数)。
 *
 * 每个工具是工厂函数，闭包绑定该 Run 的上下文（config、report 回调）。
 * 返回 ToolDefinition[]，注入 createInsightSession 的 customTools。
 * 当前启用 5 个：search / extract_content / list_datasources / save_report / ask。
 * crawlTool / rssTool 实现保留但暂未返回（createInsightTools 末尾），便于后续恢复。
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
import type {
  ConversationConfig,
  DataSourceItem,
  DataSourceTag,
  TimeRange,
} from "@ai-insight/shared-types";

/** 工具上下文（绑定到一次 Run）。 */
export interface ToolContext {
  /** Run 配置（时间范围、lens）。 */
  config: ConversationConfig;
  /** 搜索引擎实例（注入便于测试/复用）。 */
  engines?: SearchEngine[];
  /** 爬虫适配器实例。 */
  crawlers?: CrawlerAdapter[];
  /** RSS 源：feedUrl → { sourceName, tags }。MVP 从 data_sources 取。（crawl/rss 暂停，可选） */
  rssFeeds?: { feedUrl: string; sourceName: string; tags: DataSourceTag[] }[];
  /** 启用的爬虫平台 id 列表。 */
  enabledPlatforms?: string[];
  /** save_report 回调：把报告落库（由 server 注入）。 */
  saveReport: (data: { title: string; markdown: string }) => Promise<void>;
  /** RSS 索引检索（FTS5 优先 + 即时 fetch 回退），由 server 注入；不注入则工具内回退即时 fetch。 */
  searchRssIndex?: (opts: {
    keywords?: string[];
    tags?: DataSourceTag[];
    timeRange?: TimeRange;
    limit?: number;
  }) => Promise<DataSourceItem[]>;
  /** 工具命中信号收集（供证据面板/统计）。 */
  onItems?: (items: DataSourceItem[], toolName: string) => void;
  /**
   * 分配全局引用编号（per-conversation 累加）：给 count 个 item 预留连续编号，返回起始编号（0-based）。
   * formatItems 显示 startNo + i + 1，并写回 item.citeNo。LLM 据此在报告里写 [n]。
   * server 注入：首次调用时从 Pi 会话历史派生基数，后续递增。不注入时回退为 per-call 0（仅测试）。
   */
  nextCiteNoBase?: (count: number) => number;
  /**
   * 暂停运行以向用户请求澄清（Claude-Code 式暂停/恢复）。
   * server 注入：emit clarification_needed + 进 awaiting_input，返回用户回复文本。
   * 未注入时（测试/独立运行）ask 工具退化为「不阻塞」并提示模型自行假设。
   */
  awaitInput?: (inputId: string, question: string, options?: string[]) => Promise<string>;
}

// ─── 工具参数 schema ──────────────────────────────────────────────────────
const searchParams = Type.Object({
  query: Type.String({ description: "搜索查询词（建议用英文/中英混合以提高命中率）" }),
  tags: Type.Optional(Type.Array(Type.String(), { description: "按标签过滤（可选）" })),
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

const askParams = Type.Object({
  question: Type.String({ description: "向用户提出的问题（如澄清意图、选择视角候选）。务必清晰、给出必要的上下文。" }),
  options: Type.Optional(
    Type.Array(Type.String(), { description: "可选的候选答案（2–3 个，附一句话理由更佳）。不传则为开放式提问。" }),
  ),
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
          tags: params.tags as never,
          perEngineLimit: limit,
        },
        ctx.engines,
      );
      ctx.onItems?.(items, "search");
      const summary = `搜索「${params.query}」命中 ${items.length} 条（${Object.entries(perEngine).map(([k, v]) => `${k}:${v}`).join(", ")}）`;
      const startNo = ctx.nextCiteNoBase?.(items.length) ?? 0;
      return {
        content: [{ type: "text" as const, text: formatItems("search", summary, items, startNo) }],
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
        },
        ctx.crawlers,
      );
      ctx.onItems?.(items, "crawl");
      const summary = `抓取热点命中 ${items.length} 条（${Object.entries(perPlatform).map(([k, v]) => `${k}:${v}`).join(", ")}）`;
      const startNo = ctx.nextCiteNoBase?.(items.length) ?? 0;
      return {
        content: [{ type: "text" as const, text: formatItems("crawl", summary, items, startNo) }],
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
      const tags = params.tags as never;
      let items: DataSourceItem[];
      if (ctx.searchRssIndex) {
        // server 注入：FTS5 索引优先，零结果回退即时 fetch 并写回索引
        items = await ctx.searchRssIndex({
          keywords: params.keywords,
          tags,
          timeRange: ctx.config.timeRange,
          limit,
        });
      } else {
        // 无注入（测试/独立运行）：回退即时 fetch
        items = [];
        await Promise.all(
          (ctx.rssFeeds ?? []).map((f) =>
            fetchRss(f.feedUrl, {
              sourceName: f.sourceName,
              tags,
              timeRange: ctx.config.timeRange,
              keywords: params.keywords,
              limit,
            })
              .then((its) => items.push(...its))
              .catch(() => {}),
          ),
        );
      }
      ctx.onItems?.(items, "fetch_rss");
      const feeds = ctx.rssFeeds ?? [];
      const summary = `RSS 检索命中 ${items.length} 条（${feeds.length} 源）`;
      const startNo = ctx.nextCiteNoBase?.(items.length) ?? 0;
      return {
        content: [{ type: "text" as const, text: formatItems("rss", summary, items, startNo) }],
        details: { found: items.length, sourceCount: feeds.length },
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
    description: "列出当前可用的数据源（搜索引擎），帮助决定调用哪些工具。",
    promptSnippet: "list_datasources(): 列出可用数据源",
    parameters: listDatasourcesParams,
    async execute() {
      const lines: string[] = ["## 可用数据源", ""];
      lines.push("**搜索引擎（search）**：DuckDuckGo, Exa, Firecrawl");
      lines.push(`**当前时间窗**：${ctx.config.timeRange}`);
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

  const askTool = defineTool({
    name: "ask",
    label: "向用户提问",
    description:
      "向用户请求澄清。当意图同时匹配多个 Lens、或信息不足以判断时，用此工具反问用户（给 2–3 个候选 + 各一句话理由让用户选）。调用后会暂停运行等待用户回复，回复文本作为本工具结果返回，你据此继续。仅在真正需要澄清时用，能合理推断时不要滥用。",
    promptSnippet: "ask({question,options?}): 反问用户澄清意图（会暂停等待回复）",
    parameters: askParams,
    async execute(_id, params): Promise<{
      content: { type: "text"; text: string }[];
      details: { awaiting: boolean; inputId?: string };
    }> {
      if (!ctx.awaitInput) {
        // 无注入（测试/独立运行）：退化为不阻塞，提示模型自行合理假设
        return {
          content: [
            {
              type: "text",
              text: "(当前运行环境不支持向用户提问。请基于已给信息做最合理推断，并在报告中标注假设。)",
            },
          ],
          details: { awaiting: false },
        };
      }
      const inputId = `ask_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const reply = await ctx.awaitInput(inputId, params.question, params.options);
      return {
        content: [{ type: "text", text: `用户回复：${reply}` }],
        details: { awaiting: true, inputId },
      };
    },
  });

  // crawlTool / rssTool 暂停启用（实现保留，便于后续恢复）。返回 5 个工具。
  return [searchTool, extractTool, listTool, saveReportTool, askTool];
}

/** 把 DataSourceItem[] 格式化为给 LLM 看的紧凑文本。
 *  startNo：全局引用编号基数（0-based），序号显示为 startNo + i + 1 并写回 item.citeNo。 */
function formatItems(tool: string, summary: string, items: DataSourceItem[], startNo = 0): string {
  if (items.length === 0) return `${summary}\n\n(无结果)`;
  const rows = items
    .slice(0, 30)
    .map((it, i) => {
      it.citeNo = startNo + i + 1; // 写回全局编号，供后续 citeNo 派生/渲染对齐
      const heat = it.heat != null ? ` [热度${it.heat}]` : "";
      const date = it.publishedAt ? ` (${it.publishedAt.slice(0, 10)})` : "";
      const src = `「${it.sourceName}」`;
      // summary 去换行保证反解析稳定（citations.ts parseFormatItems 按行拆分）
      const sm = it.summary ? ` — ${it.summary.slice(0, 120).replace(/[\r\n]+/g, " ")}` : "";
      return `${startNo + i + 1}. ${src}${it.title}${heat}${date}${sm}\n   ${it.url}`;
    })
    .join("\n");
  return `${summary}\n\n${rows}`;
}
