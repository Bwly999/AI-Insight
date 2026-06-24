/**
 * 数据库建表（drizzle push 等价）。
 * 用法：pnpm db:push  →  tsx src/db/migrate.ts push
 * 参数兼容 drizzle-kit 风格，但直接执行原生 DDL（不依赖迁移文件体系）。
 */
import { initSchema, getDb } from "./index.js";

const cmd = process.argv[2] ?? "push";

async function main() {
  if (cmd === "push" || cmd === "init") {
    initSchema();
    // 触发连接
    getDb();
    console.log("✓ schema pushed (tables + FTS5 虚表已就绪)");
  } else {
    console.error(`unknown command: ${cmd}`);
    console.error("用法: tsx src/db/migrate.ts push");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
