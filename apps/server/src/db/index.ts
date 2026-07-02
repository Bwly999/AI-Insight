/**
 * 数据库实例 + 初始化（better-sqlite3 + WAL + 外键 + FTS5 虚表）。
 *
 * 单文件零运维（见 ADR-0005）。WAL 提升并发读；data_source_items_fts
 * 供 RSS 关键词检索（MVP 留好，RSS 轮询建索引时启用）。
 */
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type DB = BetterSQLite3Database<typeof schema>;

let _db: DB | null = null;
let _sqlite: Database.Database | null = null;

/**
 * 打开/创建数据库。dbPath 默认 ./data/insight.db（env DATABASE_URL 可覆盖）。
 * 幂等：重复调用返回同一实例。
 */
export function getDb(dbPath?: string): DB {
  if (_db) return _db;
  const raw = dbPath ?? process.env.DATABASE_URL ?? "./data/insight.db";
  // :memory: 不能 resolve（Windows 上冒号会被当盘符），better-sqlite3 原样识别
  const path = raw === ":memory:" ? raw : resolve(raw);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  _sqlite = sqlite;
  _db = drizzle(sqlite, { schema });
  return _db;
}

/** 原生 better-sqlite3 句柄（执行 raw SQL / FTS5 DDL 用）。 */
export function getRawSqlite(): Database.Database {
  if (!_sqlite) getDb();
  return _sqlite!;
}

/**
 * 建表（drizzle push 等价：直接 CREATE TABLE IF NOT EXISTS）。
 * 用 better-sqlite3 原生执行，避免依赖 drizzle-kit 的迁移体系。
 */
export function initSchema(): void {
  const sqlite = getRawSqlite();
  sqlite.exec(SCHEMA_SQL);
  // 既有库补列（CREATE TABLE IF NOT EXISTS 不会给已存在的表加列）
  ensureColumn("conversations", "deleted_at", "TEXT");
  ensureColumn("conversations", "session_file", "TEXT");
  // 旧库迁移：insight_runs.trigger_message_id 去掉 NOT NULL + FK（消息历史改由 Pi .jsonl 持久化）
  migrateInsightRunsTriggerColumn();
  // FTS5 虚表（data_source_items 的全文索引）
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS data_source_items_fts USING fts5(
      title, summary, content, author,
      content='data_source_items', content_rowid='rowid', tokenize='unicode61'
    );
  `);
  // FTS5 external-content 同步触发器：主表增改删时自动同步索引
  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS data_source_items_ai AFTER INSERT ON data_source_items BEGIN
      INSERT INTO data_source_items_fts(rowid, title, summary, content, author)
      VALUES (new.rowid, new.title, new.summary, new.content, new.author);
    END;
    CREATE TRIGGER IF NOT EXISTS data_source_items_ad AFTER DELETE ON data_source_items BEGIN
      INSERT INTO data_source_items_fts(data_source_items_fts, rowid, title, summary, content, author)
      VALUES ('delete', old.rowid, old.title, old.summary, old.content, old.author);
    END;
    CREATE TRIGGER IF NOT EXISTS data_source_items_au AFTER UPDATE ON data_source_items BEGIN
      INSERT INTO data_source_items_fts(data_source_items_fts, rowid, title, summary, content, author)
      VALUES ('delete', old.rowid, old.title, old.summary, old.content, old.author);
      INSERT INTO data_source_items_fts(rowid, title, summary, content, author)
      VALUES (new.rowid, new.title, new.summary, new.content, new.author);
    END;
  `);
}

/** 幂等加列：表已存在但缺该列时 ALTER ADD COLUMN。 */
function ensureColumn(table: string, column: string, ddl: string): void {
  const sqlite = getRawSqlite();
  const cols = sqlite.pragma(`table_info(${table})`) as { name: string }[];
  if (cols.length > 0 && !cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl};`);
  }
}

/**
 * 旧库迁移：insight_runs.trigger_message_id 去 NOT NULL + FK。
 *
 * 消息历史已迁移至 Pi SessionManager .jsonl，trigger_message_id 不再 FK 到 messages(id)。
 * 旧库该列是 `TEXT NOT NULL REFERENCES messages(id)`，SQLite 不能直接改约束，
 * 用 12 步表重建法（SQLite 官方推荐）：建新表 → 拷数据 → 删旧 → 改名 → 重建索引。
 * 幂等：检测到旧约束（notnull=1 或有 FK）时才执行。
 */
function migrateInsightRunsTriggerColumn(): void {
  const sqlite = getRawSqlite();
  const cols = sqlite.pragma("table_info(insight_runs)") as { name: string; notnull: number }[];
  const triggerCol = cols.find((c) => c.name === "trigger_message_id");
  if (!triggerCol || triggerCol.notnull === 0) return; // 已迁移（新库或已重建）

  // 检测 FK（pragma foreign_key_list）
  const fks = sqlite.pragma("foreign_key_list(insight_runs)") as { table: string }[];
  const hasFkToMessages = fks.some((f) => f.table === "messages");

  sqlite.exec("PRAGMA foreign_keys=OFF;");
  sqlite.exec("BEGIN TRANSACTION;");
  try {
    sqlite.exec(`
      CREATE TABLE insight_runs_new (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        trigger_message_id TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        lens TEXT,
        config TEXT NOT NULL DEFAULT '{}',
        prompt TEXT NOT NULL,
        started_at TEXT,
        ended_at TEXT,
        tokens INTEGER,
        report_id TEXT,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
      INSERT INTO insight_runs_new SELECT * FROM insight_runs;
      DROP TABLE insight_runs;
      ALTER TABLE insight_runs_new RENAME TO insight_runs;
      CREATE INDEX IF NOT EXISTS idx_runs_conv ON insight_runs(conversation_id);
    `);
    sqlite.exec("COMMIT;");
  } catch (e) {
    sqlite.exec("ROLLBACK;");
    throw e;
  } finally {
    sqlite.exec("PRAGMA foreign_keys=ON;");
  }
}

/** 测试用：重置单例，使下一轮 getDb 重新打开（如 :memory: 新库）。 */
export function resetDbForTest(): void {
  try {
    _sqlite?.close();
  } catch {
    // 忽略：可能已关闭
  }
  _db = null;
  _sqlite = null;
}

/** 全部建表 SQL（与 Drizzle schema 对齐）。 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user',
  external_id TEXT,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  session_file TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_call TEXT,
  run_id TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE TABLE IF NOT EXISTS insight_runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  trigger_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  lens TEXT,
  config TEXT NOT NULL DEFAULT '{}',
  prompt TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  tokens INTEGER,
  report_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_runs_conv ON insight_runs(conversation_id);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES insight_runs(id),
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  title TEXT NOT NULL,
  standfirst TEXT,
  markdown TEXT NOT NULL,
  html TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE TABLE IF NOT EXISTS run_items (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES insight_runs(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT,
  published_at TEXT,
  fetched_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_run_items_run ON run_items(run_id);
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE TABLE IF NOT EXISTS data_source_items (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  author TEXT,
  published_at TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  heat INTEGER,
  fetched_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  prompt TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  cron TEXT NOT NULL,
  lens TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export { schema };
