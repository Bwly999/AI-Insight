/**
 * pending-inputs — 暂停/恢复会话的核心：在 ask 工具与 input 端点间传递用户回复。
 *
 * 机制：ask 工具经 ToolContext.awaitInput 调 resolveAwaiting → 创建一个 pending Promise
 * 并挂到 Map（key = runId）。run 因此阻塞在 session.prompt() 内（AgentSession 实例存活于
 * executor 闭包，pi 的 agent 循环会 await 工具 execute）。用户回复经 POST /api/runs/:id/input
 * → submitRunInput 调 resolve 释放阻塞，回复文本作为工具结果返回，agent 继续推进。
 *
 * 超时兜底（默认 10 分钟）防 session 长期驻留泄漏；abort 时 rejectPending 释放。
 */
export interface PendingInput {
  inputId: string;
  resolve: (text: string) => void;
  reject: (err: Error) => void;
  /** 当前等待的 inputId（用于校验端点回复的是哪一轮；多次 ask 时只看最新）。 */
  timer: ReturnType<typeof setTimeout>;
}

/** runId → pending。 */
const pending = new Map<string, PendingInput>();

const TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟

/**
 * 注册一次等待（由 executor 注入的 awaitInput 调用）。
 * 返回 resolve 后的回复文本。同 run 重复调用会顶替（前一个被 reject 为 superseded）。
 */
export function resolveAwaiting(
  runId: string,
  inputId: string,
): Promise<string> {
  // 顶替前一轮（理论上 agent 串行调 ask，但兜底）
  rejectPending(runId, new Error("superseded by a new ask"));

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      rejectPending(runId, new Error("用户回复超时"));
    }, TIMEOUT_MS);
    pending.set(runId, { inputId, resolve, reject, timer });
  });
}

/** 用户回复到达（由 input 端点调用）。返回 true 表示已交付。 */
export function submitRunInput(runId: string, inputId: string, text: string): boolean {
  const p = pending.get(runId);
  if (!p) return false;
  // 只接受当前轮次的回复（忽略迟到的前一轮）
  if (p.inputId !== inputId) return false;
  clearTimeout(p.timer);
  pending.delete(runId);
  p.resolve(text);
  return true;
}

/** 取消某 run 的等待（abort / 失败 / 超时触发）。 */
export function rejectPending(runId: string, err: Error): void {
  const p = pending.get(runId);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(runId);
  p.reject(err);
}

/** 某 run 当前是否在等待输入。 */
export function isAwaiting(runId: string): boolean {
  return pending.has(runId);
}

/** 取当前等待的 inputId（供端点校验）。 */
export function currentInputId(runId: string): string | undefined {
  return pending.get(runId)?.inputId;
}
