/**
 * 定时洞察调度器 — node-cron 驱动（设计 §3.4）。
 *
 * 启动时加载启用的 schedule，按各自 cron 排任务；CRUD 后经 notifyScheduleChange() 重载。
 * fire：新建会话 + user 消息 + run → 入队 Runner → 更新 lastRunAt/nextRunAt。
 *
 * 范围（MVP）：
 *  - 不做重启补跑（停机错过即丢，仅重算 nextRunAt）。
 *  - 每分钟兜底重算 nextRunAt 为空/已过的 schedule。
 *  - 时区按进程；node-cron 与 cron-parser 均以系统时区为参考。
 */
import cron, { type ScheduledTask } from "node-cron";
import { CronExpressionParser } from "cron-parser";
import * as repo from "../repo.js";
import { deriveTitle } from "../util.js";
import type { Schedule } from "@ai-insight/shared-types";

type EnqueueFn = (runId: string, conversationId: string) => void;

let _enqueue: EnqueueFn | null = null;
const _tasks = new Map<string, ScheduledTask>();

/** 启动调度器（main.ts 在 setEnqueueRun 后调用）。 */
export function startScheduler(enqueue: EnqueueFn): void {
  _enqueue = enqueue;
  reloadSchedules();
  // 每分钟兜底：重算 nextRunAt 为空/已过（不补跑，仅刷新下次时刻）
  cron.schedule("* * * * *", () => recomputeStaleNextRunAt());
}

/** CRUD 后调用：停所有任务 → 从 DB 重新加载启用的 schedule → 排任务。 */
export function notifyScheduleChange(): void {
  reloadSchedules();
}

/** 计算 cron 下次触发时刻（ISO）；无效表达式回退当前时刻。 */
export function nextFireIso(cronExpr: string): string {
  try {
    return CronExpressionParser.parse(cronExpr).next().toISOString() ?? new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/** 校验 cron 表达式合法性。 */
export function validateCron(cronExpr: string): boolean {
  return cron.validate(cronExpr);
}

function reloadSchedules(): void {
  for (const t of _tasks.values()) t.stop();
  _tasks.clear();
  for (const s of repo.listEnabledSchedules()) scheduleTask(s);
}

function scheduleTask(s: Schedule): void {
  if (!cron.validate(s.cron)) return;
  const task = cron.schedule(s.cron, () => {
    void fire(s.id);
  });
  _tasks.set(s.id, task);
}

/** 一次 schedule 触发：落一次完整 Insight Run（复用会话→消息→run→enqueue 路径）。 */
function fire(scheduleId: string): void {
  if (!_enqueue) return;
  const s = repo.getSchedule(scheduleId);
  if (!s || !s.enabled) return;
  try {
    const conv = repo.createConversation(s.userId, `[定时] ${deriveTitle(s.prompt)}`, s.config);
    // user message 由 Pi SessionManager 在 prompt() 时自动 appendMessage 到 .jsonl（与交互路径一致）
    const run = repo.createRun(conv.id, s.prompt, s.config, s.lens);
    _enqueue(run.id, conv.id);
    repo.updateScheduleRunTimes(s.id, {
      lastRunAt: new Date().toISOString(),
      nextRunAt: nextFireIso(s.cron),
    });
  } catch (e) {
    // 单次 fire 失败不阻断后续调度
    console.error(`[scheduler] fire failed for ${scheduleId}:`, (e as Error).message);
  }
}

function recomputeStaleNextRunAt(): void {
  const now = Date.now();
  for (const s of repo.listEnabledSchedules()) {
    const nextMs = s.nextRunAt ? new Date(s.nextRunAt).getTime() : 0;
    if (!s.nextRunAt || nextMs < now) {
      repo.updateScheduleRunTimes(s.id, { nextRunAt: nextFireIso(s.cron) });
    }
  }
}
