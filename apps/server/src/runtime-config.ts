/**
 * 运行时配置 — settings 表（DB 优先）+ env 兜底。支持管理端热切换。
 *
 * apiKey 保持 env-only（不入库，避免 SQLite 存明文密钥）；
 * model / baseUrl / providerName / proxy / rssCadence 可被 settings 覆盖。
 */
import * as repo from "./repo.js";
import { config } from "./config.js";
import type { AgentProviderConfig } from "@ai-insight/agent";

interface LlmOverride {
  providerName?: string;
  baseUrl?: string;
  model?: string;
}

/** LLM provider 配置（model/baseUrl/providerName 可被 settings.llm 覆盖；apiKey 仅 env）。 */
export function getProviderConfig(): AgentProviderConfig {
  const raw = repo.getSetting("llm");
  let overrides: LlmOverride = {};
  if (raw) {
    try {
      overrides = JSON.parse(raw) as LlmOverride;
    } catch {
      /* ignore malformed */
    }
  }
  return {
    providerName: overrides.providerName || config.llm.providerName,
    baseUrl: overrides.baseUrl || config.llm.baseUrl,
    apiKey: config.llm.apiKey, // env-only，绝不入库
    model: overrides.model || config.llm.model,
  };
}

/** 代理 URL（settings.proxy 覆盖 env PROXY_URL；空串=清代理）。 */
export function getProxyUrl(): string {
  return repo.getSetting("proxy") ?? config.proxyUrl;
}

/** RSS 轮询 cron（settings.rssCadence 覆盖 env RSS_POLL_CRON）。 */
export function getRssPollCron(): string {
  return repo.getSetting("rssCadence") ?? config.rssPollCron;
}
