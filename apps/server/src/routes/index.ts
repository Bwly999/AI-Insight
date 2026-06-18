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
import adminInsightRoutes from './admin/insight.js';
import adminSkillRoutes from './admin/skills.js';
import insightRoutes from './insight.js';

export default async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(adminRoutes);

  // Phase 1A · 数据源管理
  await app.register(adminSourceRoutes);
  await app.register(adminCollectRoutes);
  await app.register(adminProxyRoutes);
  await app.register(adminCronRoutes);

  // Phase 1B · Mode 2 主动洞察
  await app.register(insightRoutes);
  await app.register(adminInsightRoutes);

  // Phase 1C · Skill 管理
  await app.register(adminSkillRoutes);

  // 后续 Phase 路由按需 register：
  //   reportsRoutes / subscriptionsRoutes / feedbackRoutes
  //   admin/schedules / categories / reports / users / channels / skills
}
