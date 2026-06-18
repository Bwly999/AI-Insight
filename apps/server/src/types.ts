/**
 * Fastify 实例/请求的类型增强：注册所有 decorate 的字段。
 * 见 doc/design-doc/04-后端架构.md §4.2。
 */
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { Queue, QueueOptions } from 'bullmq';
import type { Dispatcher } from 'undici';
import type { ICollector, INotificationChannel } from '@ai-insight/shared-types';
import type * as schema from './db/schema.js';
import type { AuthUser } from '@ai-insight/shared-types';
import type { CryptoUtil } from './utils/crypto.js';
import type { Scheduler } from './plugins/scheduler.js';

/** 队列集合（四个 BullMQ 队列）。 */
export interface QueueSet {
  collection: Queue;
  processing: Queue;
  report: Queue;
  delivery: Queue;
}

/** LLM 客户端（Vercel AI SDK）。 */
export interface LlmClient {
  /** chat 模型句柄，喂给 generateText/generateObject */
  chat: unknown;
  model: string;
}

/** Fastify 实例上的 decorate 字段。 */
export interface FastifyDecorates {
  db: MySql2Database<typeof schema>;
  queue: QueueSet;
  http: Dispatcher;
  llm: LlmClient;
  collectors: Map<string, ICollector>;
  notifiers: Map<string, INotificationChannel>;
  registerCollector: (type: string, impl: ICollector) => void;
  registerNotifier: (channel: string, impl: INotificationChannel) => void;
  crypto: CryptoUtil;
  rebuildHttpAgent: (proxy?: ProxyConfig) => void;
  scheduler: Scheduler;
}

/** 代理配置（用于 http-client 重建）。 */
export interface ProxyConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  auth?: { scheme: 'none' | 'basic' | 'bearer'; token?: string };
}

/** 请求上的用户（auth preHandler 注入）。 */
declare module 'fastify' {
  interface FastifyInstance extends FastifyDecorates {}
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/** 默认 BullMQ 队列配置（公共 options 类型复用）。 */
export type { QueueOptions };
