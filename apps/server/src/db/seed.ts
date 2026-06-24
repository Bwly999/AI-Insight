/**
 * 种子数据：dev 用户 + 数据源 catalog（3 搜索引擎 + 6 爬虫平台）。
 * 幂等：已存在的 id 跳过。
 *
 * 搜索引擎：固定存在、仅启停（设计：不可删）。
 * 爬虫：每个 newsnow 平台一行；platform id 对齐 crawler。
 */
import { getDb, initSchema } from "./index.js";
import { users, dataSources } from "./schema.js";
import { eq } from "drizzle-orm";
import type { DataSourceTag } from "@ai-insight/shared-types";

const DEV_USER = { id: "dev-user", role: "user" as const, name: "WL" };

interface SeedSource {
  id: string;
  type: "search" | "rss" | "crawler";
  name: string;
  tags: DataSourceTag[];
  enabled: boolean;
  config: Record<string, unknown>;
}

const SOURCES: SeedSource[] = [
  // 搜索（3 引擎，固定）
  { id: "search:duckduckgo", type: "search", name: "DuckDuckGo", tags: ["general"], enabled: true, config: { engine: "DuckDuckGo" } },
  { id: "search:exa", type: "search", name: "Exa", tags: ["general", "academic"], enabled: true, config: { engine: "Exa" } },
  { id: "search:firecrawl", type: "search", name: "Firecrawl", tags: ["general"], enabled: true, config: { engine: "Firecrawl" } },
  // 爬虫（6 平台）
  { id: "crawler:hackernews", type: "crawler", name: "Hacker News", tags: ["tech", "news"], enabled: true, config: { platform: "hackernews" } },
  { id: "crawler:github-trending-today", type: "crawler", name: "GitHub Trending", tags: ["tech"], enabled: true, config: { platform: "github-trending-today" } },
  { id: "crawler:weibo", type: "crawler", name: "微博", tags: ["social", "news"], enabled: true, config: { platform: "weibo" } },
  { id: "crawler:zhihu", type: "crawler", name: "知乎", tags: ["social", "news"], enabled: true, config: { platform: "zhihu" } },
  { id: "crawler:sspai", type: "crawler", name: "少数派", tags: ["tech", "product"], enabled: true, config: { platform: "sspai" } },
  { id: "crawler:tencent-hot", type: "crawler", name: "腾讯新闻", tags: ["news"], enabled: true, config: { platform: "tencent-hot" } },
];

async function main() {
  initSchema();
  const db = getDb();

  // dev 用户
  const existing = db.select().from(users).where(eq(users.id, DEV_USER.id)).all();
  if (existing.length === 0) {
    db.insert(users).values(DEV_USER).run();
    console.log(`✓ created dev user: ${DEV_USER.id}`);
  }

  // 数据源 catalog
  let inserted = 0;
  for (const s of SOURCES) {
    const exists = db.select().from(dataSources).where(eq(dataSources.id, s.id)).all();
    if (exists.length > 0) continue;
    db.insert(dataSources)
      .values({
        id: s.id,
        type: s.type,
        name: s.name,
        tags: JSON.stringify(s.tags),
        enabled: s.enabled,
        config: JSON.stringify(s.config),
      })
      .run();
    inserted++;
  }
  console.log(`✓ data sources: ${inserted} inserted (${SOURCES.length} total cataloged)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
