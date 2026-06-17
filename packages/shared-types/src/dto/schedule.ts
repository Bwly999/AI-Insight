/**
 * 报告调度目标 DTO —— ReportSchedule。
 * 见 doc/design-doc/06-数据模型.md (report_schedules)。
 *
 * 每个 schedule 独立 cron，触发时为该 schedule 下所有 active subscription
 * 裁剪组装 Report（成本与用户数解耦）。
 */
import { z } from 'zod';

/** 5 段标准 cron（分 时 日 月 周）。 */
const cronRegex = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/;

export const CreateScheduleBody = z.object({
  name: z.string().min(1).max(128),
  cron: z.string().regex(cronRegex, 'invalid 5-field cron'),
  periodHours: z.number().int().min(1).max(24 * 90),
  enabled: z.boolean().default(true),
});
export type CreateScheduleBody = z.infer<typeof CreateScheduleBody>;

export const UpdateScheduleBody = CreateScheduleBody.partial();
export type UpdateScheduleBody = z.infer<typeof UpdateScheduleBody>;

export interface ScheduleView {
  id: number;
  name: string;
  cron: string;
  periodHours: number;
  enabled: boolean;
  createdAt: string;
}

/** 管理端展示用：附挂载订阅数与下次触发时间。 */
export interface ScheduleListItem extends ScheduleView {
  subscriptionsCount: number;
  nextRunAt?: string | null;
}
