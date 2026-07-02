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
import { resolveAwaiting, rejectPending } from "./pending-inputs.js";

// ─── Block 累积器（与前端 blocks.ts 同构，用于 run 结束时按顺序持久化）─────────
/** 一个 assistant turn 的有序块（思考 / 回复 / 工具）。 */
type SrvBlock =
  | { kind: "thinking"; text: string }
  | { kind: "text"; text: string }
  | { kind: "tool"; toolCallId: string; toolName: string; args: Record<string, unknown>; found?: number; ok?: boolean; durationMs?: number };

/** 把 AgentEvent 累积进 blocks（末块同类合并：thinking/text 同类追加、异类新建；tool 新建/就地回填）。 */
function reduceBlock(blocks: SrvBlock[], ev: AgentEvent): SrvBlock[] {
  switch (ev.type) {
    case "thinking_delta":
    case "text_delta": {
      const kind = ev.type === "thinking_delta" ? "thinking" : "text";
      const next = blocks.slice();
      const last = next[next.length - 1];
      if (last && last.kind === kind) next[next.length - 1] = { ...last, text: last.text + ev.text };
      else next.push({ kind, text: ev.text });
      return next;
    }
    case "tool_call_start": {
      if (blocks.some((b) => b.kind === "tool" && b.toolCallId === ev.toolCallId)) return blocks;
      return blocks.slice().concat({ kind: "tool", toolCallId: ev.toolCallId, toolName: ev.toolName, args: ev.args });
    }
    case "tool_call_end": {
      const idx = blocks.findIndex((b) => b.kind === "tool" && b.toolCallId === ev.toolCallId);
      if (idx < 0) return blocks;
      const next = blocks.slice();
      const t = next[idx];
      if (t.kind === "tool") next[idx] = { ...t, found: ev.found, ok: ev.ok, durationMs: ev.durationMs };
      return next;
    }
    default:
      return blocks;
  }
}

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
      // ask 工具：暂停运行等待用户澄清（Claude-Code 式）。回复经 pending-inputs 传递。
      awaitInput: (inputId, question, options) => {
        // 落一条 clarification 消息（历史回看）+ 进 awaiting_input + emit 事件
        repo.addMessage(run.conversationId, "assistant", {
          kind: "clarification",
          inputId,
          question,
          ...(options ? { options } : {}),
        });
        repo.updateRun(ctx.runId, { status: "awaiting_input" });
        emit({ type: "clarification_needed", runId: ctx.runId, inputId, question, ...(options ? { options } : {}) });
        return resolveAwaiting(ctx.runId, inputId);
      },
    });

    // 建 session（每 run 独立；provider 惰性读取支持热切换）
    // skillDir：让 ai-insight skill 经 loader 渐进披露（见 ADR-0006）
    // onLensSelected：模型 read 某 Lens 的 reference 时触发，暴露 Agent 实际选用的视角
    const session = await createInsightSession(deps.getProvider(), tools, {
      skillDir: config.skillDir,
      onLensSelected: (lens) => {
        // 回写 DB（让后续历史/lastRun 反映 Agent 实际选择）+ emit 事件
        repo.updateRun(ctx.runId, { lens });
        emit({ type: "lens_selected", runId: ctx.runId, lens });
      },
    });

    // 事件桥接 → emit AgentEvent + 累积 blocks（run 结束时按顺序持久化，历史回看还原 AgentLoop）
    const accumulatedBlocks: SrvBlock[] = [];
    const unsubscribe = bridgeSessionEvents(session, ctx.runId, (ev: AgentEvent) => {
      // 就地累积（reduceBlock 返回新数组，但这里维护同一个数组引用）
      const reduced = reduceBlock(accumulatedBlocks, ev);
      accumulatedBlocks.length = 0;
      accumulatedBlocks.push(...reduced);
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
    const configHint = `（本轮洞察配置：时间窗=${run.config.timeRange}，标签偏好=${run.config.tagPrefs.join("/")}，视角=${run.lens ?? "智能路由（由 Agent 按意图判定）"}）`;
    const fullPrompt =
      history.length > 1
        ? `## 此前对话\n${history.slice(0, -1).join("\n")}\n\n## 本次洞察请求\n${run.prompt}\n${configHint}`
        : `${run.prompt}\n${configHint}`;

    // abort：中止 session（让 prompt() 抛出）+ 释放可能挂起的 awaiting
    const onAbort = () => {
      rejectPending(ctx.runId, new Error("运行已中止"));
      session.abort().catch(() => {});
    };
    if (ctx.signal.aborted) onAbort();
    else ctx.signal.addEventListener("abort", onAbort, { once: true });

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

      // 按顺序持久化本轮累积的 blocks（thinking / tool_result / text），
      // 让历史回看能还原完整 AgentLoop（思考→工具→回复 一块一块）。全部关联到本 run。
      const lastSaved = saved[saved.length - 1];
      const summaryText = lastSaved
        ? `已交付洞察报告「${lastSaved.title}」`
        : `洞察运行结束（未生成报告）。本轮共采集 ${collectedItems.length} 条信号。`;

      // 兜底：若累积为空（如未桥接上），回退提取最终 assistant 文本
      if (accumulatedBlocks.length === 0) {
        const convoText = extractAssistantText(session.messages);
        repo.addMessage(
          run.conversationId,
          "assistant",
          { kind: "text", text: convoText ? `${convoText}\n\n— ${summaryText}` : summaryText },
          { runId: ctx.runId },
        );
      } else {
        // 找到最后一个 text block 的索引，用于追加 summary
        let lastTextIdx = -1;
        for (let i = accumulatedBlocks.length - 1; i >= 0; i--) {
          if (accumulatedBlocks[i].kind === "text") {
            lastTextIdx = i;
            break;
          }
        }
        accumulatedBlocks.forEach((b, i) => {
          if (b.kind === "thinking") {
            repo.addMessage(run.conversationId, "assistant", { kind: "thinking", text: b.text }, { runId: ctx.runId });
          } else if (b.kind === "tool") {
            repo.addMessage(
              run.conversationId,
              "assistant",
              {
                kind: "tool_result",
                toolName: b.toolName,
                summary: b.found != null ? `查询到 ${b.found} 条数据` : b.ok ? "完成" : "失败",
                ...(b.found != null && { found: b.found }),
                args: b.args,
                ...(b.durationMs != null && { durationMs: b.durationMs }),
              },
              {
                runId: ctx.runId,
                toolCall: {
                  toolName: b.toolName,
                  args: b.args,
                  ...(b.found != null && { found: b.found }),
                  ...(b.durationMs != null && { durationMs: b.durationMs }),
                },
              },
            );
          } else {
            // text：最后一个 text block 追加 summary
            const text = i === lastTextIdx ? `${b.text}\n\n— ${summaryText}` : b.text;
            repo.addMessage(run.conversationId, "assistant", { kind: "text", text }, { runId: ctx.runId });
          }
        });
        // 若本轮没有任何 text block（纯工具/思考），补一条 summary
        if (lastTextIdx < 0) {
          repo.addMessage(run.conversationId, "assistant", { kind: "text", text: summaryText }, { runId: ctx.runId });
        }
      }

      repo.updateRun(ctx.runId, {
        status: "completed",
        endedAt: new Date().toISOString(),
        ...(tokens != null && { tokens }),
      });
      emit({ type: "run_completed", runId: ctx.runId });
    } catch (e) {
      unsubscribe();
      // 若是中止/超时导致 ask 阻塞被 reject，这里统一兜底清理 pending
      rejectPending(ctx.runId, new Error("运行失败"));
      const msg = (e as Error).message;
      // 中止：status/endedAt 由 abort 路由置 interrupted；此处仅清理，不再 emit（SSE 由路由收尾）
      if (ctx.signal.aborted) return;
      repo.updateRun(ctx.runId, {
        status: "failed",
        endedAt: new Date().toISOString(),
        error: msg,
      });
      repo.addMessage(
        run.conversationId,
        "assistant",
        { kind: "text", text: `洞察运行失败：${msg}` },
        { runId: ctx.runId },
      );
      emit({ type: "run_failed", runId: ctx.runId, error: msg });
    } finally {
      ctx.signal.removeEventListener("abort", onAbort);
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
