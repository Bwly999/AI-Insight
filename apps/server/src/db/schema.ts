/**
 * Drizzle schema — SQLite (better-sqlite3 + WAL + FTS5)。
 *
 * 对齐设计 §3.5。消息历史 = 对话真相源；insight_runs 链 reports；
 * data_source_items + FTS5 虚表供 fetch_rss 关键词检索（MVP 用即时 fetch，
 * FTS5 留好框架供 RSS 轮询建索引时启用）。
 */
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── users ────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  externalId: text("external_id"),
  name: text("name"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// ─── conversations ────────────────────────────────────────────────────────
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  // config: { timeRange, lens? } 以 JSON 存
  config: text("config").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  // 软删标记（null=未删）；list/get 过滤 deleted_at IS NULL
  deletedAt: text("deleted_at"),
});

// ─── messages（对话历史，真相源）────────────────────────────────────────
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "tool"] }).notNull(),
  // content: MessageContent JSON
  content: text("content").notNull(),
  // toolCall: ToolCallRecord JSON（可空）
  toolCall: text("tool_call"),
  runId: text("run_id"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// ─── insight_runs ─────────────────────────────────────────────────────────
export const insightRuns = sqliteTable("insight_runs", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  triggerMessageId: text("trigger_message_id").notNull().references(() => messages.id),
  status: text("status", { enum: ["queued", "running", "awaiting_input", "completed", "failed", "interrupted"] }).notNull().default("queued"),
  lens: text("lens", { enum: ["deep", "dual", "flash", "timeline"] }),
  // run 级配置快照（继承自 conversation）
  config: text("config").notNull().default("{}"),
  prompt: text("prompt").notNull(),
  startedAt: text("started_at"),
  endedAt: text("ended_at"),
  tokens: integer("tokens"),
  reportId: text("report_id"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// ─── reports（一等公民交付物）────────────────────────────────────────────
export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => insightRuns.id),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  title: text("title").notNull(),
  standfirst: text("standfirst"),
  markdown: text("markdown").notNull(),
  // standalone HTML（editorial 版式）
  html: text("html").notNull(),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// ─── run_items（本轮工具命中的信号条目，供证据面板/统计）──────────────────
export const runItems = sqliteTable("run_items", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => insightRuns.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  sourceType: text("source_type", { enum: ["search", "rss", "crawler"] }).notNull(),
  sourceName: text("source_name").notNull(),
  sourceId: text("source_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  summary: text("summary"),
  publishedAt: text("published_at"),
  fetchedAt: text("fetched_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// ─── data_sources（DB 实体）──────────────────────────────────────────────
export const dataSources = sqliteTable("data_sources", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["search", "rss", "crawler"] }).notNull(),
  name: text("name").notNull(),
  // tags JSON 数组
  tags: text("tags").notNull().default("[]"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  // type 相关配置 JSON（search=引擎名 / rss={feedUrl} / crawler={platform}）
  config: text("config").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// ─── data_source_items（归一化条目，FTS5 索引）──────────────────────────
export const dataSourceItems = sqliteTable("data_source_items", {
  id: text("id").primaryKey(),
  sourceType: text("source_type", { enum: ["search", "rss", "crawler"] }).notNull(),
  sourceName: text("source_name").notNull(),
  sourceId: text("source_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  summary: text("summary"),
  content: text("content"),
  author: text("author"),
  publishedAt: text("published_at"),
  tags: text("tags").notNull().default("[]"),
  heat: integer("heat"),
  fetchedAt: text("fetched_at").notNull(),
});

// FTS5 虚表（data_source_items 的全文索引）— Drizzle 不直接支持虚表 DDL，
// 在 migrate/seed 时用 raw SQL 创建。
// CREATE VIRTUAL TABLE data_source_items_fts USING fts5(
//   title, summary, content, author,
//   content='data_source_items', content_rowid='rowid'
// );

// ─── schedules（定时洞察）────────────────────────────────────────────────
export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  prompt: text("prompt").notNull(),
  config: text("config").notNull().default("{}"),
  cron: text("cron").notNull(),
  lens: text("lens", { enum: ["deep", "dual", "flash", "timeline"] }),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunAt: text("last_run_at"),
  nextRunAt: text("next_run_at"),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

// ─── settings（KV：proxy/llm/rssCadence）─────────────────────────────────
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type DbConversation = typeof conversations.$inferSelect;
export type DbMessage = typeof messages.$inferSelect;
export type DbInsightRun = typeof insightRuns.$inferSelect;
export type DbReport = typeof reports.$inferSelect;
export type DbRunItem = typeof runItems.$inferSelect;
export type DbDataSource = typeof dataSources.$inferSelect;
export type DbSchedule = typeof schedules.$inferSelect;
