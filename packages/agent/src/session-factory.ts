/**
 * Agent 会话工厂 — 注册 DeepSeek OpenAI 兼容 provider，创建 headless AgentSession。
 *
 * 裁剪（见 ADR-0003）：
 *  - DefaultResourceLoader 全 no* + 自定义 systemPrompt（禁 skills/extensions/context）
 *  - noTools: "builtin"（禁 read/bash/edit/write；仅 customTools 生效）
 *  - 无工作区：cwd 指空临时目录
 *  - SessionManager.inMemory（持久化归 DB 管，见 §3.2）
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  AuthStorage,
  ModelRegistry,
  type AgentSession,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { INSIGHT_SYSTEM_PROMPT } from "./system-prompt.js";

export interface AgentProviderConfig {
  /** provider 名（如 deepseek） */
  providerName: string;
  /** OpenAI 兼容 base url */
  baseUrl: string;
  apiKey: string;
  /** model id（如 deepseek-v4-flash） */
  model: string;
}

let _cachedSession: AgentSession | null = null;
let _cachedKey = "";

/**
 * 创建（或复用）一个 headless AgentSession。
 *
 * @param provider  LLM provider 配置
 * @param customTools  自定义工具（数据源工具）
 * @param agentDir  pi agent 配置目录（默认空临时目录）
 */
export async function createInsightSession(
  provider: AgentProviderConfig,
  customTools: ToolDefinition[],
  agentDir?: string,
): Promise<AgentSession> {
  const key = JSON.stringify(provider);
  if (_cachedSession && key === _cachedKey) return _cachedSession;

  // 无工作区：空临时目录（ADR-0003 风险项兜底）
  const cwd = mkdtempSync(join(tmpdir(), "aiinsight-"));
  const aDir = agentDir ?? mkdtempSync(join(tmpdir(), "pi-agent-"));

  const authStorage = AuthStorage.inMemory();
  const modelRegistry = ModelRegistry.create(authStorage, undefined as never);

  // 注册 DeepSeek（OpenAI 兼容）
  modelRegistry.registerProvider(provider.providerName, {
    name: provider.providerName,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    api: "openai-completions",
    models: [
      {
        id: provider.model,
        name: provider.model,
        api: "openai-completions",
        reasoning: true,
        compat: { thinkingFormat: "deepseek" } as never,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128_000,
        maxTokens: 8_192,
      },
    ],
  });

  const model = modelRegistry.find(provider.providerName, provider.model);
  if (!model) {
    throw new Error(`model not found after register: ${provider.providerName}/${provider.model}`);
  }

  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir: aDir,
    settingsManager: SettingsManager.inMemory(),
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt: INSIGHT_SYSTEM_PROMPT,
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    model,
    modelRegistry,
    authStorage,
    resourceLoader,
    sessionManager: SessionManager.inMemory(cwd),
    settingsManager: SettingsManager.inMemory(),
    noTools: "builtin", // 禁全部内置 read/bash/edit/write
    customTools,
  });

  _cachedSession = session;
  _cachedKey = key;
  return session;
}

/** 重置缓存（测试 / provider 变更时）。 */
export function resetSessionCache(): void {
  _cachedSession = null;
  _cachedKey = "";
}
