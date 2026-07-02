/**
 * 仓储层 — DB 行 ↔ DTO 映射 + CRUD。
 *
 * DB 是 JSON 字符串字段（config/content/tags/toolCall），DTO 是结构化对象。
 * 消息历史以 DB 为唯一真相源（设计 §3.2）。
 */
import { getDb, getRawSqlite } from "./db/index.js";
import {
  conversations,
  messages,
  insightRuns,
  reports,
  runItems,
  dataSources,
  dataSourceItems,
  schedules,
  settings,
} from "./db/schema.js";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { randomId } from "./util.js";
import { timeRangeToStartDate } from "@ai-insight/datasources";
import type {
  Conversation,
  ConversationConfig,
  ConversationWithMessages,
  DataSource,
  DataSourceItem,
  DataSourceTag,
  InsightRun,
  LensKey,
  Message,
  MessageContent,
  Report,
  ReportSummary,
  RunStatus,
  Schedule,
  TimeRange,
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
  const row = db()
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), isNull(conversations.deletedAt)))
    .all()[0];
  return row ? toConversationDto(row) : undefined;
}

export function listConversations(userId: string): Conversation[] {
  return db()
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), isNull(conversations.deletedAt)))
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

/** 软删会话（标记 deleted_at；保留数据，list/get 过滤掉）。返回是否命中活跃行。 */
export function softDeleteConversation(id: string): boolean {
  const res = db()
    .update(conversations)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(eq(conversations.id, id), isNull(conversations.deletedAt)))
    .run();
  return res.changes > 0;
}

