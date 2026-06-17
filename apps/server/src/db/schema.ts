/**
 * Drizzle schema —— AI Insight 全表（12 张）。
 * 见 doc/design-doc/06-数据模型.md。
 *
 * ORM：drizzle-orm/mysql-core。迁移由 drizzle-kit 管理（drizzle.config.ts）。
 * 枚举取值与 @ai-insight/shared-types/enums 保持一致（验收 F1）。
 *
 * 表清单：users / categories / sources / collect_logs / raw_items /
 *         articles / report_schedules / subscriptions /
 *         reports / report_items / notification_logs / feedback
 *
 * 注：主键用 `int().autoincrement()`（而非 `serial`，serial 是 bigint unsigned），
 *     以保证与所有 `int` 外键列类型一致（MySQL 外键要求类型严格匹配）。
 *
 * 注：所有 timestamp 列显式给默认值，规避 MySQL 旧版 explicit_defaults_for_timestamp=OFF
 *     + NO_ZERO_DATE 严格模式下的「Invalid default value」迁移失败。
 */
import {
  mysqlTable,
  mysqlEnum,
  varchar,
  text,
  int,
  boolean,
  timestamp,
  json,
  primaryKey,
  index,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

/* ===========================================================================
 * users —— 用户（externalId 来自 JWT；role 后端库管理）
 * ========================================================================= */
export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  externalId: varchar('external_id', { length: 128 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  role: mysqlEnum('role', ['USER', 'ADMIN']).notNull().default('USER'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: timestamp('last_seen_at'),
});

/* ===========================================================================
 * categories —— 领域（管理端定义，对应原型 ai/bio/quant/climate/soc）
 * ========================================================================= */
export const categories = mysqlTable('categories', {
  id: int('id').autoincrement().primaryKey(),
  code: varchar('code', { length: 64 }).notNull().unique(),
  label: varchar('label', { length: 128 }).notNull(),
  color: varchar('color', { length: 16 }).notNull(),
  sortOrder: int('sort_order').default(0),
  enabled: boolean('enabled').default(true),
});

/* ===========================================================================
 * sources —— 数据源（采集层概念，用户不直接订阅）
 * config 承载 feed url / endpoint / 选择器 / api key（敏感 key 加密存储）
 * ========================================================================= */
export const sources = mysqlTable('sources', {
  id: int('id').autoincrement().primaryKey(),
  code: varchar('code', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(), // RSS | SEARCH_API | SEARCH_CRAWL | WEB_SCRAPER | 自定义
  config: json('config').$type<Record<string, unknown>>(),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
});

/* ===========================================================================
 * collect_logs —— 采集运行日志
 * ========================================================================= */
export const collectLogs = mysqlTable(
  'collect_logs',
  {
    id: int('id').autoincrement().primaryKey(),
    sourceId: int('source_id')
      .notNull()
      .references(() => sources.id),
    status: mysqlEnum('status', ['RUNNING', 'SUCCESS', 'FAILED']).notNull(),
    startedAt: timestamp('started_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    finishedAt: timestamp('finished_at').default(sql`CURRENT_TIMESTAMP`),
    itemsFetched: int('items_fetched').default(0),
    itemsNew: int('items_new').default(0),
    error: text('error'),
  },
  (t) => ({
    sourceStatusIdx: index('collect_logs_source_status_idx').on(t.sourceId, t.status),
    startedIdx: index('collect_logs_started_idx').on(t.startedAt),
  }),
);

/* ===========================================================================
 * raw_items —— 采集原始项
 * fingerprint 唯一 → 跨源去重第一道
 * ========================================================================= */
export const rawItems = mysqlTable(
  'raw_items',
  {
    id: int('id').autoincrement().primaryKey(),
    sourceId: int('source_id')
      .notNull()
      .references(() => sources.id),
    fingerprint: varchar('fingerprint', { length: 64 }).notNull().unique(),
    url: text('url').notNull(),
    title: varchar('title', { length: 512 }).notNull(),
    rawText: text('raw_text'),
    publishedAt: timestamp('published_at').default(sql`CURRENT_TIMESTAMP`),
    capturedAt: timestamp('captured_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    dedupeKey: varchar('dedupe_key', { length: 64 }),
  },
  (t) => ({
    sourceIdx: index('raw_items_source_idx').on(t.sourceId),
    dedupeIdx: index('raw_items_dedupe_idx').on(t.dedupeKey),
  }),
);

/* ===========================================================================
 * articles —— AI 处理产物（全局共享池）
 * ========================================================================= */
export const articles = mysqlTable(
  'articles',
  {
    id: int('id').autoincrement().primaryKey(),
    rawItemId: int('raw_item_id').references(() => rawItems.id),
    categoryCode: varchar('category_code', { length: 64 }).references(
      () => categories.code,
    ),
    summary: text('summary').notNull(), // 中文摘要
    heat: int('heat').notNull(), // 0-100
    tags: json('tags').$type<string[]>(),
    critical: boolean('critical').default(false), // 头条推荐
    trendComment: text('trend_comment'), // 综合点评（深度报告）
    processedAt: timestamp('processed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    categoryIdx: index('articles_category_idx').on(t.categoryCode),
    heatIdx: index('articles_heat_idx').on(t.heat),
    criticalIdx: index('articles_critical_idx').on(t.critical),
  }),
);

/* ===========================================================================
 * report_schedules —— 报告调度目标（各自 cron）
 * ========================================================================= */
export const reportSchedules = mysqlTable('report_schedules', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  cron: varchar('cron', { length: 64 }).notNull(),
  periodHours: int('period_hours').notNull(), // 覆盖时间窗（裁剪范围）
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
});

/* ===========================================================================
 * subscriptions —— 用户订阅（挂载到 schedule）
 * 裁剪命中规则：categoryCodes ∪ keywords 命中 Article
 * ========================================================================= */
export const subscriptions = mysqlTable(
  'subscriptions',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    scheduleId: int('schedule_id')
      .notNull()
      .references(() => reportSchedules.id),
    categoryCodes: json('category_codes').$type<string[]>(),
    keywords: json('keywords').$type<string[]>(),
    channels: json('channels').$type<string[]>(),
    active: boolean('active').default(true),
    updatedAt: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    userIdx: index('subscriptions_user_idx').on(t.userId),
    scheduleIdx: index('subscriptions_schedule_idx').on(t.scheduleId),
  }),
);

/* ===========================================================================
 * reports —— 报告实体（每用户每期一条，实体化存档）
 * ========================================================================= */
export const reports = mysqlTable(
  'reports',
  {
    id: int('id').autoincrement().primaryKey(),
    issueNo: varchar('issue_no', { length: 32 }).notNull(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    scheduleId: int('schedule_id')
      .notNull()
      .references(() => reportSchedules.id),
    // 期间起止由 report.worker 在组装时显式写入；给 CURRENT_TIMESTAMP 默认值
    // 仅是为通过 MySQL 严格模式的迁移校验（insert 时会被覆盖）。
    periodStart: timestamp('period_start').notNull().default(sql`CURRENT_TIMESTAMP`),
    periodEnd: timestamp('period_end').notNull().default(sql`CURRENT_TIMESTAMP`),
    headlineJson: json('headline_json').$type<unknown>(),
    bodyJson: json('body_json').$type<unknown>(),
    status: mysqlEnum('status', ['GENERATING', 'READY', 'SENT', 'FAILED']).notNull(),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
    sentAt: timestamp('sent_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    userIssueIdx: index('reports_user_issue_idx').on(t.userId, t.issueNo),
    scheduleIdx: index('reports_schedule_idx').on(t.scheduleId),
    statusIdx: index('reports_status_idx').on(t.status),
  }),
);

/* ===========================================================================
 * report_items —— 报告与 article 的关联
 * 复合主键 (reportId, articleId)
 * ========================================================================= */
export const reportItems = mysqlTable(
  'report_items',
  {
    reportId: int('report_id')
      .notNull()
      .references(() => reports.id),
    articleId: int('article_id')
      .notNull()
      .references(() => articles.id),
    sortOrder: int('sort_order').notNull(),
    section: varchar('section', { length: 32 }), // headline / featured / archive
  },
  (t) => ({
    pk: primaryKey({ columns: [t.reportId, t.articleId] }),
    reportIdx: index('report_items_report_idx').on(t.reportId),
  }),
);

/* ===========================================================================
 * notification_logs —— 推送日志（管理端可见、可手动重推）
 * ========================================================================= */
export const notificationLogs = mysqlTable(
  'notification_logs',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    reportId: int('report_id').references(() => reports.id),
    channel: varchar('channel', { length: 32 }).notNull(),
    status: mysqlEnum('status', ['PENDING', 'SUCCESS', 'FAILED']).notNull(),
    payload: json('payload').$type<unknown>(),
    /** 幂等键：同 report+channel 去重（验收 F5/E6） */
    idempotencyKey: varchar('idempotency_key', { length: 128 }),
    error: text('error'),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    reportChannelIdx: index('notification_logs_report_channel_idx').on(
      t.reportId,
      t.channel,
    ),
    idemIdx: index('notification_logs_idem_idx').on(t.idempotencyKey),
  }),
);

/* ===========================================================================
 * feedback —— 用户反馈/收藏（反馈数据回流可优化推荐 v2）
 * ========================================================================= */
export const feedback = mysqlTable(
  'feedback',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    articleId: int('article_id')
      .notNull()
      .references(() => articles.id),
    type: mysqlEnum('type', ['USEFUL', 'USELESS', 'COLLECT']).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    userArticleIdx: index('feedback_user_article_idx').on(t.userId, t.articleId),
  }),
);

/* ===========================================================================
 * 类型导出（行类型，供 route/worker 使用）
 * ========================================================================= */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type CollectLog = typeof collectLogs.$inferSelect;
export type RawItem = typeof rawItems.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type ReportSchedule = typeof reportSchedules.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type ReportItem = typeof reportItems.$inferSelect;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
