/**
 * 服务入口 — 启动：init schema + seed + proxy + reconcile + 路由 + listen。
 */
import { buildApp } from "./app.js";
import { getDb, initSchema } from "./db/index.js";
import { seedDev } from "./db/seed-runtime.js";
import { reconcileInterruptedRuns } from "./repo.js";
import { configureProxy } from "@ai-insight/datasources";
import { config } from "./config.js";
import { authRoutes } from "./routes/auth.js";
import { conversationRoutes, setEnqueueRun } from "./routes/conversations.js";
import { runRoutes, registerRunStreamProvider, setAbortHandler } from "./routes/runs.js";
import { reportRoutes } from "./routes/reports.js";
import { dataSourceRoutes } from "./routes/datasources.js";
import { scheduleRoutes } from "./routes/schedules.js";
import { startRunner, type RunnerHandles } from "./runner/index.js";
import { createAgentExecutor } from "./runner/executor.js";
import { startScheduler } from "./jobs/scheduler.js";
import { startRssPoller } from "./jobs/rss-poller.js";
import { getProviderConfig, getProxyUrl } from "./runtime-config.js";
import { adminRoutes } from "./routes/admin.js";

async function main() {
  // 1. DB
  initSchema();
  getDb();
  await seedDev();
  const interrupted = reconcileInterruptedRuns();
  if (interrupted) app_log(`reconciled ${interrupted} interrupted runs`);

  // 2. 数据源代理（模块级 dispatcher；仅作用于经 http.ts 的数据源请求，
  //    不影响 LLM 模型请求；settings.proxy 优先于 env）
  const proxyUrl = getProxyUrl();
  configureProxy(proxyUrl || null);
  if (proxyUrl) app_log(`proxy enabled: ${proxyUrl}`);

  // 3. Runner（Agent 执行器注入；provider 惰性读取支持 settings 热切换）
  const provider = getProviderConfig();
  app_log(`LLM provider: ${provider.providerName} / ${provider.model} @ ${provider.baseUrl || "(empty)"}`);
  const runner: RunnerHandles = startRunner({
    concurrency: config.runConcurrency,
    execute: createAgentExecutor({ getProvider: getProviderConfig }),
  });
  setEnqueueRun((runId, conversationId) => runner.enqueue(runId, conversationId));
  registerRunStreamProvider((runId, push, onClose) =>
    runner.subscribe(runId, push, onClose),
  );
  setAbortHandler((runId) => runner.abort(runId));

  // 4. 定时洞察调度器（node-cron；复用 enqueue 路径触发 run）
  startScheduler((runId, conversationId) => runner.enqueue(runId, conversationId));
  app_log("scheduler started (node-cron)");

  // 5. Fastify
  const app = await buildApp();
  await app.register(authRoutes);
  await app.register(conversationRoutes);
  await app.register(runRoutes);
  await app.register(reportRoutes);
  await app.register(dataSourceRoutes);
  await app.register(scheduleRoutes);
  await app.register(adminRoutes);

  await app.listen({ host: "0.0.0.0", port: config.port });
  app_log(`AI-Insight server listening on :${config.port}`);
  app_log(`auth mode: ${config.jwtSecret ? "JWT(prod)" : "dev-降级"}`);

  // 6. RSS 后台轮询（首拉立即执行，不阻塞 listen）
  startRssPoller();
  app_log(`rss poller started (${config.rssPollCron}, retain ${config.rssRetentionDays}d)`);
}

function app_log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`[server] ${msg}`);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
