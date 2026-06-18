/**
 * 管理端 · 采集控制（手动触发 + 日志）。
 * 见 dev-spec 1A.14，API 清单 B.5。
 */
import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { PaginationQuery } from '@ai-insight/shared-types';
import { collectLogs, sources } from '../../db/schema';

export default async function adminCollectRoutes(app: FastifyInstance): Promise<void> {
  const adminGuard = { preHandler: [app.auth, app.requireAdmin] };

  // POST /admin/collect/run — 手动触发采集（全部或单源）
  app.post('/admin/collect/run', adminGuard, async (req, reply) => {
    const body = (req.body ?? {}) as { sourceId?: number };
    const job = await app.queue.collection.add(
      'manual-collect',
      { sourceId: body.sourceId, trigger: 'manual' },
    );
    return reply.send({ jobId: job.id ?? '' });
  });

  // GET /admin/collect/logs — 采集日志
  app.get('/admin/collect/logs', adminGuard, async (req, reply) => {
    const query = PaginationQuery.parse(req.query);
    const { page, pageSize } = query;
    const q = req.query as Record<string, string>;
    const sourceId = q['sourceId'] ? Number(q['sourceId']) : undefined;
    const status = q['status'];

    let where = undefined;
    if (sourceId) where = eq(collectLogs.sourceId, sourceId);

    const rows = await app.db
      .select({
        id: collectLogs.id,
        sourceId: collectLogs.sourceId,
        sourceCode: sources.code,
        sourceName: sources.name,
        status: collectLogs.status,
        startedAt: collectLogs.startedAt,
        finishedAt: collectLogs.finishedAt,
        itemsFetched: collectLogs.itemsFetched,
        itemsNew: collectLogs.itemsNew,
        error: collectLogs.error,
      })
      .from(collectLogs)
      .leftJoin(sources, eq(collectLogs.sourceId, sources.id))
      .where(where)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .orderBy(desc(collectLogs.startedAt));

    return reply.send({
      items: rows,
      total: rows.length, // 简化版 total
      page,
      pageSize,
    });
  });
}
