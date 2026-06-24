/**
 * 仓储层 — DB 行 ↔ DTO 映射 + CRUD。
 *
 * DB 是 JSON 字符串字段（config/content/tags/toolCall），DTO 是结构化对象。
 * 消息历史以 DB 为唯一真相源（设计 §3.2）。
 */
import { getDb } from "./db/index.js";
import {
  conversations,
  messages,
  insightRuns,
  reports,
  dataSources,
  schedules,
} from "./db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { randomId } from "./util.js";
import type {
  Conversation,
  ConversationConfig,
  ConversationWithMessages,
  DataSource,
  DataSourceTag,
  InsightRun,
  Message,
  MessageContent,
  Report,
  RunStatus,
  ToolCallRecord,
} from "@ai-insight/shared-types";

const db = () => getDb();

// ─── Conversations ────────────────────────────────────────────────────────
export function createConversation(
  userId: string,
  title: string,
  config: ConversationConfig,
): Conversation {
  const id = randomId("conv");
  db().insert(conversations).values({ id, userId, title, config: JSON.stringify(config) }).run();
  return getConversation(id)!;
}

export function getConversation(id: string): Conversation | undefined {
  const row = db().select().from(conversations).where(eq(conversations.id, id)).all()[0];
  return row ? toConversationDto(row) : undefined;
}

export function listConversations(userId: string): Conversation[] {
  return db()
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .all()
    .map(toConversationDto);
}

