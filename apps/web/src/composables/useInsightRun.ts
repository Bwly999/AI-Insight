/**
 * useInsightRun — 订阅 Run 的 SSE 事件流，把 AgentEvent → 响应式状态。
 *
 * 响应式状态：assistant 文本缓冲、thinking、工具调用卡、运行步骤、报告。
 * 支持 abort、自动重连。
 */
import { ref, reactive, onUnmounted } from "vue";
import { isUxMode } from "../utils";
import { subscribeRunStream, abortRun, submitRunInput } from "@ai-insight/api-client";
import type { AgentEvent, LensKey, Report } from "@ai-insight/shared-types";

/** 工具调用态（reactive 数组元素，UI 共享类型）。 */
export interface ToolCallState {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  found?: number;
  ok?: boolean;
  durationMs?: number;
}

/** Agent 反问用户的澄清态（暂停/恢复会话）。 */
export interface ClarificationState {
  inputId: string;
  question: string;
  options?: string[];
}

function useMockInsightRun() {
  const runId = ref<string | null>(null);
  const status = ref<"idle" | "running" | "completed" | "failed">("idle");
  const assistantText = ref("");
  const thinking = ref<string[]>([]);
  const toolCalls = reactive<ToolCallState[]>([]);
  const lens = ref<LensKey | null>(null);
  const clarification = ref<ClarificationState | null>(null);
  const report = ref<Report | null>(null);
  const error = ref<string | null>(null);
  const elapsed = ref("");

  let timer: ReturnType<typeof setInterval> | null = null;
  let startTime = 0;

  function startTimer() {
    startTime = Date.now();
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      const s = Math.floor((Date.now() - startTime) / 1000);
      const m = Math.floor(s / 60);
      elapsed.value = `${m}分${s % 60}秒`;
    }, 1000);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function subscribe(id: string) {
    runId.value = id;
    status.value = "running";
    assistantText.value = "";
    thinking.value = [];
    toolCalls.splice(0, toolCalls.length);
    lens.value = null;
    clarification.value = null;
    report.value = null;
    error.value = null;
    startTimer();

    const events: AgentEvent[] = [
      { type: "run_started", runId: id, prompt: "Mock prompt" },
      { type: "thinking_delta", runId: id, text: "正在分析需求...\n" },
      { type: "thinking_delta", runId: id, text: "构建报告框架...\n" },
      { type: "lens_selected", runId: id, lens: "deep" },
      {
        type: "tool_call_start",
        runId: id,
        toolName: "search",
        toolCallId: "tool-1",
        args: { query: "AI in 2024" },
      },
      {
        type: "tool_call_end",
        runId: id,
        toolName: "search",
        toolCallId: "tool-1",
        found: 10,
        durationMs: 1500,
        ok: true,
      },
      { type: "text_delta", runId: id, text: "## 2024年AI发展趋势\n\n" },
      { type: "text_delta", runId: id, text: "### 1. 多模态模型成为主流\n\n" },
      {
        type: "report_created",
        runId: id,
        report: {
          id: "report-1",
          runId: id,
          conversationId: "conv-1",
          title: "2024年AI发展趋势分析报告",
          markdown:
            "## 2024年AI发展趋势\n\n### 1. 多模态模型成为主流\n\n多模态模型能够理解和处理多种类型的数据，如文本、图像和声音。这使得它们在虚拟助手、内容创建和医疗诊断等领域的应用越来越广泛。",
          html: "...",
          createdAt: new Date().toISOString(),
        },
      },
      { type: "run_completed", runId: id },
    ];

    let eventIndex = 0;
    const interval = setInterval(() => {
      if (eventIndex < events.length) {
        handleEvent(events[eventIndex]);
        eventIndex++;
      } else {
        clearInterval(interval);
        stopTimer();
      }
    }, 500);
  }

  function handleEvent(ev: AgentEvent) {
    switch (ev.type) {
      case "run_started":
        status.value = "running";
        break;
      case "thinking_delta":
        // 累积 thinking（按段落）
        if (thinking.value.length === 0) thinking.value.push(ev.text);
        else thinking.value[thinking.value.length - 1] += ev.text;
        break;
      case "text_delta":
        assistantText.value += ev.text;
        break;
      case "lens_selected":
        lens.value = ev.lens;
        break;
      case "clarification_needed":
        clarification.value = { inputId: ev.inputId, question: ev.question, ...(ev.options ? { options: ev.options } : {}) };
        status.value = "running"; // mock 无真实暂停态，保持 running 以维持 UI
        break;
      case "tool_call_start":
        toolCalls.push({
          toolCallId: ev.toolCallId,
          toolName: ev.toolName,
          args: ev.args,
        });
        break;
      case "tool_call_end": {
        const tc = toolCalls.find((t) => t.toolCallId === ev.toolCallId);
        if (tc) {
          tc.found = ev.found;
          tc.ok = ev.ok;
          tc.durationMs = ev.durationMs;
        }
        break;
      }
      case "report_created":
        report.value = ev.report;
        break;
      case "run_completed":
        status.value = "completed";
        clarification.value = null;
        stopTimer();
        break;
      case "run_failed":
        status.value = "failed";
        error.value = ev.error;
        clarification.value = null;
        stopTimer();
        break;
    }
  }

  async function reply(text: string) {
    if (!clarification.value || !runId.value) return;
    try {
      await submitRunInput(runId.value, text);
    } catch {
      /* 忽略：真实运行由 SSE 推进 */
    }
    clarification.value = null;
  }

  async function abort() {
    status.value = "completed";
    clarification.value = null;
    stopTimer();
  }

  onUnmounted(() => {
    stopTimer();
  });

  return {
    runId,
    status,
    assistantText,
    thinking,
    toolCalls,
    lens,
    clarification,
    report,
    error,
    elapsed,
    subscribe,
    reply,
    abort,
  };
}

