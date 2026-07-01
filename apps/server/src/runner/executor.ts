/**
 * Runner 执行器 — 把 Agent 接入 Runner：建 session → 注水历史 → prompt → 事件桥接 → save_report 落库。
 *
 * 关键点（设计 §3.2）：
 *  - Conversation = 一个 session；消息历史以 DB 为唯一真相源。
 *  - 每轮从 DB 注水历史 + 新消息 → session.prompt()。
 *  - SessionManager.inMemory（持久化归 DB 管）。
 *  - save_report 工具回调 → 渲染 standalone HTML → 写 reports 行。
 */
import type { RunExecutor, RunContext } from "./index.js";
import type { AgentEvent, DataSourceItem, DataSourceTag, TimeRange } from "@ai-insight/shared-types";
import {
  createInsightSession,
  createInsightTools,
  bridgeSessionEvents,
  type AgentProviderConfig,
} from "@ai-insight/agent";
import { createDefaultEngines, createDefaultCrawlers, fetchRss, type EngineConfig } from "@ai-insight/datasources";
import { config } from "../config.js";
import * as repo from "../repo.js";
import { renderReportHtml, extractStandfirst } from "../report-renderer.js";

export interface ExecutorDeps {
  /** 惰性取 provider（每 run 调用，支持 settings 热切换；apiKey 仍 env-only）。 */
  getProvider: () => AgentProviderConfig;
}

