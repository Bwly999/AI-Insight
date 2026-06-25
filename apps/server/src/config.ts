/**
 * 配置加载 — 从 .env.local + process.env 读取，统一 env 命名。
 *
 * 兼容用户的 .env.local（OPENAI_API_KEY / OPENAI_COMPAT_BASE_URL / AI_DEFAULT_MODEL）
 * 与设计文档的 LLM_* 命名。
 */
import dotenv from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

/**
 * 定位 .env.local：从 cwd 向上逐级查找直到仓库根（含 pnpm-workspace.yaml）。
 * 因为 server 可能在 apps/server 或仓库根启动。
 */
function findEnvLocal(startDir: string): string | undefined {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, ".env.local");
    if (existsSync(candidate)) return candidate;
    // 仓库根标志：含 pnpm-workspace.yaml
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) {
      return existsSync(candidate) ? candidate : undefined;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

const envLocal = findEnvLocal(process.cwd());
if (envLocal) {
  dotenv.config({ path: envLocal });
} else {
  dotenv.config({ path: resolve(process.cwd(), ".env.local") });
}
dotenv.config(); // 兜底 .env

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) {
    console.warn(`[config] missing env: ${key}`);
  }
  return v ?? "";
}

export const config = {
  port: parseInt(process.env.PORT ?? "3000", 10),
  databaseUrl: process.env.DATABASE_URL ?? "./data/insight.db",

  // LLM（兼容 .env.local 的 OPENAI_* 命名 + 设计的 LLM_* 命名）
  llm: {
    baseUrl: process.env.LLM_BASE_URL ?? process.env.OPENAI_COMPAT_BASE_URL ?? "",
    apiKey: process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? process.env.AI_DEFAULT_MODEL ?? "deepseek-v4-flash",
    providerName: process.env.LLM_PROVIDER ?? "deepseek",
  },

  // 数据源 key
  exaApiKey: process.env.EXA_API_KEY ?? "",
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY ?? "",
  jinaApiKey: process.env.JINA_API_KEY ?? "",
  rsshubBase: process.env.RSSHUB_BASE ?? "",

  // 鉴权（留空 → dev 降级）
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtIssuer: process.env.JWT_ISSUER ?? "",
  jwtAudience: process.env.JWT_AUDIENCE ?? "",

  // 运行
  proxyUrl: process.env.PROXY_URL ?? "",
  runConcurrency: parseInt(process.env.RUN_CONCURRENCY ?? "3", 10),
  rssPollCron: process.env.RSS_POLL_CRON ?? "*/30 * * * *",
  rssRetentionDays: parseInt(process.env.RSS_RETENTION_DAYS ?? "90", 10),
};

export type AppConfig = typeof config;

/** 是否为 dev 鉴权降级模式（无 JWT 配置）。 */
export function isDevAuthMode(): boolean {
  return !config.jwtSecret;
}