export function patchConversation(
  id: string,
  patch: { title?: string; config?: ConversationConfig },
): Conversation | undefined {
  const cur = getConversation(id);
  if (!cur) return undefined;
  db()
    .update(conversations)
    .set({
      ...(patch.title != null && { title: patch.title }),
      ...(patch.config != null && { config: JSON.stringify(patch.config) }),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(conversations.id, id))
    .run();
  return getConversation(id);
}

export function getConversationWithMessages(id: string): ConversationWithMessages | undefined {
  const conv = getConversation(id);
  if (!conv) return undefined;
  const msgs = listMessages(id);
  const lastRun = getLastRun(id);
  return { ...conv, messages: msgs, lastRun };
}

// ─── Messages ─────────────────────────────────────────────────────────────
export function addMessage(
  conversationId: string,
  role: Message["role"],
  content: MessageContent,
  opts: { runId?: string; toolCall?: ToolCallRecord } = {},
): Message {
  const id = randomId("msg");
  db()
    .insert(messages)
    .values({
      id,
      conversationId,
      role,
      content: JSON.stringify(content),
      toolCall: opts.toolCall ? JSON.stringify(opts.toolCall) : null,
      runId: opts.runId ?? null,
    })
    .run();
  // 触发 conversation updatedAt
  db().update(conversations).set({ updatedAt: new Date().toISOString() }).where(eq(conversations.id, conversationId)).run();
  return getMessage(id)!;
}

export function getMessage(id: string): Message | undefined {
  const row = db().select().from(messages).where(eq(messages.id, id)).all()[0];
  return row ? toMessageDto(row) : undefined;
}

export function listMessages(conversationId: string): Message[] {
  return db()
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .all()
    .map(toMessageDto);
}

// ─── Insight Runs ─────────────────────────────────────────────────────────
export function createRun(
  conversationId: string,
  triggerMessageId: string,
  prompt: string,
  config: ConversationConfig,
  lens?: ConversationConfig["lens"],
): InsightRun {
  const id = randomId("run");
  db()
    .insert(insightRuns)
    .values({
      id,
      conversationId,
      triggerMessageId,
      status: "queued",
      lens,
      config: JSON.stringify(config),
      prompt,
    })
    .run();
  return getRun(id)!;
}

export function getRun(id: string): InsightRun | undefined {
  const row = db().select().from(insightRuns).where(eq(insightRuns.id, id)).all()[0];
  return row ? toRunDto(row) : undefined;
}

export function updateRun(
  id: string,
  patch: Partial<{
    status: RunStatus;
    startedAt: string;
    endedAt: string;
    tokens: number;
    reportId: string;
    error: string;
  }>,
): void {
  db().update(insightRuns).set(patch).where(eq(insightRuns.id, id)).run();
}

export function getLastRun(conversationId: string): InsightRun | undefined {
  const row = db()
    .select()
    .from(insightRuns)
    .where(eq(insightRuns.conversationId, conversationId))
    .orderBy(desc(insightRuns.createdAt))
    .all()[0];
  return row ? toRunDto(row) : undefined;
}

/** 启动 reconcile：把 running 标记为 interrupted（设计 §3.4）。 */
export function reconcileInterruptedRuns(): number {
  const res = db()
    .update(insightRuns)
    .set({ status: "interrupted", endedAt: new Date().toISOString() })
    .where(eq(insightRuns.status, "running"))
    .run();
  return res.changes;
}

// ─── Reports ──────────────────────────────────────────────────────────────
export function createReport(
  runId: string,
  conversationId: string,
  data: { title: string; standfirst?: string; markdown: string; html: string },
): Report {
  const id = randomId("rep");
  db()
    .insert(reports)
    .values({ id, runId, conversationId, ...data })
    .run();
  // 反链 run
  updateRun(runId, { reportId: id });
  return getReport(id)!;
}

export function getReport(id: string): Report | undefined {
  const row = db().select().from(reports).where(eq(reports.id, id)).all()[0];
  return row ? toReportDto(row) : undefined;
}

export function listReports(conversationId?: string): Report[] {
  const q = conversationId
    ? db().select().from(reports).where(eq(reports.conversationId, conversationId))
    : db().select().from(reports);
  return q.orderBy(desc(reports.createdAt)).all().map(toReportDto);
}

// ─── Data Sources ─────────────────────────────────────────────────────────
export function listDataSources(type?: DataSource["type"]): DataSource[] {
  const q = type
    ? db().select().from(dataSources).where(eq(dataSources.type, type))
    : db().select().from(dataSources);
  return q.all().map(toDataSourceDto);
}

export function getDataSource(id: string): DataSource | undefined {
  const row = db().select().from(dataSources).where(eq(dataSources.id, id)).all()[0];
  return row ? toDataSourceDto(row) : undefined;
}

export function upsertDataSource(
  id: string,
  data: { type: DataSource["type"]; name: string; tags: DataSourceTag[]; enabled: boolean; config: Record<string, unknown> },
): DataSource {
  db()
    .insert(dataSources)
    .values({
      id,
      type: data.type,
      name: data.name,
      tags: JSON.stringify(data.tags),
      enabled: data.enabled,
      config: JSON.stringify(data.config),
    })
    .onConflictDoUpdate({
      target: dataSources.id,
      set: {
        name: data.name,
        tags: JSON.stringify(data.tags),
        enabled: data.enabled,
        config: JSON.stringify(data.config),
      },
    })
    .run();
  return getDataSource(id)!;
}

export function patchDataSource(
  id: string,
  patch: { enabled?: boolean; tags?: DataSourceTag[]; name?: string },
): DataSource | undefined {
  const cur = getDataSource(id);
  if (!cur) return undefined;
  db()
    .update(dataSources)
    .set({
      ...(patch.enabled != null && { enabled: patch.enabled }),
      ...(patch.tags != null && { tags: JSON.stringify(patch.tags) }),
      ...(patch.name != null && { name: patch.name }),
    })
    .where(eq(dataSources.id, id))
    .run();
  return getDataSource(id);
}

export function deleteDataSource(id: string): void {
  db().delete(dataSources).where(eq(dataSources.id, id)).run();
}

/** 取启用的爬虫平台 id 列表（供 crawl 工具）。 */
export function getEnabledCrawlerPlatforms(): string[] {
  return db()
    .select()
    .from(dataSources)
    .where(and(eq(dataSources.type, "crawler"), eq(dataSources.enabled, true)))
    .all()
    .map((r) => (JSON.parse(r.config) as { platform: string }).platform);
}

// ─── Schedules ────────────────────────────────────────────────────────────
export function listSchedules(userId?: string) {
  const q = userId
    ? db().select().from(schedules).where(eq(schedules.userId, userId))
    : db().select().from(schedules);
  return q.orderBy(desc(schedules.createdAt)).all();
}

export function createSchedule(
  userId: string,
  data: { prompt: string; config: ConversationConfig; cron: string; lens?: ConversationConfig["lens"] },
) {
  const id = randomId("sch");
  db()
    .insert(schedules)
    .values({
      id,
      userId,
      prompt: data.prompt,
      config: JSON.stringify(data.config),
      cron: data.cron,
      lens: data.lens,
    })
    .run();
  return db().select().from(schedules).where(eq(schedules.id, id)).all()[0];
}

export function patchSchedule(id: string, patch: { enabled?: boolean; cron?: string; prompt?: string }) {
  db().update(schedules).set(patch).where(eq(schedules.id, id)).run();
  return db().select().from(schedules).where(eq(schedules.id, id)).all()[0];
}

export function deleteSchedule(id: string): void {
  db().delete(schedules).where(eq(schedules.id, id)).run();
}

// ─── DTO 映射 ─────────────────────────────────────────────────────────────
function toConversationDto(row: typeof conversations.$inferSelect): Conversation {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    config: JSON.parse(row.config),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMessageDto(row: typeof messages.$inferSelect): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as Message["role"],
    content: JSON.parse(row.content) as MessageContent,
    toolCall: row.toolCall ? (JSON.parse(row.toolCall) as ToolCallRecord) : undefined,
    runId: row.runId ?? undefined,
    createdAt: row.createdAt,
  };
}

function toRunDto(row: typeof insightRuns.$inferSelect): InsightRun {
  return {
    id: row.id,
    conversationId: row.conversationId,
    triggerMessageId: row.triggerMessageId,
    status: row.status as RunStatus,
    lens: (row.lens as InsightRun["lens"]) ?? undefined,
    config: JSON.parse(row.config),
    prompt: row.prompt,
    startedAt: row.startedAt ?? undefined,
    endedAt: row.endedAt ?? undefined,
    tokens: row.tokens ?? undefined,
    reportId: row.reportId ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.createdAt,
  };
}

function toReportDto(row: typeof reports.$inferSelect): Report {
  return {
    id: row.id,
    runId: row.runId,
    conversationId: row.conversationId,
    title: row.title,
    standfirst: row.standfirst ?? undefined,
    markdown: row.markdown,
    html: row.html,
    createdAt: row.createdAt,
  };
}

function toDataSourceDto(row: typeof dataSources.$inferSelect): DataSource {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    tags: JSON.parse(row.tags),
    enabled: row.enabled,
    config: JSON.parse(row.config),
    createdAt: row.createdAt,
  };
}
