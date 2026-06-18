/**
 * collection.worker —— 采集工作线程。
 * 监听 collection-queue，对每个 source 执行采集 → 去重 → 入库。
 * 见 dev-spec 1A.12，验收 B2/B4/B6/B8。
 */
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { sources, collectLogs, rawItems } from '../db/schema.js';
import { fingerprint } from '../collectors/fingerprint.js';

/** Job 数据结构 */
interface CollectJobData {
  sourceId?: number; // 指定单源；不指定则遍历所有 enabled 源
  trigger?: string;
}

/** 处理单个来源的采集 */
async function processSource(app: FastifyInstance, sourceId: number): Promise<void> {
  // 1. 查 sources 表
  const [src] = await app.db
    .select()
    .from(sources)
    .where(eq(sources.id, sourceId))
    .limit(1);

  if (!src || !src.enabled) {
    app.log.warn({ sourceId }, '[collection] source 不存在或已禁用');
    return;
  }

  // 2. 插 collect_logs（RUNNING）
  const [log] = await app.db
    .insert(collectLogs)
    .values({
      sourceId: src.id,
      status: 'RUNNING',
      startedAt: new Date(),
    })
    .$returningId();

  const logId = log.id;
  const startedAt = Date.now();

  try {
    // 3. 取采集器
    const collector = app.collectors.get(src.type);
    if (!collector) {
      throw new Error(`未注册的采集器类型: ${src.type}`);
    }

    // 4. 执行采集
    const items = await collector.fetch({
      code: src.code,
      type: src.type,
      config: src.config as Record<string, unknown>,
    });

    // 5. 去重 + 插入 raw_items
    let itemsNew = 0;
    for (const item of items) {
      const fp = fingerprint({
        url: item.url,
        title: item.title,
        sourceCode: src.code,
      });

      try {
        await app.db.insert(rawItems).values({
          sourceId: src.id,
          fingerprint: fp.fingerprint,
          url: item.url,
          title: item.title,
          rawText: item.rawText ?? null,
          publishedAt: item.publishedAt ?? null,
          dedupeKey: fp.dedupeKey,
        });
        itemsNew++;
      } catch (err: unknown) {
        // UNIQUE 冲突 = 已存在，跳过
        if ((err as { code?: string })?.code === 'ER_DUP_ENTRY' ||
            (err as { message?: string })?.message?.includes('Duplicate entry')) {
          app.log.debug({ fingerprint: fp.fingerprint }, '[collection] 跳过重复项');
        } else {
          app.log.error({ err: (err as Error).message, fingerprint: fp.fingerprint }, '[collection] 插入 raw_items 失败');
        }
      }
    }

    // 6. 更新 collect_logs SUCCESS
    const elapsed = Date.now() - startedAt;
    await app.db
      .update(collectLogs)
      .set({
        status: 'SUCCESS',
        finishedAt: new Date(),
        itemsFetched: items.length,
        itemsNew,
      })
      .where(eq(collectLogs.id, logId));

    app.log.info(
      { sourceId: src.id, sourceCode: src.code, type: src.type, itemsFetched: items.length, itemsNew, elapsedMs: elapsed },
      '[collection] 采集完成',
    );
  } catch (err) {
    // 采集失败 → 更新 collect_logs FAILED
    const elapsed = Date.now() - startedAt;
    await app.db
      .update(collectLogs)
      .set({
        status: 'FAILED',
        finishedAt: new Date(),
        error: (err as Error).message?.slice(0, 1000),
      })
      .where(eq(collectLogs.id, logId));

    app.log.error(
      { sourceId: src.id, sourceCode: src.code, err: (err as Error).message, elapsedMs: elapsed },
      '[collection] 采集失败',
    );
    throw err; // 让 BullMQ 重试
  }
}

/** 启动 worker */
export async function startCollectionWorker(app: FastifyInstance): Promise<void> {
  const connection = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  const worker = new Worker<CollectJobData>(
    'collection-queue',
    async (job) => {
      const { sourceId } = job.data;

      if (sourceId != null) {
        // 单源采集
        await processSource(app, sourceId);
      } else {
        // 遍历所有 enabled sources
        const allSources = await app.db
          .select()
          .from(sources)
          .where(eq(sources.enabled, true));

        app.log.info({ count: allSources.length }, '[collection] 批量采集开始');
        for (const src of allSources) {
          try {
            await processSource(app, src.id);
          } catch (err) {
            // 单源失败不影响其他源
            app.log.warn(
              { sourceId: src.id, sourceCode: src.code, err: (err as Error).message },
              '[collection] 批量采集中单源失败',
            );
          }
        }
        app.log.info('[collection] 批量采集结束');
      }
    },
    {
      connection,
      concurrency: 4,
      // 重试策略
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      // 死信队列（超出重试次数）
      removeOnFail: { age: 7 * 24 * 3600 }, // 7 天后自动清理
      removeOnComplete: { age: 24 * 3600 }, // 1 天后清理完成项
    },
  );

  worker.on('failed', (job, err) => {
    app.log.error(
      { jobId: job?.id, sourceId: job?.data?.sourceId, err: err.message },
      '[collection] worker job 达到最大重试次数，进入死信',
    );
  });

  worker.on('completed', (job) => {
    app.log.debug({ jobId: job.id, sourceId: job.data?.sourceId }, '[collection] worker job 完成');
  });

  app.addHook('onClose', async () => {
    await worker.close();
    await connection.quit();
    app.log.info('collection worker stopped');
  });

  app.log.info('collection worker started (bullmq, attempts=3, backoff=exponential)');
}
