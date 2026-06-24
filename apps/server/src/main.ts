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
import { createAgentExecutor, providerFromConfig } from "./runner/executor.js";

async function main() {
  // 1. DB
  initSchema();
  getDb();
  await seedDev();
  const interrupted = reconcileInterruptedRuns();
  if (interrupted) app_log(`reconciled ${interrupted} interrupted runs`);

  // 2. 代理（全局出站）
  configureProxy(config.proxyUrl || null);
  if (config.proxyUrl) app_log(`proxy enabled: ${config.proxyUrl}`);

  // 3. Runner（Agent 执行器注入）
  const provider = providerFromConfig();
  app_log(`LLM provider: ${provider.providerName} / ${provider.model} @ ${provider.baseUrl || "(empty)"}`);
  const runner: RunnerHandles = startRunner({
    concurrency: config.runConcurrency,
    execute: createAgentExecutor({ provider }),
  });
  setEnqueueRun((runId, conversationId) => runner.enqueue(runId, conversationId));
  registerRunStreamProvider((runId, push, onClose) =>
    runner.subscribe(runId, push, onClose),
  );
  setAbortHandler((runId) => runner.abort(runId));

  // 4. Fastify
  const app = await buildApp();
  await app.register(authRoutes);
  await app.register(conversationRoutes);
  await app.register(runRoutes);
  await app.register(reportRoutes);
  await app.register(dataSourceRoutes);
  await app.register(scheduleRoutes);

  await app.listen({ host: "0.0.0.0", port: config.port });
  app_log(`AI-Insight server listening on :${config.port}`);
  app_log(`auth mode: ${config.jwtSecret ? "JWT(prod)" : "dev-降级"}`);
}

function app_log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`[server] ${msg}`);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
