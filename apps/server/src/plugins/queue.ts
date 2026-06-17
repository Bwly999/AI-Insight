/**
 * queue 插件：decorate('queue', {collection/processing/report/delivery})。
 * 见 doc/design-doc/04-后端架构.md §4.4（四个 BullMQ 队列）。
 *
 * Phase 0 仅建队列实例与连接；worker 在后续 Phase 落地。
 */
import fp from 'fastify-plugin';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config.js';

const QUEUE_NAMES = ['collection', 'processing', 'report', 'delivery'] as const;

export default fp(
  async (app) => {
    const connection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    const queue = {
      collection: new Queue('collection-queue', { connection }),
      processing: new Queue('processing-queue', { connection }),
      report: new Queue('report-queue', { connection }),
      delivery: new Queue('delivery-queue', { connection }),
    };

    app.decorate('queue', queue);

    app.addHook('onClose', async () => {
      await Promise.all(QUEUE_NAMES.map((n) => queue[n].close()));
      await connection.quit();
      app.log.info('bullmq queues + redis closed');
    });

    app.log.info({ queues: QUEUE_NAMES.map((n) => `${n}-queue`) }, 'queue plugin ready (bullmq)');
  },
  { name: 'queue' },
);
