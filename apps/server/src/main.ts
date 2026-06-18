/**
 * apps/server 启动入口。
 * 见 doc/design-doc/04-后端架构.md、12-分阶段路线图.md（Phase 0）。
 *
 * Phase 0 装载全部插件（无业务逻辑）：
 *   db / queue / http-client / llm / collectors / notifiers / scheduler / auth
 * + 全局中间件（helmet / cors / rate-limit）
 * + 路由（health / auth / admin 守卫骨架）
 *
 * 启动顺序：插件按依赖先 infra 后 SPI，最后 auth 与路由。
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { config } from './config.js';
import dbPlugin from './plugins/db.js';
import queuePlugin from './plugins/queue.js';
import httpClientPlugin from './plugins/http-client.js';
import cryptoPlugin from './plugins/crypto.js';
import llmPlugin from './plugins/llm.js';
import collectorsPlugin from './plugins/collectors.js';
import notifiersPlugin from './plugins/notifiers.js';
import schedulerPlugin from './plugins/scheduler.js';
import agentRuntimePlugin from './plugins/agent-runtime.js';
import authPlugin from './plugins/auth.js';
import registerRoutes from './routes/index.js';
import { startCollectionWorker } from './workers/collection.worker.js';
import { startProcessingWorker } from './workers/processing.worker.js';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'development' ? 'debug' : 'info',
      transport:
        config.nodeEnv === 'development'
          ? { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', singleLine: false } }
          : undefined,
    },
    trustProxy: true,
  });

  // ---- 全局中间件 ----
  await app.register(helmet, { contentSecurityPolicy: false }); // SPA 反代下 CSP 由 Nginx 管
  await app.register(cors, {
    origin: true, // 内网部署；按需收紧
    credentials: true,
  });
  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
  });

  // ---- 插件：infra → SPI → auth ----
  await app.register(dbPlugin);
  await app.register(queuePlugin);
  await app.register(httpClientPlugin);
  await app.register(cryptoPlugin);
  await app.register(llmPlugin);
  await app.register(collectorsPlugin);
  await app.register(notifiersPlugin);
  await app.register(authPlugin);
  await app.register(schedulerPlugin); // scheduler 在 SPI 之后（可能用 queue）
  await app.register(agentRuntimePlugin); // Phase 1B Mode 2 Agent

  // ---- 路由 ----
  await registerRoutes(app);

  // ---- Worker（开发模式同进程；生产可独立进程） ----
  await startCollectionWorker(app);
  await startProcessingWorker(app);

  // ---- 统一错误处理 ----
  app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;
    req.log.error({ err: err.message, stack: err.stack }, 'request error');
    reply.code(status).send({
      error: status === 500 ? 'internal' : err.name.toLowerCase(),
      message: status === 500 ? 'internal server error' : err.message,
      statusCode: status,
    });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      error: 'not_found',
      message: `route not found: ${req.method} ${req.url}`,
      statusCode: 404,
    });
  });

  return app;
}

async function start(): Promise<void> {
  const app = await buildApp();
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(
      { port: config.port, env: config.nodeEnv },
      '🚀 @ai-insight/server started (Phase 0 skeleton)',
    );
  } catch (err) {
    app.log.error({ err: (err as Error).message }, 'failed to start');
    process.exit(1);
  }

  // 优雅退出
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down...');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('fatal', err);
  process.exit(1);
});
