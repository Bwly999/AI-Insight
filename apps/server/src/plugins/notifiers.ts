/**
 * notifiers 插件（SPI）：推送通道注册表 + ConsoleNotifier 默认实现。
 * 见 doc/design-doc/04-后端架构.md §4.5、05-可插拔SPI设计.md §5.2。
 *
 * 注册：fastify.registerNotifier(channel, impl)
 * 查表：const n = fastify.notifiers.get(channel)
 *
 * 默认 ConsoleNotifier 打印 payload（满足使用方「简单实现先跑」）。
 * 内网扩展 Email/企微/飞书等：registerNotifier 注册即用，核心 delivery 零改动。
 */
import fp from 'fastify-plugin';
import type { INotificationChannel, NotificationPayload, NotificationResult } from '@ai-insight/shared-types';

/** ConsoleNotifier：打印 payload，零依赖。 */
export class ConsoleNotifier implements INotificationChannel {
  readonly channel = 'CONSOLE';
  async send(p: NotificationPayload): Promise<NotificationResult> {
    // eslint-disable-next-line no-console
    console.log(
      '[NOTIFY→CONSOLE]',
      p.userId,
      p.subject,
      '|',
      p.summary,
      '|',
      p.reportUrl,
    );
    return { ok: true };
  }
}

export default fp(
  async (app) => {
    const notifiers = new Map<string, INotificationChannel>();

    const registerNotifier = (channel: string, impl: INotificationChannel) => {
      notifiers.set(channel, impl);
      app.log.debug({ channel }, 'notifier registered');
    };

    app.decorate('notifiers', notifiers);
    app.decorate('registerNotifier', registerNotifier);

    // 默认实现：ConsoleNotifier
    registerNotifier('CONSOLE', new ConsoleNotifier());

    app.log.info(
      { channels: [...notifiers.keys()] },
      'notifiers plugin ready (SPI registry + CONSOLE)',
    );
  },
  { name: 'notifiers' },
);
