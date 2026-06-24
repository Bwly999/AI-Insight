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
import type { AgentEvent, DataSourceItem } from "@ai-insight/shared-types";
import {
  createInsightSession,
  createInsightTools,
  bridgeSessionEvents,
  type AgentProviderConfig,
} from "@ai-insight/agent";
import {
  createDefaultEngines,
  createDefaultCrawlers,
} from "@ai-insight/datasources";
import * as repo from "../repo.js";
import { config } from "../config.js";
import { renderReportHtml, extractStandfirst } from "../report-renderer.js";

export interface ExecutorDeps {
  provider: AgentProviderConfig;
}

/** 创建注入到 Runner 的执行器。 */
export function createAgentExecutor(deps: ExecutorDeps): RunExecutor {
  return async (ctx: RunContext, emit) => {
    const run = repo.getRun(ctx.runId);
    if (!run) throw new Error(`run not found: ${ctx.runId}`);

    repo.updateRun(ctx.runId, { status: "running", startedAt: new Date().toISOString() });
    emit({ type: "run_started", runId: ctx.runId, prompt: run.prompt });

    // 收集本轮工具命中的信号（供统计；MVP 暂不落库，只 log）
    const collectedItems: DataSourceItem[] = [];

    // save_report 回调：渲染 HTML + 落库 + emit report_created
    const saved: { id: string; title: string }[] = [];
    const saveReport = async (data: { title: string; markdown: string }) => {
      const standfirst = extractStandfirst(data.markdown);
      const html = renderReportHtml({
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

    // 自定义工具
    const tools = createInsightTools({
      config: run.config,
      engines: createDefaultEngines(),
      crawlers: createDefaultCrawlers(),
      rssFeeds,
      enabledPlatforms,
      saveReport,
      onItems: (items) => collectedItems.push(...items),
    });

    // 建 session（缓存复用）
    const session = await createInsightSession(deps.provider, tools);

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
    }
  };
}

/** 从 config 构造 provider 配置。 */
export function providerFromConfig(): AgentProviderConfig {
  return {
    providerName: config.llm.providerName,
    baseUrl: config.llm.baseUrl,
    apiKey: config.llm.apiKey,
    model: config.llm.model,
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
