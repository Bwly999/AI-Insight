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

/**
 * 共享临时目录：无工作区（read/bash/edit/write 全禁），cwd 仅占位。
 * 单例避免每 run 泄漏一个临时目录；并发 session 不写盘，共享安全。
 */
let _sharedCwd: string | null = null;
function sharedCwd(): string {
  if (!_sharedCwd) _sharedCwd = mkdtempSync(join(tmpdir(), "aiinsight-"));
  return _sharedCwd;
}
let _sharedAgentDir: string | null = null;
function sharedAgentDir(): string {
  if (!_sharedAgentDir) _sharedAgentDir = mkdtempSync(join(tmpdir(), "pi-agent-"));
  return _sharedAgentDir;
}

/**
 * 创建一个 headless AgentSession。
 *
 * **每次调用都新建**：customTools 是按 run 绑定的闭包（saveReport/onItems 绑定该 run 的
 * runId/conversationId），且单个 AgentSession 不能并发处理多个 prompt。缓存会引发
 * 「工具错绑 + already processing」并发 bug，故不缓存——每 run 一个独立 session。
 *
 * @param provider  LLM provider 配置
 * @param customTools  自定义工具（数据源工具，按 run 绑定）
 */
export async function createInsightSession(
  provider: AgentProviderConfig,
  customTools: ToolDefinition[],
): Promise<AgentSession> {
  const cwd = sharedCwd();
  const aDir = sharedAgentDir();

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
  return session;
}

/**
 * 不再缓存 session（每 run 独立），故此函数为 no-op。
 * 保留导出供 settings 热切换调用点（Phase D）兼容；provider 变更后下一 run 自然用新配置。
 */
export function resetSessionCache(): void {
  /* no-op: sessions are per-run */
}
