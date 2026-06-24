/**
 * 事件桥接 — 把 Pi 的 AgentSessionEvent 映射为前端 AgentEvent DTO（SSE 透传）。
 *
 * Pi 事件类型（已确认 0.80.2）：
 *  - message_update.assistantMessageEvent: text_delta / thinking_delta
 *  - tool_execution_start / tool_execution_end (toolCallId, toolName, args, result)
 *  - agent_end (最终)
 */
import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { AgentEvent } from "@ai-insight/shared-types";

/** 派发回调（Runner 的 emitRunEvent 注入）。 */
export type EmitFn = (event: AgentEvent) => void;

/**
 * 订阅 AgentSession 事件，映射为 AgentEvent DTO 并派发。
 * 返回 unsubscribe。
 */
export function bridgeSessionEvents(
  session: AgentSession,
  runId: string,
  emit: EmitFn,
): () => void {
  return session.subscribe((ev: AgentSessionEvent) => {
    switch (ev.type) {
      case "message_update": {
        const ame = ev.assistantMessageEvent;
        // text_delta / thinking_delta 都用 .delta 字段
        if (ame.type === "text_delta") {
          emit({ type: "text_delta", runId, text: ame.delta });
        } else if (ame.type === "thinking_delta") {
          emit({ type: "thinking_delta", runId, text: ame.delta });
        }
        break;
      }
      case "tool_execution_start": {
        emit({
          type: "tool_call_start",
          runId,
          toolName: ev.toolName,
          toolCallId: ev.toolCallId,
          args: ev.args ?? {},
        });
        break;
      }
      case "tool_execution_end": {
        const found = extractFound(ev.result);
        emit({
          type: "tool_call_end",
          runId,
          toolName: ev.toolName,
          toolCallId: ev.toolCallId,
          found,
          ok: !ev.isError,
          durationMs: 0, // Pi 不直接给；由 Runner 包外计时
        });
        break;
      }
      case "agent_end": {
        emit({ type: "run_completed", runId });
        break;
      }
      // turn_start/turn_end/message_start/message_end/tool_execution_update 忽略（前端不需要）
    }
  });
}

/** 从 tool result 里提取 found 数（details.found）。 */
function extractFound(result: unknown): number | undefined {
  if (!result || typeof result !== "object") return undefined;
  const details = (result as { details?: { found?: number } }).details;
  return details?.found;
}
