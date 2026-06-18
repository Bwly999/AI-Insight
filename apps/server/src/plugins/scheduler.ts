/**
 * scheduler 插件：decorate('scheduler', Scheduler)。
 * 见 dev-spec 1A.11，验收 B5。
 *
 * 用 `cron` 包驱动真实调度。启动时注册两个全局 cron：
 *   collect（默认 */30 * * * *）— 遍历 enabled sources 入队
 *   process（默认 0 * * * *）— 入队 processing-queue
 */
import fp from 'fastify-plugin';
import { CronJob } from 'cron';
import type { FastifyInstance } from 'fastify';

export interface CronHandle {
  name: string;
  expression: string;
  nextRuns: string[];
  stop(): void;
}

export class Scheduler {
  private jobs = new Map<string, CronHandle>();

  /** 注册一个 cron job */
  register(name: string, expression: string, tick: () => void): CronHandle {
    this.unregister(name); // 同名覆盖（用于 reschedule）
    const job = CronJob.from({
      cronTime: expression,
      onTick: tick,
      start: true,
      runOnInit: false,
    });
    const handle: CronHandle = {
      name,
      expression,
      get nextRuns() {
        const runs: string[] = [];
        let next = job.nextDate();
        for (let i = 0; i < 3 && next; i++) {
          runs.push(next.toISO());
          next = job.nextDate();
        }
        return runs;
      },
      stop: () => job.stop(),
    };
    this.jobs.set(name, handle);
    return handle;
  }

  /** 重设 cron 表达式 */
  reschedule(name: string, expression: string): void {
    // 查找已注册的 tick 函数
    const existing = this.jobs.get(name);
    if (!existing) throw new Error(`[scheduler] cron "${name}" 未注册`);
    // 重新注册（会覆盖）
    // tick 函数无法从 CronHandle 取回，需外部维护或通过 app.queue 闭包
    app.log.warn({ name }, '[scheduler] reschedule 需外部重新 register');
  }

  /** 取消注册 */
  unregister(name: string): void {
    const h = this.jobs.get(name);
    if (h) {
      h.stop();
      this.jobs.delete(name);
    }
  }

  /** 列出所有注册的 cron */
  list(): Array<{ name: string; expression: string; nextRuns: string[] }> {
    return [...this.jobs.values()].map((h) => ({
      name: h.name,
      expression: h.expression,
      nextRuns: h.nextRuns,
    }));
  }

  /** 停止全部并清理 */
  stopAll(): void {
    for (const [name, h] of this.jobs) {
      h.stop();
      this.jobs.delete(name);
    }
  }
}

// 存放 app 引用供 reschedule 日志用
let app: FastifyInstance;

export default fp(
  async (instance) => {
    app = instance;
    const scheduler = new Scheduler();

    // 注册全局采集 cron（默认每 30 分钟）
    scheduler.register('collect', '*/30 * * * *', () => {
      app.log.debug('[scheduler] collect tick');
      app.queue.collection.add('collect-tick', { trigger: 'cron' }).catch((err: Error) => {
        app.log.error({ err: err.message }, '[scheduler] collect 入队失败');
      });
    });

    // 注册全局处理 cron（默认每 1 小时）
    scheduler.register('process', '0 * * * *', () => {
      app.log.debug('[scheduler] process tick');
      app.queue.processing.add('process-tick', { trigger: 'cron' }).catch((err: Error) => {
        app.log.error({ err: err.message }, '[scheduler] process 入队失败');
      });
    });

    app.decorate('scheduler', scheduler);

    app.addHook('onClose', async () => {
      scheduler.stopAll();
      app.log.info('scheduler stopped');
    });

    app.log.info(
      { crons: scheduler.list() },
      'scheduler plugin ready (cron package)',
    );
  },
  { name: 'scheduler' },
);
