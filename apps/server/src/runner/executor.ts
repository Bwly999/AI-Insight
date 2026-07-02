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

// ─── Block 派生（从 session.messages 单一真相源派生有序块）─────────────────────
/**
 * 一个 assistant turn 的有序块（思考 / 回复 / 工具），落库用。
 * 设计上与 Pi 的 session.messages 解耦：派生函数只依赖 messages 的结构形态，
 * 不引入对 pi-ai 类型的硬依赖（executor 仅依赖 @ai-insight/agent）。
 */
type SrvBlock =
  | { kind: "thinking"; text: string }
  | { kind: "text"; text: string }
  | {
      kind: "tool";
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
      found?: number;
      ok?: boolean;
      durationMs?: number;
    };

/**
 * session.messages 条目的结构化形态（duck-typed，对齐 pi-ai 的 AssistantMessage / ToolResultMessage）。
 * - AssistantMessage.content[i] ∈ { type:"thinking", thinking } | { type:"text", text } | { type:"toolCall", id, name, arguments }
 * - ToolResultMessage 带 toolCallId / details.found / isError
 */
export interface MessageLike {
  role?: string;
  // content 用 unknown[] + 运行时类型守卫收窄，避免字面量联合被 { type:string } 吸收导致收窄失效
  content?: unknown[];
  toolCallId?: string;
  toolName?: string;
  details?: { found?: number };
  isError?: boolean;
}

// ─── content 元素类型守卫（content 声明为 unknown[]，靠守卫收窄）──────────────
const isThinking = (c: unknown): c is { type: "thinking"; thinking: string } =>
  !!c && typeof c === "object" && (c as { type?: string }).type === "thinking" &&
  typeof (c as { thinking?: unknown }).thinking === "string";

const isText = (c: unknown): c is { type: "text"; text: string } =>
  !!c && typeof c === "object" && (c as { type?: string }).type === "text" &&
  typeof (c as { text?: unknown }).text === "string";

const isToolCall = (c: unknown): c is { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> } =>
  !!c && typeof c === "object" && (c as { type?: string }).type === "toolCall" &&
  typeof (c as { id?: unknown }).id === "string" &&
  typeof (c as { name?: unknown }).name === "string";

/**
 * 从 session.messages（本轮生成内容，不含注水的历史）派生有序 SrvBlock[]。
 *
 * Pi 的一次 prompt 内：模型流式输出思考+文本，遇工具调用时当前 AssistantMessage 以
 * stopReason:"toolUse" 结束，工具执行后下一轮生成新的 AssistantMessage。因此 messages 是
 * 多条 AssistantMessage 与 ToolResultMessage 交替的序列。
 *
 * 遍历策略：
 *  - AssistantMessage：按 content 顺序映射 thinking/text/toolCall 各为一块
 *    （思考/回复块直接产出；toolCall 块先记下，由后续 ToolResultMessage 按 id 回填 found/ok）
 *  - ToolResultMessage：在 durations Map 取耗时、details.found 取命中数、isError 取反得 ok
 *  - 连续的同类块（如多段思考）保持原序，不做合并——回放时按真实顺序逐块呈现更准确
 *
 * durations 来自桥接层的薄订阅（Map<toolCallId, ms>）；缺失时该工具块不带耗时，UI 不显示。
 */
