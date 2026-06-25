import { resetDbForTest, initSchema, getRawSqlite } from "../src/db/index.js";

/**
 * 测试用内存库：每测试文件 beforeAll 调一次。建表 + dev 用户，返回 userId。
 * DATABASE_URL=:memory: + resetDbForTest 保证文件间隔离。
 */
export function setupTestDb(): { userId: string } {
  process.env.DATABASE_URL = ":memory:";
  resetDbForTest();
  initSchema();
  getRawSqlite().exec(
    "INSERT OR IGNORE INTO users (id, role, name) VALUES ('dev-user', 'user', 'Dev User')",
  );
  return { userId: "dev-user" };
}
