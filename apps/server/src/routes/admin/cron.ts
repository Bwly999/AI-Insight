/**
 * 管理端 · 全局 cron 配置。
 * 见 dev-spec 1A.15，API 清单 B.6。
 *
 * cron 配置存 system_config 表 key='cron.collect' / 'cron.process'。
 */
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { systemConfig } from '../../db/schema';

export default async function adminCronRoutes(app: FastifyInstance): Promise<void> {
  const adminGuard = { preHandler: [app.auth, app.requireAdmin] };

  async function getCronConfig(): Promise<{ collect: string; process: string }> {
    const rows = await app.db.select().from(systemConfig);
    const collect = rows.find((r) => r.key === 'cron.collect')?.value ?? '*/30 * * * *';
    const process = rows.find((r) => r.key === 'cron.process')?.value ?? '0 * * * *';
    return { collect, process };
  }

  async function setCronConfig(key: string, expression: string): Promise<void> {
    const val = JSON.stringify(expression);
    const [existing] = await app.db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, key))
      .limit(1);
    if (existing?.key) {
      await app.db.update(systemConfig).set({ value: val, updatedAt: new Date() }).where(eq(systemConfig.key, key));
    } else {
      await app.db.insert(systemConfig).values({ key, value: val });
    }
  }

  // GET /admin/cron — 读全局 cron
  app.get('/admin/cron', adminGuard, async (_req, reply) => {
    const cfg = await getCronConfig();
    const scheduler = app.scheduler;
    return reply.send({
      collect: {
        expression: cfg.collect,
        nextRuns: scheduler.list().find((c) => c.name === 'collect')?.nextRuns ?? [],
      },
      process: {
        expression: cfg.process,
        nextRuns: scheduler.list().find((c) => c.name === 'process')?.nextRuns ?? [],
      },
    });
  });

  // PUT /admin/cron — 写全局 cron（触发 scheduler 重载）
  app.put('/admin/cron', adminGuard, async (req, reply) => {
    const body = req.body as { collect?: string; process?: string };

    if (body.collect) {
      await setCronConfig('cron.collect', body.collect);
      // scheduler 重载
      app.scheduler.reschedule('collect', body.collect);
    }
    if (body.process) {
      await setCronConfig('cron.process', body.process);
      app.scheduler.reschedule('process', body.process);
    }

    const cfg = await getCronConfig();
    return reply.send(cfg);
  });
}
