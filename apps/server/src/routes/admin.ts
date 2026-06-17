/**
 * 管理端路由骨架（验收 A10：admin 守卫）。
 * 见 doc/design-doc/04-后端架构.md §4.3（管理端路由表）。
 *
 * Phase 0：仅注册一个 `/admin/*` 受保护占位路由，验证
 *   - role=USER → 403
 *   - role=ADMIN → 200
 * 真实 CRUD（sources/categories/schedules/cron/proxy/reports/users/channels）
 * 在 Phase 1–4 逐页落地。
 *
 * 守卫链：preHandler = [app.auth, app.requireAdmin]
 *   auth 把 request.user 注入；requireAdmin 校验 role。
 */
import type { FastifyInstance } from 'fastify';

export default async function adminRoutes(app: FastifyInstance): Promise<void> {
  // 所有 /admin/* 统一挂守卫（封装为一个 prefix 插件更优，这里直接逐路由标注）
  app.get(
    '/admin',
    { preHandler: [app.auth, app.requireAdmin] },
    async (_req, reply) => {
      return reply.send({
        scope: 'admin',
        message: 'admin guard passed',
        routes: [
          '/admin/sources',
          '/admin/categories',
          '/admin/schedules',
          '/admin/cron',
          '/admin/proxy',
          '/admin/reports',
          '/admin/users',
          '/admin/channels',
          '/admin/dashboard',
        ],
      });
    },
  );

  // 仪表盘占位（Phase 5 落地真实指标）
  app.get(
    '/admin/dashboard',
    { preHandler: [app.auth, app.requireAdmin] },
    async (_req, reply) => {
      return reply.send({
        collectedToday: 0,
        pendingProcess: 0,
        reportsThisIssue: 0,
        deliverySuccessRate: 0,
        queueHealth: [
          { queue: 'collection', waiting: 0, active: 0, failed: 0 },
          { queue: 'processing', waiting: 0, active: 0, failed: 0 },
          { queue: 'report', waiting: 0, active: 0, failed: 0 },
          { queue: 'delivery', waiting: 0, active: 0, failed: 0 },
        ],
        recentErrors: [],
      });
    },
  );
}
