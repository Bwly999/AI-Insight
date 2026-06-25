/**
 * RSS 后台轮询 — node-cron 周期拉启用 feed → 落 data_source_items（FTS5 由触发器同步）。
 *
 * 启动时立即首拉（消除 30min 盲区）；每 tick 后清理过期条目（保留 rssRetentionDays 天）。
 * 即时首拉亦供 datasources 路由在新建/启用 feed 时调用（pollOneFeed）。
 */
import cron, { type ScheduledTask } from "node-cron";
import { fetchRss } from "@ai-insight/datasources";
import * as repo from "../repo.js";
import { config } from "../config.js";
import { getRssPollCron } from "../runtime-config.js";

let _task: ScheduledTask | null = null;

/** 启动轮询（main.ts 在 DB init 后调用）。 */
export function startRssPoller(): void {
  const cronExpr = getRssPollCron();
  if (!cron.validate(cronExpr)) {
    console.warn(`[rss-poller] invalid cron: ${cronExpr}`);
    return;
  }
  _task = cron.schedule(cronExpr, () => {
    void pollAllFeeds();
  });
  // 启动时立即首拉（消除 30min 盲区）
  void pollAllFeeds();
}

/** 拉所有启用的 RSS feed → upsert + 清理过期。 */
export async function pollAllFeeds(): Promise<void> {
  const feeds = repo.listDataSources("rss").filter((d) => d.enabled);
  if (!feeds.length) return;
  const results = await Promise.allSettled(feeds.map((f) => pollOneFeed(f.id)));
  const ok = results.filter((r) => r.status === "fulfilled" && r.value > 0).length;
  const pruned = repo.deleteStaleItems(config.rssRetentionDays);
  console.log(
    `[rss-poller] polled ${feeds.length} feeds (${ok} ok); pruned ${pruned} stale (>${config.rssRetentionDays}d)`,
  );
}

/** 拉单个 feed → upsert 条目（FTS5 触发器自动同步）。返回 upsert 条数。 */
export async function pollOneFeed(dataSourceId: string): Promise<number> {
  const ds = repo.getDataSource(dataSourceId);
  if (!ds || ds.type !== "rss" || !ds.enabled) return 0;
  const feedUrl = (ds.config as { feedUrl?: string }).feedUrl;
  if (!feedUrl) return 0;
  try {
    const items = await fetchRss(feedUrl, { sourceName: ds.name, tags: ds.tags });
    if (items.length) repo.upsertDataSourceItems(items);
    return items.length;
  } catch (e) {
    console.error(`[rss-poller] feed ${ds.name} (${feedUrl}) failed: ${(e as Error).message}`);
    return 0;
  }
}

/** 重排轮询周期（Phase D settings 热切换用）。 */
export function setRssPollCron(cronExpr: string): void {
  if (!cron.validate(cronExpr)) return;
  _task?.stop();
  _task = cron.schedule(cronExpr, () => {
    void pollAllFeeds();
  });
}
