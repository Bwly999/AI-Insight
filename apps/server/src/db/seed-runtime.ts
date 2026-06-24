/**
 * 运行时种子（启动时幂等调用）— 与 scripts 的 db:seed 共用数据。
 * 独立成函数便于 main.ts 启动时调用，保证 dev 开箱即用。
 */
import { getDb } from "./index.js";
import { users, dataSources } from "./schema.js";
import { eq } from "drizzle-orm";
import type { DataSourceTag } from "@ai-insight/shared-types";

const DEV_USER = { id: "dev-user", role: "user" as const, name: "WL" };

const SOURCES: {
  id: string;
  type: "search" | "crawler";
  name: string;
  tags: DataSourceTag[];
  config: Record<string, unknown>;
}[] = [
  { id: "search:duckduckgo", type: "search", name: "DuckDuckGo", tags: ["general"], config: { engine: "DuckDuckGo" } },
  { id: "search:exa", type: "search", name: "Exa", tags: ["general", "academic"], config: { engine: "Exa" } },
  { id: "search:firecrawl", type: "search", name: "Firecrawl", tags: ["general"], config: { engine: "Firecrawl" } },
  { id: "crawler:hackernews", type: "crawler", name: "Hacker News", tags: ["tech", "news"], config: { platform: "hackernews" } },
  { id: "crawler:github-trending-today", type: "crawler", name: "GitHub Trending", tags: ["tech"], config: { platform: "github-trending-today" } },
  { id: "crawler:weibo", type: "crawler", name: "微博", tags: ["social", "news"], config: { platform: "weibo" } },
  { id: "crawler:zhihu", type: "crawler", name: "知乎", tags: ["social", "news"], config: { platform: "zhihu" } },
  { id: "crawler:sspai", type: "crawler", name: "少数派", tags: ["tech", "product"], config: { platform: "sspai" } },
  { id: "crawler:tencent-hot", type: "crawler", name: "腾讯新闻", tags: ["news"], config: { platform: "tencent-hot" } },
];

/** 幂等种子：dev 用户 + 数据源 catalog。 */
export async function seedDev(): Promise<void> {
  const db = getDb();

  const userExists = db.select().from(users).where(eq(users.id, DEV_USER.id)).all();
  if (userExists.length === 0) {
    db.insert(users).values(DEV_USER).run();
  }

  for (const s of SOURCES) {
    const exists = db.select().from(dataSources).where(eq(dataSources.id, s.id)).all();
    if (exists.length > 0) continue;
    db.insert(dataSources).values({
      id: s.id,
      type: s.type,
      name: s.name,
      tags: JSON.stringify(s.tags as DataSourceTag[]),
      enabled: true,
      config: JSON.stringify(s.config),
    }).run();
  }
}
