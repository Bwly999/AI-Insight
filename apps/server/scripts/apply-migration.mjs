// @ts-check
/**
 * 应用最新的 Drizzle 迁移到 MySQL。
 *
 * 背景：drizzle-kit push 在 MySQL 8.0.28（及部分 8.0.x）上会因
 *   information_schema.check_constraints 报错（drizzle-kit #1451）。
 *   本脚本绕过 push，直接把生成的 *_*.sql 应用：
 *     1. 去掉 drizzle 的 --> statement-breakpoint 注释（mysql 客户端不识别）
 *     2. 前置 SET SESSION explicit_defaults_for_timestamp=1
 *        （规避旧版 MySQL 时间戳隐式 NOT NULL + NO_ZERO_DATE 严格模式冲突）
 *
 * 用法：pnpm db:migrate
 * 前置：先 pnpm db:gen 生成迁移。DATABASE_URL 指向目标库。
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = dirname(fileURLToPath(import.meta.url));
const drizzleDir = join(__dirname, '..', 'drizzle');

function parseUrl(u) {
  const m = u.match(/^mysql:\/\/([^:@]+)(?::([^@]*))?@([^:/]+)(?::(\d+))?\/(.+)$/);
  if (!m) throw new Error(`无法解析 DATABASE_URL: ${u}`);
  const [, user, password = '', host, port = '3306', database] = m;
  return { host, port: Number(port), user, password, database };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未设置');

  const files = (await readdir(drizzleDir))
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  const latest = files[files.length - 1];
  if (!latest) throw new Error('未找到迁移文件（先运行 pnpm db:gen）');
  console.log(`[migrate] 应用最新迁移: ${latest}`);

  const raw = await readFile(join(drizzleDir, latest), 'utf8');
  // 去掉 statement-breakpoint 标记（带或不带前后换行）
  const cleaned = raw
    .replace(/\r?\n-->\s*statement-breakpoint/g, '')
    .replace(/-->\s*statement-breakpoint\r?\n/g, '');

  const sql = 'SET SESSION explicit_defaults_for_timestamp=1;\n' + cleaned;

  const cfg = parseUrl(url);
  const conn = await mysql.createConnection({ ...cfg, multipleStatements: true });
  try {
    await conn.query(sql);
    console.log('[migrate] 成功');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[migrate] 失败:', e.message);
  process.exit(1);
});
