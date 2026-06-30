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

export type ProxySource = "settings" | "env" | null;

/**
 * 当前生效代理的来源（供管理端设置页回显）。
 * - settings：管理端热切换写入 settings.proxy
 * - env：PROXY_URL 环境变量
 * - null：未配置代理（直连）
 */
export function getProxySource(): { value: string; source: ProxySource } {
  const fromSettings = repo.getSetting("proxy");
  if (fromSettings !== undefined) {
    return { value: fromSettings, source: fromSettings ? "settings" : null };
  }
  if (config.proxyUrl) {
    return { value: config.proxyUrl, source: "env" };
  }
  return { value: "", source: null };
}

/** RSS 轮询 cron（settings.rssCadence 覆盖 env RSS_POLL_CRON）。 */
export function getRssPollCron(): string {
  return repo.getSetting("rssCadence") ?? config.rssPollCron;
}
