/**
 * 全局枚举与字面量联合。
 *
 * 这些值同时是 MySQL 枚举列的取值（见 apps/server/src/db/schema.ts），
 * 前后端共享以保证状态语义不漂移（验收 F1）。
 */

/** 用户角色。externalId 来自 JWT，role 由后端库管理（USER↔ADMIN）。 */
export type UserRole = 'USER' | 'ADMIN';

/** 数据源类型 → 决定调度时用哪个 ICollector。 */
export type SourceType =
  | 'RSS'
  | 'SEARCH_API'
  | 'SEARCH_CRAWL'
  | 'WEB_SCRAPER';

/** 采集运行状态。 */
export type CollectStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

/** 报告实体状态。 */
export type ReportStatus = 'GENERATING' | 'READY' | 'SENT' | 'FAILED';

/** 推送日志状态。 */
export type NotificationStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

/** 用户反馈类型。 */
export type FeedbackType = 'USEFUL' | 'USELESS' | 'COLLECT';

/** 推送通道标识。CONSOLE 为默认实现；其余由内网扩展注册。 */
export type NotificationChannelType =
  | 'CONSOLE'
  | 'EMAIL'
  | 'WECOM'
  | 'FEISHU'
  | 'DINGTALK'
  | 'TELEGRAM'
  | (string & {}); // 允许自定义通道名

/** 报告条目分区。 */
export type ReportSection = 'headline' | 'featured' | 'archive';

/** HTTP 代理认证策略（可选）。 */
export type ProxyAuthScheme = 'none' | 'basic' | 'bearer';

/** 全局 cron 任务名（采集 / 处理）。报告 cron 按 ReportSchedule 各自配置。 */
export type GlobalCronName = 'collect' | 'process';

/** ── Phase 1B 新增 ── */

/** Insight 会话状态。 */
export type InsightStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ABORTED';

/** Agent 步骤角色。 */
export type AgentStepRole = 'ASSISTANT' | 'TOOL' | 'SYSTEM';

/** Agent 工具名。 */
export type AgentToolName =
  | 'COLLECT'
  | 'SEARCH'
  | 'EXTRACT'
  | 'QUERY_ARTICLES'
  | 'VAULT_READ'
  | 'VAULT_WRITE'
  | 'FINALIZE';
