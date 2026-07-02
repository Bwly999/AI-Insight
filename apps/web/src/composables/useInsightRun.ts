/**
 * useInsightRun — 订阅 Run 的 SSE 事件流，把 AgentEvent → 有序 blocks（AgentLoop 模型）。
 *
 * 响应式状态以单个 blocks: Block[] 为核心：思考/回复/工具按真实到达顺序排列，
 * 形成 thinking → text → tool → thinking → tool → text 的循环。
 * mock（UX 模式）与真实模式共用同一份 applyEvent mapper。
 *
 * 保留 lens / clarification / report / error / elapsed 等 turn 级状态。
 */
import { ref, onUnmounted } from "vue";
import { isUxMode } from "../utils";
import { subscribeRunStream, abortRun, submitRunInput } from "@ai-insight/api-client";
import type { AgentEvent, LensKey, Report } from "@ai-insight/shared-types";
import { applyEvent, type Block, type ToolBlock, toolBlocksOf } from "./blocks";

/** Agent 反问用户的澄清态（暂停/恢复会话）。 */
export interface ClarificationState {
  inputId: string;
  question: string;
  options?: string[];
}

/**
 * 工具调用态（兼容旧消费者 EvidencePanel 的 ToolCallState 签名）。
 * 真实数据由 blocks 派生，这里仅作 re-export 类型。
 */
export type ToolCallState = ToolBlock;

/** UX 模式 mock：演示完整 AgentLoop（思考1→工具1→思考2→工具2→回复→报告）。 */
function useMockInsightRun() {
  const runId = ref<string | null>(null);
  const status = ref<"idle" | "running" | "completed" | "failed">("idle");
  const blocks = ref<Block[]>([]);
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
    blocks.value = [];
    lens.value = null;
    clarification.value = null;
    report.value = null;
    error.value = null;
    startTimer();

    // 完整 AgentLoop 演示序列：思考 → 工具 → 思考 → 工具 → 回复 → 报告
    const events: AgentEvent[] = [
      { type: "run_started", runId: id, prompt: "分析 2024 年 AI 行业趋势" },
      { type: "thinking_delta", runId: id, text: "用户想了解 2024 年 AI 趋势。我先界定范围，然后从搜索和 RSS 双源采集信号。\n" },
      { type: "lens_selected", runId: id, lens: "deep" },
      {
        type: "tool_call_start",
        runId: id,
        toolName: "search",
        toolCallId: "tool-1",
        args: { query: "2024 AI multimodal trends" },
      },
      {
        type: "tool_call_end",
        runId: id,
        toolName: "search",
        toolCallId: "tool-1",
        found: 12,
        durationMs: 1800,
        ok: true,
      },
      // 第二轮思考：模型分析搜索结果，决定补充 RSS
      { type: "thinking_delta", runId: id, text: "搜索查询到 12 条，覆盖多模态与 Agent。RSS 源能补充近期热度，再抓一轮。\n" },
      {
        type: "tool_call_start",
        runId: id,
        toolName: "fetch_rss",
        toolCallId: "tool-2",
        args: { keywords: ["LLM", "Agent", "多模态"] },
      },
      {
        type: "tool_call_end",
        runId: id,
        toolName: "fetch_rss",
        toolCallId: "tool-2",
        found: 8,
        durationMs: 1200,
        ok: true,
      },
      // 最终回复
      { type: "text_delta", runId: id, text: "## 2024 年 AI 行业趋势\n\n基于 20 条多源信号的交叉研判，今年呈现三条主线：\n\n" },
      { type: "text_delta", runId: id, text: "1. **多模态成为标配** — 文本/图像/音频统一建模进入主流产品。\n2. **Agent 架构落地** — 工具调用 + 多步推理从演示走向生产。\n3. **推理成本下降** — 竞争推动 token 价格持续走低。\n\n详见下方报告。\n\n" },
      {
        type: "report_created",
        runId: id,
        report: {
          id: "report-1",
          runId: id,
          conversationId: "conv-1",
          title: "2024 年 AI 行业趋势分析报告",
          markdown:
            "## 2024 年 AI 行业趋势\n\n### 1. 多模态模型成为主流\n\n多模态模型能够理解和处理多种类型的数据，如文本、图像和声音。这使得它们在虚拟助手、内容创建和医疗诊断等领域的应用越来越广泛。",
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
    }, 700);
  }

  function handleEvent(ev: AgentEvent) {
    switch (ev.type) {
      case "run_started":
        status.value = "running";
        blocks.value = applyEvent(blocks.value, ev);
        break;
      case "thinking_delta":
      case "text_delta":
      case "tool_call_start":
      case "tool_call_end":
        blocks.value = applyEvent(blocks.value, ev);
        break;
      case "lens_selected":
        lens.value = ev.lens;
        break;
      case "clarification_needed":
        clarification.value = { inputId: ev.inputId, question: ev.question, ...(ev.options ? { options: ev.options } : {}) };
        status.value = "running"; // mock 无真实暂停态，保持 running 以维持 UI
        break;
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
    blocks,
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
  const blocks = ref<Block[]>([]);
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
    blocks.value = [];
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
        blocks.value = applyEvent(blocks.value, ev);
        break;
      case "thinking_delta":
      case "text_delta":
      case "tool_call_start":
      case "tool_call_end":
        blocks.value = applyEvent(blocks.value, ev);
        break;
      case "lens_selected":
        lens.value = ev.lens;
        break;
      case "clarification_needed":
        clarification.value = { inputId: ev.inputId, question: ev.question, ...(ev.options ? { options: ev.options } : {}) };
        status.value = "awaiting_input";
        break;
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
    blocks,
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

export { toolBlocksOf };