/** 创建注入到 Runner 的执行器。 */
export function createAgentExecutor(deps: ExecutorDeps): RunExecutor {
  return async (ctx: RunContext, emit) => {
    const run = repo.getRun(ctx.runId);
    if (!run) throw new Error(`run not found: ${ctx.runId}`);

    repo.updateRun(ctx.runId, { status: "running", startedAt: new Date().toISOString() });
    emit({ type: "run_started", runId: ctx.runId, prompt: run.prompt });

    // 收集本轮工具命中的信号（带 toolName；run 结束持久化为 run_items）
    const collectedItems: { item: DataSourceItem; toolName: string }[] = [];

    // save_report 回调：渲染 HTML + 落库 + emit report_created
    const saved: { id: string; title: string }[] = [];
    const saveReport = async (data: { title: string; markdown: string }) => {
      const standfirst = extractStandfirst(data.markdown);
      const html = await renderReportHtml({
        title: data.title,
        markdown: data.markdown,
        standfirst,
      });
      const report = repo.createReport(ctx.runId, run.conversationId, {
        title: data.title,
        standfirst,
        markdown: data.markdown,
        html,
      });
      const savedReport = { id: report.id, title: report.title };
      saved.push(savedReport);
      emit({
        type: "report_created",
        runId: ctx.runId,
        report: {
          ...report,
          // html 太大，SSE 只传摘要（前端通过 /reports/:id 取全文）
          html: `<!-- standalone HTML, ${report.html.length} chars → GET /api/reports/${report.id}/html -->`,
        },
      });
    };

    // 启用的爬虫平台（从 data_sources 取）
    const enabledPlatforms = repo.getEnabledCrawlerPlatforms();
    // RSS 源（从 data_sources 取 type=rss）
    const rssFeeds = repo
      .listDataSources("rss")
      .filter((d) => d.enabled)
      .map((d) => ({
        feedUrl: (d.config as { feedUrl?: string }).feedUrl ?? "",
        sourceName: d.name,
        tags: d.tags,
      }))
      .filter((f) => f.feedUrl);

    // RSS 索引检索：FTS5 优先；零结果且有关键词 → 回退即时 fetch 并写回索引（自愈）
    const searchRssIndex = async (opts: {
      keywords?: string[];
      tags?: DataSourceTag[];
      timeRange?: TimeRange;
      limit?: number;
    }): Promise<DataSourceItem[]> => {
      const ftsItems = repo.searchDataSourceItemsFts({
        keywords: opts.keywords,
        timeRange: opts.timeRange,
        tags: opts.tags,
        limit: opts.limit,
      });
      if (ftsItems.length) return ftsItems;
      if (!opts.keywords?.length) return [];
      const all: DataSourceItem[] = [];
      await Promise.all(
        rssFeeds.map((f) =>
          fetchRss(f.feedUrl, {
            sourceName: f.sourceName,
            tags: (opts.tags ?? []) as never,
            timeRange: opts.timeRange,
            keywords: opts.keywords,
            limit: opts.limit,
          })
            .then((its) => all.push(...its))
            .catch(() => {}),
        ),
      );
      if (all.length) repo.upsertDataSourceItems(all);
      return all;
    };

    // 显式构造 EngineConfig（数据源 key 来自 server env config，见 ADR-0004 / 设计 §4.1）
    // 与 CLI 的 JSON config 永不相交（模型 B：分层真相源）。
    const engineConfig: EngineConfig = {
      exaApiKey: config.exaApiKey,
      firecrawlApiKey: config.firecrawlApiKey,
      jinaApiKey: config.jinaApiKey,
      // jinaUrl / proxyUrl：server 路径不设（代理已在 main.ts 全局 configureProxy）
    };

    // 自定义工具
    const tools = createInsightTools({
      config: run.config,
      engines: createDefaultEngines(engineConfig),
      crawlers: createDefaultCrawlers(),
      rssFeeds,
      enabledPlatforms,
      saveReport,
      searchRssIndex,
      onItems: (items, toolName) =>
        collectedItems.push(...items.map((item) => ({ item, toolName }))),
    });

    // 建 session（每 run 独立；provider 惰性读取支持热切换）
    const session = await createInsightSession(deps.getProvider(), tools);

    // 事件桥接 → emit AgentEvent
    const unsubscribe = bridgeSessionEvents(session, ctx.runId, (ev: AgentEvent) => {
      emit(ev);
    });

    // 注水对话历史（把该 conversation 的历史 user/assistant 消息拼成上下文）
    const history = repo.listMessages(run.conversationId)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => {
        const c = m.content;
        if (c.kind === "text") return `${m.role === "user" ? "用户" : "分析师"}: ${c.text}`;
        return null;
      })
      .filter(Boolean);

    // 构造本轮 prompt：历史 + 当前洞察请求 + 配置提示
    const configHint = `（本轮洞察配置：时间窗=${run.config.timeRange}，标签偏好=${run.config.tagPrefs.join("/")}，视角=${run.lens ?? "deep"}）`;
    const fullPrompt =
      history.length > 1
        ? `## 此前对话\n${history.slice(0, -1).join("\n")}\n\n## 本次洞察请求\n${run.prompt}\n${configHint}`
        : `${run.prompt}\n${configHint}`;

    try {
      await session.prompt(fullPrompt);
      unsubscribe();

      // token 用量（Pi 的 getSessionStats；不可用则留空，不造假）
      let tokens: number | undefined;
      try {
        const stats = session.getSessionStats();
        if (typeof stats?.tokens?.total === "number") tokens = stats.tokens.total;
      } catch {
        // getSessionStats 不可用则跳过
      }

      // 提取 agent 本轮的对话文本（非工具调用的 assistant text）
      const convoText = extractAssistantText(session.messages);
      const lastSaved = saved[saved.length - 1];
      const summaryText = lastSaved
        ? `已交付洞察报告「${lastSaved.title}」`
        : `洞察运行结束（未生成报告）。本轮共采集 ${collectedItems.length} 条信号。`;
      repo.addMessage(run.conversationId, "assistant", {
        kind: "text",
        text: convoText ? `${convoText}\n\n— ${summaryText}` : summaryText,
      });

      repo.updateRun(ctx.runId, {
        status: "completed",
        endedAt: new Date().toISOString(),
        ...(tokens != null && { tokens }),
      });
      emit({ type: "run_completed", runId: ctx.runId });
    } catch (e) {
      unsubscribe();
      const msg = (e as Error).message;
      repo.updateRun(ctx.runId, {
        status: "failed",
        endedAt: new Date().toISOString(),
        error: msg,
      });
      repo.addMessage(run.conversationId, "assistant", {
        kind: "text",
        text: `洞察运行失败：${msg}`,
      });
      emit({ type: "run_failed", runId: ctx.runId, error: msg });
    } finally {
      // 持久化本轮采集的信号条目（无论成败，供证据面板/调试；上限 50）
      if (collectedItems.length) {
        try {
          repo.recordRunItems(ctx.runId, collectedItems.slice(0, 50));
        } catch {
          // 落库失败不阻断 run 结束流程
        }
      }
    }
  };
}

/** 从 AgentMessage[] 提取最后一条 assistant 消息的文本（拼接所有 TextContent）。 */
function extractAssistantText(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  // 从后往前找最后一条 assistant 消息
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as { role?: string; content?: unknown };
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    const text = m.content
      .filter((c) => (c as { type?: string }).type === "text")
      .map((c) => (c as { text?: string }).text ?? "")
      .join("");
    if (text.trim()) return text.trim();
  }
  return "";
}
