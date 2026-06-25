/**
 * useInsightRun — 订阅 Run 的 SSE 事件流，把 AgentEvent → 响应式状态。
 *
 * 响应式状态：assistant 文本缓冲、thinking、工具调用卡、运行步骤、报告。
 * 支持 abort、自动重连。
 */
import { ref, reactive, computed, onUnmounted, type Ref } from "vue";
import { isUxMode } from "../utils";
import { subscribeRunStream, abortRun } from "@ai-insight/api-client";
import type { AgentEvent, Report, RunStep } from "@ai-insight/shared-types";

/** 工具调用态（reactive 数组元素，UI 共享类型）。 */
export interface ToolCallState {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  found?: number;
  ok?: boolean;
  durationMs?: number;
}

function useMockInsightRun() {
  const runId = ref<string | null>(null);
  const status = ref<"idle" | "running" | "completed" | "failed">("idle");
  const assistantText = ref("");
  const thinking = ref<string[]>([]);
  const toolCalls = reactive<ToolCallState[]>([]);
  const steps = ref<RunStep[]>([]);
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
    report.value = null;
    error.value = null;
    startTimer();

    const events: AgentEvent[] = [
      { type: "run_started", runId: id, prompt: "Mock prompt" },
      { type: "thinking_delta", runId: id, text: "正在分析需求...\n" },
      { type: "thinking_delta", runId: id, text: "构建报告框架...\n" },
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
        stopTimer();
        break;
      case "run_failed":
        status.value = "failed";
        error.value = ev.error;
        stopTimer();
        break;
    }
  }

  async function abort() {
    status.value = "completed";
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
    steps,
    report,
    error,
    elapsed,
    subscribe,
    abort,
  };
}

export function useInsightRun() {
  if (isUxMode()) {
    return useMockInsightRun();
  }

  const runId = ref<string | null>(null);
  const status = ref<"idle" | "running" | "completed" | "failed">("idle");
  const assistantText = ref("");
  const thinking = ref<string[]>([]);
  const toolCalls = reactive<ToolCallState[]>([]);
  const steps = ref<RunStep[]>([]);
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
    report.value = null;
    error.value = null;
    startTimer();

    close?.();
    close = subscribeRunStream(id, handleEvent, () => {
      // 自动重连（简化：5s 后重试一次）
      setTimeout(() => {
        if (status.value === "running" && runId.value) subscribe(runId.value);
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
        stopTimer();
        close?.();
        close = null;
        break;
      case "run_failed":
        status.value = "failed";
        error.value = ev.error;
        stopTimer();
        close?.();
        close = null;
        break;
    }
  }

  async function abort() {
    if (runId.value) {
      await abortRun(runId.value).catch(() => {});
      status.value = "completed";
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
    steps,
    report,
    error,
    elapsed,
    subscribe,
    abort,
  };
}