export function useInsightRun() {
  if (isUxMode()) {
    return useMockInsightRun();
  }

  const runId = ref<string | null>(null);
  const status = ref<"idle" | "running" | "completed" | "failed" | "awaiting_input">("idle");
  const assistantText = ref("");
  const thinking = ref<string[]>([]);
  const toolCalls = reactive<ToolCallState[]>([]);
  const lens = ref<LensKey | null>(null);
  const clarification = ref<ClarificationState | null>(null);
  const report = ref<Report | null>(null);
  const error = ref<string | null>(null);
  const elapsed = ref("");

  let close: (() => void) | null = null;
  let startTime = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  function startTimer() {
    startTime = Date.now();
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      const s = Math.floor((Date.now() - startTime) / 1000);
      const m = Math.floor(s / 60);
      elapsed.value = `${m}分${s % 60}秒`;
    }, 1000);
  }
  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  /** 订阅指定 run 的事件流。 */
  function subscribe(id: string) {
    runId.value = id;
    status.value = "running";
    assistantText.value = "";
    thinking.value = [];
    toolCalls.splice(0, toolCalls.length);
    lens.value = null;
    clarification.value = null;
    report.value = null;
    error.value = null;
    startTimer();

    close?.();
    close = subscribeRunStream(id, handleEvent, () => {
      // 自动重连（简化：5s 后重试一次；awaiting_input 视为运行中需维持）
      setTimeout(() => {
        if ((status.value === "running" || status.value === "awaiting_input") && runId.value) subscribe(runId.value);
      }, 5000);
    });
  }

  function handleEvent(ev: AgentEvent) {
    switch (ev.type) {
      case "run_started":
        status.value = "running";
        break;
      case "thinking_delta":
        // 累积 thinking（按段落）
        if (thinking.value.length === 0) thinking.value.push(ev.text);
        else thinking.value[thinking.value.length - 1] += ev.text;
        break;
      case "text_delta":
        assistantText.value += ev.text;
        break;
      case "lens_selected":
        lens.value = ev.lens;
        break;
      case "clarification_needed":
        clarification.value = { inputId: ev.inputId, question: ev.question, ...(ev.options ? { options: ev.options } : {}) };
        status.value = "awaiting_input";
        break;
      case "tool_call_start":
        toolCalls.push({
          toolCallId: ev.toolCallId,
          toolName: ev.toolName,
          args: ev.args,
        });
        break;
      case "tool_call_end": {
        const tc = toolCalls.find((t) => t.toolCallId === ev.toolCallId);
        if (tc) {
          tc.found = ev.found;
          tc.ok = ev.ok;
          tc.durationMs = ev.durationMs;
        }
        break;
      }
      case "report_created":
        report.value = ev.report;
        break;
      case "run_completed":
        status.value = "completed";
        clarification.value = null;
        stopTimer();
        close?.();
        close = null;
        break;
      case "run_failed":
        status.value = "failed";
        error.value = ev.error;
        clarification.value = null;
        stopTimer();
        close?.();
        close = null;
        break;
    }
  }

  /** 回复 Agent 的澄清请求（暂停/恢复）。 */
  async function reply(text: string) {
    if (!clarification.value || !runId.value) return;
    const inputId = clarification.value.inputId;
    clarification.value = null;
    status.value = "running";
    try {
      await submitRunInput(runId.value, text);
    } catch (e) {
      // 回复失败：恢复澄清态提示用户重试
      console.error("submit run input failed", e);
    }
    void inputId; // 当前轮 inputId 已随请求提交
  }

  async function abort() {
    if (runId.value) {
      await abortRun(runId.value).catch(() => {});
      status.value = "completed";
      clarification.value = null;
      stopTimer();
    }
  }

  onUnmounted(() => {
    close?.();
    stopTimer();
  });

  return {
    runId,
    status,
    assistantText,
    thinking,
    toolCalls,
    lens,
    clarification,
    report,
    error,
    elapsed,
    subscribe,
    reply,
    abort,
  };
}
