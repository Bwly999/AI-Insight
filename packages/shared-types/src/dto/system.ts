/**
 * 系统配置 DTO —— 管理端：代理 / 全局 cron / 通道 / 用户 / 日志。
 * 见 doc/design-doc/04-后端架构.md (admin 路由)、09-基础设施与部署.md。
 */
import { z } from 'zod';
import type {
  CollectStatus,
  GlobalCronName,
  NotificationStatus,
  ProxyAuthScheme,
  UserRole,
} from '../enums.js';

/* ---------------------------------- 代理 ---------------------------------- */

export const ProxyConfigBody = z.object({
  enabled: z.boolean().default(false),
  host: z.string().max(255).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  authScheme: z.enum(['none', 'basic', 'bearer']).default('none'),
  username: z.string().optional(),
  /** 写入时接收明文，落库加密；读出时脱敏。 */
  password: z.string().optional(),
});
export type ProxyConfigBody = z.infer<typeof ProxyConfigBody>;

export interface ProxyConfigView {
  enabled: boolean;
  host: string | null;
  port: number | null;
  authScheme: ProxyAuthScheme;
  username: string | null;
  /** 脱敏后返回，仅供展示。 */
  hasPassword: boolean;
}

/* -------------------------------- 全局 cron ------------------------------- */

export const GlobalCronBody = z.object({
  collect: z.string().min(1),
  process: z.string().min(1),
});
export type GlobalCronBody = z.infer<typeof GlobalCronBody>;

export interface GlobalCronView {
  collect: string;
  process: string;
  /** 预览下次触发时间 */
  nextRuns: Partial<Record<GlobalCronName, string | null>>;
}

/* ---------------------------------- 通道 ---------------------------------- */

export interface NotificationChannelView {
  channel: string;
  /** 是否已注册实现（CONSOLE 默认在；其余看内网扩展） */
  registered: boolean;
  /** 是否已配置密钥 */
  configured: boolean;
  /** 展示用的通道说明 */
  label: string;
}

/* ---------------------------------- 用户 ---------------------------------- */

export interface AdminUserView {
  id: number;
  externalId: string;
  name: string;
  role: UserRole;
  createdAt: string;
  lastSeenAt: string | null;
}

export const UpdateUserRoleBody = z.object({
  role: z.enum(['USER', 'ADMIN']),
});
export type UpdateUserRoleBody = z.infer<typeof UpdateUserRoleBody>;

/* ---------------------------------- 日志 ---------------------------------- */

export interface CollectLogView {
  id: number;
  sourceId: number;
  status: CollectStatus;
  startedAt: string;
  finishedAt: string | null;
  itemsFetched: number;
  itemsNew: number;
  error: string | null;
}

export interface NotificationLogView {
  id: number;
  userId: number;
  reportId: number | null;
  channel: string;
  status: NotificationStatus;
  error: string | null;
  createdAt: string;
}

/** 仪表盘关键指标。 */
export interface DashboardStats {
  collectedToday: number;
  pendingProcess: number;
  reportsThisIssue: number;
  deliverySuccessRate: number;
  queueHealth: Array<{
    queue: string;
    waiting: number;
    active: number;
    failed: number;
  }>;
  recentErrors: Array<{
    at: string;
    scope: string;
    message: string;
  }>;
}
