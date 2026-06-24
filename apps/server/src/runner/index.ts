/**
 * Runner — 并发受限的 in-process 运行器 + 事件总线（EventEmitter by runId）→ SSE 透传。
 *
 * Phase 3 完整实现：注入 agent 执行 + 事件桥接。
 * 当前为接口 + 占位实现，保证 Phase 2（路由）可编译运行。
 *
 * main.ts 启动时 startRunner({concurrency}) → 返回 { enqueue, subscribe, abort }，
 * 注入到 conversations（enqueue）和 runs（subscribe/abort）路由。
 */
import { EventEmitter } from "node:events";

/** 事件推送回调（SSE 路由提供）。 */
export type PushEvent = (event: string, data: unknown) => void;

export interface RunnerHandles {
  enqueue(runId: string, conversationId: string): void;
  subscribe(runId: string, push: PushEvent, onClose: () => void): () => void;
  abort(runId: string): void;
}

export interface RunnerOptions {
  concurrency: number;
  /** 执行器（Phase 3 注入；默认用占位执行器）。 */
  execute?: RunExecutor;
}

/** 单次 run 执行器（Phase 3 的 agent 执行注入此）。 */
export type RunExecutor = (
  ctx: RunContext,
  emit: (event: string, data: unknown) => void,
) => Promise<void>;

export interface RunContext {
  runId: string;
  conversationId: string;
  signal: AbortSignal;
}

const bus = new EventEmitter();
bus.setMaxListeners(0);

/** 按 runId 发事件（Runner 执行器 + 工具调用通过此推送）。 */
export function emitRunEvent(runId: string, event: string, data: unknown): void {
  bus.emit(runId, { event, data });
}

/** 启动 Runner。 */
export function startRunner(opts: RunnerOptions): RunnerHandles {
  const execute = opts.execute ?? defaultExecutor;
  const active = new Map<string, AbortController>();
  const queue: { runId: string; conversationId: string }[] = [];

  const pump = () => {
    while (active.size < opts.concurrency && queue.length > 0) {
      const job = queue.shift()!;
      const controller = new AbortController();
      active.set(job.runId, controller);
      void runOne(job, controller.signal);
    }
  };

  const runOne = async (
    job: { runId: string; conversationId: string },
    signal: AbortSignal,
  ) => {
    const emit = (event: string, data: unknown) =>
      emitRunEvent(job.runId, event, data);
    try {
      await execute({ ...job, signal }, emit);
    } catch (e) {
      emit("run_failed", { runId: job.runId, error: (e as Error).message });
    } finally {
      active.delete(job.runId);
      pump();
    }
  };

  return {
    enqueue(runId, conversationId) {
      queue.push({ runId, conversationId });
      pump();
    },
    subscribe(runId, push, onClose) {
      const listener = ({ event, data }: { event: string; data: unknown }) => {
        push(event, data);
        if (event === "run_completed" || event === "run_failed") {
          onClose();
        }
      };
      bus.on(runId, listener);
      return () => bus.off(runId, listener);
    },
    abort(runId) {
      active.get(runId)?.abort();
    },
  };
}

/** 默认占位执行器（Phase 3 替换为真实 agent 执行）。 */
const defaultExecutor: RunExecutor = async (ctx, emit) => {
  emit("run_failed", {
    runId: ctx.runId,
    error: "Runner 执行器未配置（Phase 3 待接入 Agent）",
  });
};
