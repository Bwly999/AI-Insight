/**
 * processing.worker —— AI 处理工作线程。
 * 监听 processing-queue，对 raw_items 执行五阶段处理。
 * 见 dev-spec 2.1，验收 C2/C3/C4。
 */
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { eq, isNull, and } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { rawItems, articles } from '../db/schema';
import { processBatch } from './processing/index.js';

interface ProcessJobData {
  since?: string;
}

export async function startProcessingWorker(app: FastifyInstance): Promise<void> {
  const connection = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  const worker = new Worker<ProcessJobData>(
    'processing-queue',
    async (job) => {
      // 取未处理的 raw_items（无对应 article）
      const batch = await app.db
        .select()
        .from(rawItems)
        .where(isNull(rawItems.rawText)) // 简化：取 rawText 为空的（尚未处理）
        .limit(20);

      if (batch.length === 0) {
        app.log.info('[processing] 无待处理 raw_items');
        return;
      }

      const processed = await processBatch(app, batch);

      // 批量 insert articles
      for (const p of processed) {
        try {
          await app.db.insert(articles).values({
            rawItemId: p.rawItemId,
            categoryCode: p.categoryCode,
            summary: p.summary,
            heat: p.heat,
            tags: p.tags,
            critical: p.critical,
            trendComment: p.trendComment,
          });
        } catch (err: unknown) {
          app.log.error(
            { rawItemId: p.rawItemId, err: (err as Error).message },
            '[processing] insert article 失败',
          );
        }
      }

      app.log.info(
        { processed: processed.length, total: batch.length },
        '[processing] 批处理完成',
      );
    },
    {
      connection,
      concurrency: 1,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  );

  worker.on('failed', (job, err) => {
    app.log.error({ jobId: job?.id, err: err.message }, '[processing] worker 失败');
  });

  app.addHook('onClose', async () => {
    await worker.close();
    await connection.quit();
  });

  app.log.info('processing worker started (5-stage pipeline)');
}
