/**
 * 管理端 · 处理控制。
 * 见 dev-spec 2.3，API 清单 B.8。
 */
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { articles } from '../../db/schema';

export default async function adminProcessRoutes(app: FastifyInstance): Promise<void> {
  const adminGuard = { preHandler: [app.auth, app.requireAdmin] };

  // POST /admin/process/run — 手动触发处理
  app.post('/admin/process/run', adminGuard, async (_req, reply) => {
    const job = await app.queue.processing.add('manual-process', {});
    return reply.send({ jobId: job.id ?? '' });
  });

  // GET /admin/process/status — 处理状态
  app.get('/admin/process/status', adminGuard, async (_req, reply) => {
    return reply.send({
      pending: 0,
      running: 0,
      failed: 0,
      tokenUsage: 0,
    });
  });

  // POST /admin/process/rerun/:articleId — 重跑单条
  app.post('/admin/process/rerun/:articleId', adminGuard, async (req, reply) => {
    const { articleId } = req.params as { articleId: string };
    await app.db.delete(articles).where(eq(articles.id, Number(articleId)));
    return reply.send({ ok: true, message: '已删除，下次处理将重新生成' });
  });
}
