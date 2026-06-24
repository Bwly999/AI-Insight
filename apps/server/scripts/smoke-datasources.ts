/**
 * 数据源冒烟测试（开发期手动跑，验证 crawler/search 真能抓）。
 * 用法：pnpm --filter @ai-insight/server exec tsx scripts/smoke-datasources.ts
 */
import {
  fanoutCrawl,
  createDefaultCrawlers,
  fanoutSearch,
  createDefaultEngines,
} from "@ai-insight/datasources";

async function main() {
  console.log("\n=== [1] 爬虫冒烟：HackerNews + GitHub Trending ===");
  try {
    const crawlers = createDefaultCrawlers();
    const res = await fanoutCrawl(
      { platforms: ["hackernews", "github-trending-today"], perPlatformLimit: 3 },
      crawlers,
    );
    console.log("perPlatform:", JSON.stringify(res.perPlatform));
    for (const it of res.items.slice(0, 4)) {
      console.log(`  - [${it.sourceName}] ${it.title} (heat=${it.heat})`);
    }
  } catch (e) {
    console.error("crawl smoke failed:", (e as Error).message);
  }

  console.log("\n=== [2] 搜索冒烟：DuckDuckGo（无 key） ===");
  try {
    const engines = createDefaultEngines();
    const res = await fanoutSearch(
      { query: "AI coding agent 2026", perEngineLimit: 3, engines: ["DuckDuckGo"] },
      engines,
    );
    console.log("perEngine:", JSON.stringify(res.perEngine));
    for (const it of res.items.slice(0, 3)) {
      console.log(`  - [${it.sourceName}] ${it.title}`);
      console.log(`      ${it.url}`);
    }
  } catch (e) {
    console.error("search smoke failed:", (e as Error).message);
  }
}

main().catch(console.error);
