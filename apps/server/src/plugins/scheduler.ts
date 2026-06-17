/**
 * scheduler 插件：注册 cron。
 * 见 doc/design-doc/04-后端架构.md §4.2、07-核心流程.md（报告调度模型）。
 *
 * - 采集 cron（全局统一）
 * - 处理 cron（全局统一）
 * - 报告 cron：按各 ReportSchedule.cron 分别配置（Phase 3 由管理端驱动）
 *
 * Phase 0：仅注册调度器骨架与占位回调，不真正入队业务任务，
 *          保证插件可装载、健康检查可见。Phase 1+ 接 BullMQ。
 */
import fp from 'fastify-plugin';

/** 极简 cron 描述器（Phase 0 占位；Phase 1 可换 node-cron / BullMQ Repeat）。 */
interface CronHandle {
  name: string;
  expression: string;
  stop(): Promise<void>;
}

export default fp(
  async (app) => {
    const handles: CronHandle[] = [];

    const registerCron = (name: string, expression: string, tick: () => void): CronHandle => {
      app.log.info({ name, expression }, '[scheduler] cron registered (stub tick)');
      const handle: CronHandle = {
        name,
        expression,
        // Phase 0：不实际调度。Phase 1 由 node-cron 驱动 → fastify.queue.add(...)
        async stop() {},
      };
      // 占位：暴露 tick 以便后续接入（避免未使用告警）
      void tick;
      handles.push(handle);
      return handle;
    };

    // 全局采集 cron（默认每 30 分钟；Phase 1 由管理端 /admin/cron 配置覆盖）
    registerCron('collect', '*/30 * * * *', () => {
      app.log.debug('[scheduler] collect tick');
    });

    // 全局处理 cron（默认每 1 小时）
    registerCron('process', '0 * * * *', () => {
      app.log.debug('[scheduler] process tick');
    });

    // 报告 cron：按 ReportSchedule 各自配置 —— Phase 3 起动态注册
    // （届时遍历 report_schedules，对每个 enabled schedule 调 registerCron）

    app.addHook('onClose', async () => {
      await Promise.all(handles.map((h) => h.stop()));
      app.log.info('scheduler stopped (%d cron handles)', handles.length);
    });

    app.log.info(
      { crons: handles.map((h) => ({ name: h.name, expression: h.expression })) },
      'scheduler plugin ready (collect + process stub crons)',
    );
  },
  { name: 'scheduler' },
);
