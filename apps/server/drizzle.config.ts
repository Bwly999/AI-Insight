/**
 * Drizzle Kit 配置。
 * 见 doc/design-doc/06-数据模型.md §6.4、09-基础设施与部署.md §9.6。
 *
 * 命令：
 *   pnpm db:gen   —— 由 schema 生成迁移到 ./drizzle
 *   pnpm db:push  —— 直接应用到 MySQL（开发期）
 *   pnpm db:studio
 */
import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL ?? 'mysql://root:aiinsight@localhost:3306/ai_insight';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    url,
  },
  strict: true,
  verbose: true,
});
