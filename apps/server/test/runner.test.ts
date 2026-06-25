import { describe, it, expect } from "vitest";
import { startRunner, type RunExecutor } from "../src/runner/index.js";

describe("runner", () => {
  it("subscribe 收到 emit 的事件，run_completed 触发 onClose", async () => {
    const executor: RunExecutor = async (ctx, emit) => {
      emit({ type: "run_started", runId: ctx.runId, prompt: "p" });
      emit({ type: "run_completed", runId: ctx.runId });
    };
    const runner = startRunner({ concurrency: 2, execute: executor });
    const events: string[] = [];
    await new Promise<void>((resolve) => {
      runner.subscribe(
        "run-a",
        (_event, data) => events.push((data as { type: string }).type),
        resolve,
      );
      runner.enqueue("run-a", "conv-a");
    });
    expect(events).toEqual(["run_started", "run_completed"]);
  });

  it("并发上限：concurrency=2 时同时执行不超过 2", async () => {
    let active = 0;
    let maxActive = 0;
    const executor: RunExecutor = async (ctx, emit) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 15));
      active--;
      emit({ type: "run_completed", runId: ctx.runId });
    };
    const runner = startRunner({ concurrency: 2, execute: executor });
    const closed: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      closed.push(
        new Promise<void>((resolve) => {
          runner.subscribe(`run-${i}`, () => {}, resolve);
          runner.enqueue(`run-${i}`, `conv-${i}`);
        }),
      );
    }
    await Promise.all(closed);
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(maxActive).toBe(2); // 5 个 run、并发 2，必然达到上限
  });

  it("abort 触发 ctx.signal.abort 后 executor 可收尾", async () => {
    const executor: RunExecutor = async (ctx, emit) => {
      await new Promise<void>((resolve) => {
        ctx.signal.addEventListener("abort", () => resolve());
      });
      emit({ type: "run_failed", runId: ctx.runId, error: "aborted" });
    };
    const runner = startRunner({ concurrency: 1, execute: executor });
    await new Promise<void>((resolve) => {
      runner.subscribe("run-abort", () => {}, resolve);
      runner.enqueue("run-abort", "conv-abort");
      runner.abort("run-abort");
    });
    // 未挂起即通过（abort → executor resolve → run_failed → onClose）
  });

  it("run_failed 同样触发 onClose", async () => {
    const executor: RunExecutor = async (ctx, emit) => {
      emit({ type: "run_failed", runId: ctx.runId, error: "boom" });
    };
    const runner = startRunner({ concurrency: 1, execute: executor });
    let closed = false;
    await new Promise<void>((resolve) => {
      runner.subscribe("run-err", () => {}, () => {
        closed = true;
        resolve();
      });
      runner.enqueue("run-err", "conv-err");
    });
    expect(closed).toBe(true);
  });
});
