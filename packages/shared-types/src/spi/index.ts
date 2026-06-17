/**
 * SPI 接口契约总导出。
 * 见 doc/design-doc/05-可插拔SPI设计.md。
 */
export type {
  RawItemInput,
  SourceConfig,
  CollectorHealth,
  ICollector,
} from './collector.js';

export type {
  NotificationPayload,
  NotificationResult,
  INotificationChannel,
} from './notifier.js';
