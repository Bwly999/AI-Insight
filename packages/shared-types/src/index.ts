/**
 * @ai-insight/shared-types
 *
 * 前后端共享的类型层（验收 F1：单一事实来源，避免手写重复类型漂移）。
 * - enums: 枚举/字面量（与 MySQL 枚举列一致）
 * - spi:   ICollector / INotificationChannel 契约
 * - dto:   请求/响应 DTO（含 zod 运行时校验）
 */
export * from './enums.js';
export * as SPI from './spi/index.js';
export * from './dto/index.js';

// 再导出 SPI 命名空间的顶层类型，便于 `import { ICollector } from '@ai-insight/shared-types'`
export type {
  ICollector,
  RawItemInput,
  SourceConfig,
  CollectorHealth,
} from './spi/index.js';
export type {
  INotificationChannel,
  NotificationPayload,
  NotificationResult,
} from './spi/index.js';
