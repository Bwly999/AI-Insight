/**
 * GET /health —— 健康检查（验收 A4）。
 * 不需要鉴权。返回进程存活 + 各插件装载状态。
 */
import type { FastifyInstance } from 'fastify';

export default async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_req, reply) => {
    const plugins = {
      db: !!app.db,
      queue: !!app.queue,
      http: !!app.http,
      llm: !!app.llm,
      collectors: app.collectors?.size ?? 0,
      notifiers: app.notifiers?.size ?? 0,
    };
    return reply.code(200).send({
      status: 'ok',
      service: '@ai-insight/server',
      time: new Date().toISOString(),
      plugins,
    });
  });

  // Nginx 反代健康探针别名（/api/health → server:3000/health，见 08-前端架构 §8.5）
  app.get('/api/health', async (_req, reply) => reply.redirect('/health', 302));
}