export function getConversationWithMessages(id: string): ConversationWithMessages | undefined {
  const conv = getConversation(id);
  if (!conv) return undefined;
  const msgs = listMessages(id);
  const lastRun = getLastRun(id);
  const reportSummaries = listReportSummaries(id);
  return { ...conv, messages: msgs, lastRun, reports: reportSummaries };
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
    lens: LensKey;
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

/** 启动 reconcile：把 running / awaiting_input 标记为 interrupted（设计 §3.4）。
 *  awaiting_input 的 session 在重启后已失活（内存态不可恢复），无法继续等待。 */
export function reconcileInterruptedRuns(): number {
  const res = db()
    .update(insightRuns)
    .set({ status: "interrupted", endedAt: new Date().toISOString() })
    .where(sql`${insightRuns.status} in ('running', 'awaiting_input')`)
    .run();
  return res.changes;
}

/** 全量 run（admin 监控用）：带会话标题 + 报告标题，最近 200 条。 */
export function listAllRuns(): Array<InsightRun & { conversationTitle?: string; reportTitle?: string }> {
  const rows = db()
    .select({
      run: insightRuns,
      convTitle: conversations.title,
      repTitle: reports.title,
    })
    .from(insightRuns)
    .leftJoin(conversations, eq(conversations.id, insightRuns.conversationId))
    .leftJoin(reports, eq(reports.id, insightRuns.reportId))
    .orderBy(desc(insightRuns.createdAt))
    .limit(200)
    .all();
  return rows.map((r) => ({
    ...toRunDto(r.run),
    conversationTitle: r.convTitle ?? undefined,
    reportTitle: r.repTitle ?? undefined,
  }));
}

// ─── Run Items（本轮工具命中的信号条目，供证据面板/统计）──────────────────
export interface RunItemRecord {
  id: string;
  runId: string;
  toolName: string;
  sourceType: string;
  sourceName: string;
  sourceId: string;
  title: string;
  url: string;
  summary?: string;
  publishedAt?: string;
  fetchedAt: string;
  createdAt: string;
}

/** 持久化本轮采集的信号条目（按 toolName 标记来源工具；上限由调用方裁剪）。 */
export function recordRunItems(
  runId: string,
  items: { item: DataSourceItem; toolName: string }[],
): void {
  if (!items.length) return;
  const rows = items.map(({ item: it, toolName }) => ({
    id: randomId("ritem"),
    runId,
    toolName,
    sourceType: it.sourceType,
    sourceName: it.sourceName,
    sourceId: it.sourceId,
    title: it.title,
    url: it.url,
    summary: it.summary ?? null,
    publishedAt: it.publishedAt ?? null,
    fetchedAt: it.fetchedAt,
  }));
  db().insert(runItems).values(rows).run();
}

export function listRunItems(runId: string): RunItemRecord[] {
  return db()
    .select()
    .from(runItems)
    .where(eq(runItems.runId, runId))
    .orderBy(desc(runItems.createdAt))
    .all()
    .map((r) => ({
      id: r.id,
      runId: r.runId,
      toolName: r.toolName,
      sourceType: r.sourceType,
      sourceName: r.sourceName,
      sourceId: r.sourceId,
      title: r.title,
      url: r.url,
      summary: r.summary ?? undefined,
      publishedAt: r.publishedAt ?? undefined,
      fetchedAt: r.fetchedAt,
      createdAt: r.createdAt,
    }));
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

/**
 * 按对话取报告摘要（不含 html 大字段），用于历史回放。
 * 按 createdAt 升序返回（便于按 runId 归位时保持时间线顺序）。
 */
export function listReportSummaries(conversationId: string): ReportSummary[] {
  return db()
    .select()
    .from(reports)
    .where(eq(reports.conversationId, conversationId))
    .orderBy(reports.createdAt)
    .all()
    .map((row) => {
      const dto = toReportDto(row);
      // 剥离 html（ReportModal/Card 不需要，下载走 /reports/:id/html）
      const { html: _html, ...summary } = dto;
      void _html;
      return summary;
    });
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

// ─── Data Source Items（RSS 轮询建索引 + FTS5 检索）──────────────────────
/** 批量 upsert 归一化条目（按 id 冲突更新；FTS5 由触发器自动同步）。 */
export function upsertDataSourceItems(items: DataSourceItem[]): number {
  if (!items.length) return 0;
  const rows = items.map((it) => ({
    id: it.id,
    sourceType: it.sourceType,
    sourceName: it.sourceName,
    sourceId: it.sourceId,
    title: it.title,
    url: it.url,
    summary: it.summary ?? null,
    content: it.content ?? null,
    author: it.author ?? null,
    publishedAt: it.publishedAt ?? null,
    tags: JSON.stringify(it.tags ?? []),
    heat: it.heat ?? null,
    fetchedAt: it.fetchedAt,
  }));
  const res = db()
    .insert(dataSourceItems)
    .values(rows)
    .onConflictDoUpdate({
      target: dataSourceItems.id,
      set: {
        sourceName: sql`excluded.source_name`,
        title: sql`excluded.title`,
        summary: sql`excluded.summary`,
        content: sql`excluded.content`,
        author: sql`excluded.author`,
        publishedAt: sql`excluded.published_at`,
        tags: sql`excluded.tags`,
        heat: sql`excluded.heat`,
        fetchedAt: sql`excluded.fetched_at`,
      },
    })
    .run();
  return res.changes;
}

/** raw SQL 行（snake_case 列名）。 */
type RawItemRow = {
  id: string;
  source_type: string;
  source_name: string;
  source_id: string;
  title: string;
  url: string;
  summary: string | null;
  content: string | null;
  author: string | null;
  published_at: string | null;
  tags: string;
  heat: number | null;
  fetched_at: string;
};

/**
 * FTS5 关键词检索 data_source_items。
 * 关键词双引号包裹抑 FTS5 操作符、参数绑定防注入；无关键词返回 []（交调用方回退即时 fetch）。
 */
export function searchDataSourceItemsFts(opts: {
  keywords?: string[];
  timeRange?: TimeRange;
  tags?: DataSourceTag[];
  sourceNames?: string[];
  limit?: number;
}): DataSourceItem[] {
  const keywords = (opts.keywords ?? []).map((k) => k.trim()).filter(Boolean);
  if (!keywords.length) return [];
  const sqlite = getRawSqlite();
  const matchStr = keywords.map((k) => `"${k.replace(/"/g, '""')}"`).join(" OR ");
  const startDate = opts.timeRange ? timeRangeToStartDate(opts.timeRange) : undefined;
  // 列名加 di. 前缀：title/summary/content/author 在 FTS 虚表也存在，否则歧义
  let q = `SELECT di.id, di.source_type, di.source_name, di.source_id, di.title, di.url,
    di.summary, di.content, di.author, di.published_at, di.tags, di.heat, di.fetched_at
    FROM data_source_items_fts JOIN data_source_items di ON di.rowid = data_source_items_fts.rowid
    WHERE data_source_items_fts MATCH ?`;
  const params: (string | number)[] = [matchStr];
  if (startDate) {
    q += ` AND (di.published_at IS NULL OR di.published_at >= ?)`;
    params.push(startDate);
  }
  if (opts.sourceNames?.length) {
    q += ` AND di.source_name IN (${opts.sourceNames.map(() => "?").join(",")})`;
    params.push(...opts.sourceNames);
  }
  q += ` ORDER BY COALESCE(di.published_at, '1970') DESC LIMIT ?`;
  params.push(opts.limit ?? 20);
  const rows = sqlite.prepare(q).all(...params) as RawItemRow[];
  let items: DataSourceItem[] = rows.map((r) => ({
    id: r.id,
    sourceType: r.source_type as DataSourceItem["sourceType"],
    sourceName: r.source_name,
    sourceId: r.source_id,
    title: r.title,
    url: r.url,
    summary: r.summary ?? undefined,
    content: r.content ?? undefined,
    author: r.author ?? undefined,
    publishedAt: r.published_at ?? undefined,
    tags: JSON.parse(r.tags) as DataSourceTag[],
    heat: r.heat ?? undefined,
    fetchedAt: r.fetched_at,
  }));
  if (opts.tags?.length) {
    items = items.filter((it) => opts.tags!.some((t) => it.tags.includes(t)));
  }
  return items;
}

/** 清理过期条目（按 fetched_at；FTS5 由 AFTER DELETE 触发器同步）。 */
export function deleteStaleItems(olderThanDays: number): number {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  const res = getRawSqlite()
    .prepare(`DELETE FROM data_source_items WHERE fetched_at < ?`)
    .run(cutoff);
  return res.changes;
}

// ─── Schedules ────────────────────────────────────────────────────────────
export function listSchedules(userId?: string): Schedule[] {
  const q = userId
    ? db().select().from(schedules).where(eq(schedules.userId, userId))
    : db().select().from(schedules);
  return q.orderBy(desc(schedules.createdAt)).all().map(toScheduleDto);
}

export function getSchedule(id: string): Schedule | undefined {
  const row = db().select().from(schedules).where(eq(schedules.id, id)).all()[0];
  return row ? toScheduleDto(row) : undefined;
}

/** 启用的 schedule（供调度器加载 cron 任务）。 */
export function listEnabledSchedules(): Schedule[] {
  return db()
    .select()
    .from(schedules)
    .where(eq(schedules.enabled, true))
    .orderBy(desc(schedules.createdAt))
    .all()
    .map(toScheduleDto);
}

export function createSchedule(
  userId: string,
  data: {
    prompt: string;
    config: ConversationConfig;
    cron: string;
    lens?: ConversationConfig["lens"];
    nextRunAt?: string;
  },
): Schedule {
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
      nextRunAt: data.nextRunAt ?? null,
    })
    .run();
  return getSchedule(id)!;
}

export function patchSchedule(
  id: string,
  patch: {
    enabled?: boolean;
    cron?: string;
    prompt?: string;
    lens?: ConversationConfig["lens"];
    config?: ConversationConfig;
    nextRunAt?: string;
  },
): Schedule | undefined {
  db()
    .update(schedules)
    .set({
      ...(patch.enabled != null && { enabled: patch.enabled }),
      ...(patch.cron != null && { cron: patch.cron }),
      ...(patch.prompt != null && { prompt: patch.prompt }),
      ...(patch.lens != null && { lens: patch.lens }),
      ...(patch.config != null && { config: JSON.stringify(patch.config) }),
      ...(patch.nextRunAt != null && { nextRunAt: patch.nextRunAt }),
    })
    .where(eq(schedules.id, id))
    .run();
  return getSchedule(id);
}

/** 调度器 fire 后更新 lastRunAt/nextRunAt。 */
export function updateScheduleRunTimes(
  id: string,
  patch: { lastRunAt?: string | null; nextRunAt?: string | null },
): void {
  db()
    .update(schedules)
    .set({
      ...(patch.lastRunAt != null && { lastRunAt: patch.lastRunAt }),
      ...(patch.nextRunAt != null && { nextRunAt: patch.nextRunAt }),
    })
    .where(eq(schedules.id, id))
    .run();
}

export function deleteSchedule(id: string): void {
  db().delete(schedules).where(eq(schedules.id, id)).run();
}

// ─── Settings（KV：proxy/llm/rssCadence；管理端读写）─────────────────────
export function getSetting(key: string): string | undefined {
  const row = db().select().from(settings).where(eq(settings.key, key)).all()[0];
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  db()
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export function getAllSettings(): Record<string, string> {
  const rows = db().select().from(settings).all();
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
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

function toScheduleDto(row: typeof schedules.$inferSelect): Schedule {
  return {
    id: row.id,
    userId: row.userId,
    prompt: row.prompt,
    config: JSON.parse(row.config),
    cron: row.cron,
    lens: (row.lens as Schedule["lens"]) ?? undefined,
    enabled: row.enabled,
    lastRunAt: row.lastRunAt ?? undefined,
    nextRunAt: row.nextRunAt ?? undefined,
    createdAt: row.createdAt,
  };
}
