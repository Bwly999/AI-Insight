/**
 * blocks — AgentLoop 有序块模型（核心 mapper，纯函数）。
 *
 * 一个 assistant turn = 一个有序 Block[]，按真实到达顺序排列：
 *   thinking → text → tool → thinking → tool → text → …
 *
 * 增量合并规则（借鉴 correlation-analysis-system/notebook）：
 *   - thinking_delta / text_delta：看末块，同类追加、异类新建 → 类型切换天然产生思考/回复分界
 *   - tool_call_start：总是 push 新 tool block
 *   - tool_call_end：按 toolCallId 找到对应 tool block，就地回填 found/ok/durationMs（不产生新块）
 *
 * 实时流（applyEvent）与历史回看（fromAgentMessages）共用同一套 Block 类型与渲染组件。
 */
import type {
  AgentEvent,
  AgentMessage,
  AssistantMessage,
  ReportSummary,
  TextContent,
  ThinkingContent,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from "@ai-insight/shared-types";

/** 工具块（也兼作证据面板的 ToolCallState）。 */
export interface ToolBlock {
  kind: "tool";
  id: string;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  found?: number;
  ok?: boolean;
  durationMs?: number;
}

/** 思考块。 */
export interface ThinkingBlock {
  kind: "thinking";
  id: string;
  text: string;
  /** 开始时间戳（ms）；封口后清空。视图层据此显示"正在思考 X.Xs"。 */
  startedAt?: number;
  /** 最终耗时（ms）；思考结束（被异类事件打断）时填入，之后不再变化。 */
  durationMs?: number;
}

/** 回复文本块（markdown）。 */
export interface TextBlock {
  kind: "text";
  id: string;
  text: string;
}

/** 一个 assistant turn 的有序块。 */
export type Block = ThinkingBlock | TextBlock | ToolBlock;

let seq = 0;
/** 稳定且唯一的块 id（前缀区分来源便于调试）。 */
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

/**
 * 若末块是未封口的 thinking（有 startedAt、无 durationMs），把它封口（结算耗时）。
 * 用于异类事件（text/tool）打断思考时，固化这段思考的最终耗时。
 */
function sealOpenThinking(blocks: Block[]): Block[] {
  const last = blocks[blocks.length - 1];
  if (last && last.kind === "thinking" && last.startedAt != null && last.durationMs == null) {
    const next = blocks.slice();
    next[next.length - 1] = { ...last, durationMs: Date.now() - last.startedAt, startedAt: undefined };
    return next;
  }
  return blocks;
}

/**
 * 把一个实时 SSE 事件应用到 blocks 数组，返回新数组（不可变更新，便于响应式追踪）。
 * - 同类 delta（thinking/text）追加到末块；异类则先把未封口思考封口，再新开一块
 * - tool_start 永远新开一块（前序未封口思考先封口）；tool_end 就地回填既有块
 */
export function applyEvent(blocks: Block[], ev: AgentEvent): Block[] {
  switch (ev.type) {
    case "thinking_delta":
    case "text_delta": {
      const kind = ev.type === "thinking_delta" ? "thinking" : "text";
      const now = Date.now();
      const last = blocks[blocks.length - 1];
      if (last && last.kind === kind) {
        // 同类追加：替换末块（不可变）
        const next = blocks.slice();
        if (kind === "thinking") {
          next[next.length - 1] = { ...(last as ThinkingBlock), text: last.text + ev.text };
        } else {
          next[next.length - 1] = { ...(last as TextBlock), text: last.text + ev.text };
        }
        return next;
      }
      // 异类新建：先封口未封口的思考，再新开一块
      const next = sealOpenThinking(blocks);
      const block: Block =
        kind === "thinking"
          ? { kind: "thinking", id: nextId("thinking"), text: ev.text, startedAt: now }
          : { kind: "text", id: nextId("text"), text: ev.text };
      next.push(block);
      return next;
    }
    case "tool_call_start": {
      // 幂等：重复 start 跳过
      if (blocks.some((b) => b.kind === "tool" && b.toolCallId === ev.toolCallId)) return blocks;
      // 前序未封口思考先封口，再新开工具块
      const next = sealOpenThinking(blocks).slice();
      next.push({
        kind: "tool",
        id: nextId("tool"),
        toolCallId: ev.toolCallId,
        toolName: ev.toolName,
        args: ev.args,
      });
      return next;
    }
    case "tool_call_end": {
      // 就地回填既有 tool 块（按 toolCallId）
      const idx = blocks.findIndex((b) => b.kind === "tool" && b.toolCallId === ev.toolCallId);
      if (idx < 0) return blocks;
      const next = blocks.slice();
      const t = next[idx];
      if (t.kind === "tool") {
        next[idx] = {
          ...t,
          found: ev.found,
          ok: ev.ok,
          durationMs: ev.durationMs,
        };
      }
      return next;
    }
    case "run_completed":
    case "run_failed":
      // 运行结束：封口可能残留的未封口思考块（思考是最后一个 block 的情况）
      return sealOpenThinking(blocks);
    default:
      // run_started / lens_selected / clarification_needed / report_created 不产生 block
      return blocks;
  }
}

/** 一个历史 turn（user 或 assistant），assistant turn 内含有序 blocks。 */
export interface Turn {
  id: string;
  role: "user" | "assistant";
  at: string;
  /** user turn 的纯文本（role === 'user' 时使用）。 */
  text?: string;
  /** assistant turn 的有序块（role === 'assistant' 时使用）。 */
  blocks?: Block[];
  /** 该 turn 所属 run 产出的报告（按 runId 匹配）；仅 assistant turn 可能有。 */
  report?: ReportSummary;
}

/**
 * 把 Pi 原生 AgentMessage[] 聚合成 turns（历史回放，与实时流共用 Block 模型）。
 *
 * Pi 消息流结构（一次 prompt 可能产出多条）：
 *   UserMessage → (AssistantMessage → ToolResultMessage)* → AssistantMessage(最终回复)
 * 归并规则：
 *   - UserMessage → 独立 user turn
 *   - 连续的 AssistantMessage + 其后的 ToolResultMessage 归并进同一个 assistant turn，
 *     直到遇到下一个 UserMessage 才新开 turn。
 *   - AssistantMessage.content 按 type 映射：thinking→ThinkingBlock / text→TextBlock / toolCall→ToolBlock
 *   - ToolResultMessage 按 toolCallId 回填对应 ToolBlock 的 found/ok（details.found）
 *
 * 报告卡归位：Pi 的 AgentMessage 不带 runId，按时间线匹配——
 * 把报告 createdAt（ISO）转 ms，挂到「最后一个 maxTimestamp ≤ 报告时间 的 assistant turn」末尾。
 */
export function fromAgentMessages(messages: AgentMessage[], reports: ReportSummary[] = []): Turn[] {
  const turns: Turn[] = [];
  let current: (Turn & { _maxTs?: number }) | null = null;

  const flush = () => {
    if (current) {
      const { _maxTs, ...turn } = current;
      void _maxTs;
      turns.push(turn);
      current = null;
    }
  };

  for (const m of messages) {
    if (m.role === "user") {
      flush();
      turns.push({
        id: `u-${m.timestamp}`,
        role: "user",
        at: new Date(m.timestamp).toISOString(),
        text: userText(m),
      });
      continue;
    }

    if (m.role === "assistant") {
      // 续接当前 assistant turn；遇到新 user turn 之后的首条 assistant 则新开
      if (!current || current.role !== "assistant") {
        flush();
        current = { id: `a-${m.timestamp}`, role: "assistant", at: new Date(m.timestamp).toISOString(), blocks: [] };
      }
      for (const block of assistantContentToBlocks(m)) {
        current.blocks!.push(block);
      }
      current._maxTs = Math.max(current._maxTs ?? 0, m.timestamp);
      continue;
    }

    if (m.role === "toolResult") {
      // 回填同 turn 内对应 ToolBlock（按 toolCallId）
      if (current && current.role === "assistant" && current.blocks) {
        backfillToolResult(current.blocks, m);
        current._maxTs = Math.max(current._maxTs ?? 0, m.timestamp);
      }
      continue;
    }
  }
  flush();

  // 报告卡按时间线归位到 assistant turn（createdAt ≤ turn 末尾时间）
  attachReportsByTimeline(turns, reports);
  return turns;
}

/** 提取 UserMessage 的纯文本（content 可能是 string 或 TextContent[]）。 */
function userText(m: UserMessage): string {
  if (typeof m.content === "string") return m.content;
  return m.content
    .filter((c): c is TextContent => c.type === "text")
    .map((c) => c.text)
    .join("");
}

/** 把一条 AssistantMessage 的 content 数组映射成有序 Block[]。 */
function assistantContentToBlocks(m: AssistantMessage): Block[] {
  const blocks: Block[] = [];
  for (const c of m.content) {
    if (c.type === "thinking") {
      const tc = c as ThinkingContent;
      if (tc.thinking) blocks.push({ kind: "thinking", id: `t-${m.timestamp}-${blocks.length}`, text: tc.thinking });
    } else if (c.type === "text") {
      const tc = c as TextContent;
      if (tc.text) blocks.push({ kind: "text", id: `x-${m.timestamp}-${blocks.length}`, text: tc.text });
    } else if (c.type === "toolCall") {
      const tc = c as ToolCall;
      blocks.push({
        kind: "tool",
        id: `o-${tc.id}`,
        toolCallId: tc.id,
        toolName: tc.name,
        args: tc.arguments,
      });
    }
  }
  return blocks;
}

/** 用 ToolResultMessage 回填同 turn 内对应 ToolBlock 的 found/ok。 */
function backfillToolResult(blocks: Block[], m: ToolResultMessage): void {
  const idx = blocks.findIndex((b) => b.kind === "tool" && b.toolCallId === m.toolCallId);
  if (idx < 0) return;
  const b = blocks[idx];
  if (b.kind !== "tool") return;
  // details.found 是搜索类工具的命中数（非搜索类工具无此字段）
  const found = (m.details as { found?: number } | undefined)?.found;
  blocks[idx] = {
    ...b,
    ...(found != null && { found }),
    ok: !m.isError,
  };
}

/** 报告卡按 createdAt 时间线归位：挂到「最后一个 maxTimestamp ≤ 报告时间 的 assistant turn」。 */
function attachReportsByTimeline(turns: Turn[], reports: ReportSummary[]): void {
  if (!reports.length) return;
  // 升序遍历报告；每个报告找到时间匹配的 turn 后挂载并消费，避免重复
  const sorted = [...reports].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pending = new Map(sorted.map((r) => [r.id, r]));
  for (const t of turns) {
    if (t.role !== "assistant") continue;
    const turnTs = new Date(t.at).getTime();
    // 挂所有 createdAt ≤ turnTs 且尚未挂载的报告
    for (const r of sorted) {
      if (!pending.has(r.id)) continue;
      if (new Date(r.createdAt).getTime() <= turnTs) {
        t.report = r;
        pending.delete(r.id);
      }
    }
  }
  // 剩余未匹配的报告（时间晚于所有 turn）：挂到最后一个 assistant turn
  if (pending.size) {
    const lastAssistant = [...turns].reverse().find((t) => t.role === "assistant");
    if (lastAssistant && !lastAssistant.report) {
      // 只挂第一个剩余（避免一个 turn 塞多份报告卡）
      const first = sorted.find((r) => pending.has(r.id));
      if (first) lastAssistant.report = first;
    }
  }
}

/** 从 blocks 中提取所有 tool 块（供证据面板等旧消费者使用）。 */
export function toolBlocksOf(blocks: Block[]): ToolBlock[] {
  return blocks.filter((b): b is ToolBlock => b.kind === "tool");
}
