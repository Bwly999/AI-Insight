/**
 * 路由聚合：把所有 route 模块注册到 app。
 * 见 doc/design-doc/04-后端架构.md §4.3。
 */
import type { FastifyInstance } from 'fastify';
import healthRoutes from './health.js';
import authRoutes from './auth.js';
import adminRoutes from './admin.js';
import adminSourceRoutes from './admin/sources.js';
import adminCollectRoutes from './admin/collect.js';
import adminProxyRoutes from './admin/proxy.js';
import adminCronRoutes from './admin/cron.js';

export default async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(adminRoutes);

  // Phase 1A · 数据源管理
  await app.register(adminSourceRoutes);
  await app.register(adminCollectRoutes);
  await app.register(adminProxyRoutes);
  await app.register(adminCronRoutes);

  // 后续 Phase 路由按需 register：
  //   reportsRoutes / subscriptionsRoutes / feedbackRoutes
  //   admin/schedules / categories / reports / users / channels / insight / skills
}
