/**
 * 路由聚合：把所有 route 模块注册到 app。
 * 见 doc/design-doc/04-后端架构.md §4.3。
 */
import type { FastifyInstance } from 'fastify';
import healthRoutes from './health.js';
import authRoutes from './auth.js';
import adminRoutes from './admin.js';

export default async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(adminRoutes);
  // 后续 Phase 路由按需 register：
  //   reportsRoutes / subscriptionsRoutes / feedbackRoutes
  //   admin/sources / categories / schedules / cron / proxy / reports / users / channels
}