export function deriveBlocksFromMessages(
  messages: MessageLike[],
  durations: Map<string, number>,
): SrvBlock[] {
  const blocks: SrvBlock[] = [];
  /** toolCallId → 在 blocks 中的索引，便于 ToolResultMessage 回填。 */
  const toolIdx = new Map<string, number>();

  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.content)) {
      for (const c of m.content) {
        // 类型守卫收窄（content 是 unknown[]，避免联合吸收问题）
        if (isThinking(c)) {
          blocks.push({ kind: "thinking", text: c.thinking });
        } else if (isText(c)) {
          // 跳过空文本块（模型有时会产空 TextContent）
          if (c.text) blocks.push({ kind: "text", text: c.text });
        } else if (isToolCall(c)) {
          toolIdx.set(c.id, blocks.length);
          blocks.push({ kind: "tool", toolCallId: c.id, toolName: c.name, args: c.arguments });
        }
      }
    } else if (m.role === "toolResult" && m.toolCallId) {
      const idx = toolIdx.get(m.toolCallId);
      if (idx == null) continue;
      const b = blocks[idx];
      if (b.kind !== "tool") continue;
      const found = m.details?.found;
      blocks[idx] = {
        ...b,
        ...(found != null && { found }),
        ok: !m.isError,
        ...(durations.has(m.toolCallId) && { durationMs: durations.get(m.toolCallId) }),
      };
    }
  }
  return blocks;
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

    /**
     * 把派生出的有序块按顺序落库（thinking / tool_result / text）。
     * 成功与失败/中止路径共用：失败时先把已生成的块落下，再追加失败 text。
     * 最后一个 text 块追加 summary（报告交付/信号计数），无 text 块则补一条 summary。
     */
    const persistBlocks = (conversationId: string, runId: string, blocks: SrvBlock[]) => {
      const lastSaved = saved[saved.length - 1];
      const summaryText = lastSaved
        ? `已交付洞察报告「${lastSaved.title}」`
        : `洞察运行结束（未生成报告）。本轮共采集 ${collectedItems.length} 条信号。`;

      // 派生为空（session.messages 无 assistant 内容）→ 仅落 summary 兜底
      if (blocks.length === 0) {
        repo.addMessage(conversationId, "assistant", { kind: "text", text: summaryText }, { runId });
        return;
      }

      // 找最后一个 text 块的索引，用于追加 summary
      let lastTextIdx = -1;
      for (let i = blocks.length - 1; i >= 0; i--) {
        if (blocks[i].kind === "text") {
          lastTextIdx = i;
          break;
        }
      }

      blocks.forEach((b, i) => {
        if (b.kind === "thinking") {
          repo.addMessage(conversationId, "assistant", { kind: "thinking", text: b.text }, { runId });
        } else if (b.kind === "tool") {
          repo.addMessage(
            conversationId,
            "assistant",
            {
              kind: "tool_result",
              toolName: b.toolName,
              summary: b.found != null ? `查询到 ${b.found} 条数据` : b.ok === false ? "失败" : "完成",
              ...(b.found != null && { found: b.found }),
              args: b.args,
              ...(b.durationMs != null && { durationMs: b.durationMs }),
            },
            {
              runId,
              toolCall: {
                toolName: b.toolName,
                args: b.args,
                ...(b.found != null && { found: b.found }),
                ...(b.durationMs != null && { durationMs: b.durationMs }),
              },
            },
          );
        } else {
          // text：最后一个 text 块追加 summary
          const text = i === lastTextIdx ? `${b.text}\n\n— ${summaryText}` : b.text;
          repo.addMessage(conversationId, "assistant", { kind: "text", text }, { runId });
        }
      });
      // 若本轮没有任何 text 块（纯工具/思考），补一条 summary
      if (lastTextIdx < 0) {
        repo.addMessage(conversationId, "assistant", { kind: "text", text: summaryText }, { runId });
      }
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
      // 落库不再旁路：ask 作为普通 tool_call 进入 session.messages，
      // run 结束时由 deriveBlocksFromMessages 统一落为 tool_result（question/options 在 args、
      // 用户回复在 ToolResultMessage.content）。
      awaitInput: (inputId, question, options) => {
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

    // 事件桥接 → emit AgentEvent（透传前端实时流）+ 薄订阅记录 per-tool 耗时。
    // 块的结构/顺序/内容统一在 run 结束时从 session.messages 派生（单一真相源），
    // 此处仅维护 durations Map 作为锦上添花；Map 丢失时只是工具块缺耗时，块结构绝不丢。
    const durations = new Map<string, number>();
    const unsubscribe = bridgeSessionEvents(session, ctx.runId, (ev: AgentEvent) => {
      // tool_call_end 事件已由 event-bridge 算好 durationMs，直接登记
      if (ev.type === "tool_call_end") durations.set(ev.toolCallId, ev.durationMs);
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
    const configHint = `（本轮洞察配置：时间窗=${run.config.timeRange}，视角=${run.lens ?? "智能路由（由 Agent 按意图判定）"}）`;
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

    // 标记本轮块是否已落库，防止成功路径落库后若 updateRun/emit 抛错、
    // catch 再落一次导致重复（思考/工具/文本消息出现两份）
    let blocksPersisted = false;

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

      // 从 session.messages 派生有序块（单一真相源），按顺序持久化。
      // 历史/实时 UI 已验证的 thinking→tool→text 循环在此由 messages 还原。
      persistBlocks(
        run.conversationId,
        ctx.runId,
        deriveBlocksFromMessages(session.messages as MessageLike[], durations),
      );
      blocksPersisted = true;

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

      // 失败/中止也先把本轮已生成的块落下（A 方案：session.messages 有什么落什么）。
      // 已落过（成功路径 persistBlocks 后 updateRun/emit 抛错进来的）则跳过，避免重复落库。
      // session.messages 读取异常时 persistBlocks 兜底落一条 summary，绝不丢空。
      if (!blocksPersisted) {
        let partialBlocks: SrvBlock[] = [];
        try {
          partialBlocks = deriveBlocksFromMessages(session.messages as MessageLike[], durations);
        } catch {
          partialBlocks = [];
        }
        persistBlocks(run.conversationId, ctx.runId, partialBlocks);
      }

      // 中止：先落块，再让 abort 路由置 interrupted（status/endedAt/SSE 由路由收尾）
      if (ctx.signal.aborted) return;

      // 失败：追加失败原因 text 块 + 置 failed 状态
      repo.addMessage(
        run.conversationId,
        "assistant",
        { kind: "text", text: `洞察运行失败：${msg}` },
        { runId: ctx.runId },
      );
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

