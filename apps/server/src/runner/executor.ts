/**
 * Runner 执行器 — 把 Agent 接入 Runner：建 session → prompt → 事件桥接 → save_report 落库。
 *
 * 关键点（设计 §3.2，Pi 原生持久化版）：
 *  - Conversation = 一个 Pi SessionManager session（.jsonl 文件）。
 *  - 历史由 Pi 原生 buildSessionContext() 在 createAgentSession 内自动注水（与回放路径一致）。
 *  - 消息落库交给 Pi SessionManager（message_end 时 appendMessage），不再旁路写 DB。
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
import { createDefaultEngines, type EngineConfig } from "@ai-insight/datasources";
import { config } from "../config.js";
import * as repo from "../repo.js";
import { renderReportHtml, extractStandfirst } from "../report-renderer.js";
import { resolveAwaiting, rejectPending } from "./pending-inputs.js";

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
      saveReport,
      onItems: (items, toolName) =>
        collectedItems.push(...items.map((item) => ({ item, toolName }))),
      // ask 工具：暂停运行等待用户澄清（Claude-Code 式）。回复经 pending-inputs 传递。
      // 落库由 Pi SessionManager 自动处理：ask 作为普通 tool_call 进 .jsonl，
      // 用户回复作为 ToolResultMessage.content 自动 appendMessage（question/options 在 args 里）。
      awaitInput: (inputId, question, options) => {
        repo.updateRun(ctx.runId, { status: "awaiting_input" });
        emit({ type: "clarification_needed", runId: ctx.runId, inputId, question, ...(options ? { options } : {}) });
        return resolveAwaiting(ctx.runId, inputId);
      },
    });

    // 取 conversation 的 sessionFile（首条消息时为空，后续运行时恢复历史）
    const conversation = repo.getConversation(run.conversationId);
    const existingSessionFile = conversation?.sessionFile;

    // 建 session（每 run 独立；provider 惰性读取支持热切换）
    // skillDir：让 ai-insight skill 经 loader 渐进披露（见 ADR-0006）
    // onLensSelected：模型 read 某 Lens 的 reference 时触发，暴露 Agent 实际选用的视角
    // sessionDir + sessionFile：Pi 原生 SessionManager 持久化（.jsonl）。
    //   createAgentSession 内部会用 buildSessionContext() 自动注水历史到 agent.state.messages，
    //   与 getConversationWithMessages 的回放路径完全一致。
    const session = await createInsightSession(deps.getProvider(), tools, {
      skillDir: config.skillDir,
      sessionDir: config.sessionDir,
      sessionFile: existingSessionFile,
      onLensSelected: (lens) => {
        // 回写 DB（让后续历史/lastRun 反映 Agent 实际选择）+ emit 事件
        repo.updateRun(ctx.runId, { lens });
        emit({ type: "lens_selected", runId: ctx.runId, lens });
      },
    });

    // 首次运行：把 Pi 分配的 .jsonl 路径回写到 conversations.session_file，
    // 后续运行（含回放）凭此路径用 SessionManager.open 恢复历史。
    if (!existingSessionFile) {
      const sf = session.sessionManager.getSessionFile();
      if (sf) repo.updateConversationSessionFile(run.conversationId, sf);
    }

    // 事件桥接 → emit AgentEvent（透传前端实时流）。
    // 落库完全交给 Pi SessionManager（message_end 时 appendMessage），不再旁路写 DB。
    const unsubscribe = bridgeSessionEvents(session, ctx.runId, (ev: AgentEvent) => {
      emit(ev);
    });

    // 构造本轮 prompt：当前洞察请求 + 配置提示。
    // 历史由 Pi buildSessionContext() 自动注入（见上），无需在 prompt 里拼接。
    const configHint = `（本轮洞察配置：时间窗=${run.config.timeRange}，视角=${run.lens ?? "智能路由（由 Agent 按意图判定）"}）`;
    const fullPrompt = `${run.prompt}\n${configHint}`;

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

      // 消息已由 Pi SessionManager 在 message_end 时 appendMessage 落入 .jsonl。
      // 此处只更新 run 状态 + emit，不再旁路写 DB。
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

      // 中止：本轮已生成的部分由 Pi SessionManager 增量落盘，交给 abort 路由置 interrupted
      if (ctx.signal.aborted) return;

      // 失败：置 failed 状态（错误信息经 run_failed 事件传给前端，不旁路写消息）
      repo.updateRun(ctx.runId, {
        status: "failed",
        endedAt: new Date().toISOString(),
        error: msg,
      });
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

