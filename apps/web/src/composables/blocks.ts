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
 * 实时流（applyEvent）与历史回看（fromMessages）共用同一套 Block 类型与渲染组件。
 */
import type { AgentEvent, Message, ReportSummary } from "@ai-insight/shared-types";

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
 * 把 DB 历史 Message[] 聚合成 turns。
 *
 * 历史回看策略：按 createdAt 顺序，相邻 assistant 消息归并进同一个 turn，
 * 其 content 按 kind 映射成 block，保持持久化时的顺序：
 *   - thinking     → ThinkingBlock
 *   - tool_result  → ToolBlock（toolCallId 用 message id；ask 澄清也走此分支）
 *   - text         → TextBlock
 * user 消息独立成一个 user turn。
 *
 * 兼容旧数据：单个 text assistant 消息 → 含单个 TextBlock 的 turn。
 */
export function fromMessages(messages: Message[], reports: ReportSummary[] = []): Turn[] {
  const turns: Turn[] = [];
  let current: (Turn & { _runId?: string }) | null = null;
  // runId → report，便于 flush 时按 turn 归属的 run 匹配报告
  const reportByRun = new Map(reports.map((r) => [r.runId, r]));

  const flush = () => {
    if (current) {
      // 按该 turn 的 runId 匹配报告（报告卡归位到产生它的 run 的消息序列末尾）
      const runId = current._runId;
      const { _runId, ...turn } = current;
      void _runId;
      if (runId && reportByRun.has(runId)) {
        turn.report = reportByRun.get(runId);
        reportByRun.delete(runId); // 每报告只挂一次
      }
      // 空 blocks 的 assistant turn（理论上不会出现）不丢弃，保留为空 turn
      turns.push(turn);
      current = null;
    }
  };

  for (const m of messages) {
    if (m.role === "user") {
      flush();
      turns.push({
        id: m.id,
        role: "user",
        at: m.createdAt,
        text: m.content.kind === "text" ? m.content.text : "",
      });
      continue;
    }

    if (m.role === "assistant") {
      // 续接当前 assistant turn（相邻 assistant 消息归并），否则新开
      if (!current || current.role !== "assistant") {
        flush();
        current = { id: m.id, role: "assistant", at: m.createdAt, blocks: [], _runId: m.runId };
      }
      const block = messageContentToBlock(m);
      if (block) current.blocks!.push(block);
      continue;
    }

    // role === 'tool'：当前未单独持久化 tool role 消息，忽略
  }
  flush();
  return turns;
}

/** 把单条 Message 的 content 映射成一个 Block（无法映射时返回 null）。 */
function messageContentToBlock(m: Message): Block | null {
  const c = m.content;
  switch (c.kind) {
    case "thinking":
      return { kind: "thinking", id: m.id, text: c.text };
    case "text":
      return { kind: "text", id: m.id, text: c.text };
    case "tool_result":
      return {
        kind: "tool",
        id: m.id,
        toolCallId: m.id,
        toolName: c.toolName,
        args: m.toolCall?.args ?? {},
        found: c.found,
        ok: true,
        durationMs: m.toolCall?.durationMs,
      };
    default:
      return null;
  }
}

/** 从 blocks 中提取所有 tool 块（供证据面板等旧消费者使用）。 */
export function toolBlocksOf(blocks: Block[]): ToolBlock[] {
  return blocks.filter((b): b is ToolBlock => b.kind === "tool");
}
