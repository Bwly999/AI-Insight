/**
 * Agent 会话工厂 — 注册 DeepSeek OpenAI 兼容 provider，创建 headless AgentSession。
 *
 * 裁剪（见 ADR-0003）：
 *  - DefaultResourceLoader 全 no* + 自定义 systemPrompt（禁 skills/extensions/context）
 *  - noTools: "builtin"（禁 read/bash/edit/write；仅 customTools 生效）
 *  - 无工作区：cwd 指空临时目录
 *  - SessionManager 走 Pi 原生持久化（.jsonl，每个 conversation 一个文件）
 */
import { constants, mkdtempSync, mkdirSync } from "node:fs";
import { access as fsAccess, readFile as fsReadFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  createAgentSession,
  createReadToolDefinition,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  AuthStorage,
  ModelRegistry,
  type AgentSession,
  type ReadOperations,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { INSIGHT_SYSTEM_PROMPT } from "./system-prompt.js";
import type { LensKey } from "@ai-insight/shared-types";

/**
 * Lens reference 文件名 → LensKey 映射。
 * 当模型 read 某个 Lens 的 reference 时，据此推断它选用了哪个视角。
 */
const LENS_REF_FILES: Record<string, LensKey> = {
  "deep-insight.md": "deep",
  "dual-take.md": "dual",
  "flash-brief.md": "flash",
  "timeline-trace.md": "timeline",
};

export interface AgentProviderConfig {
  /** provider 名（如 deepseek） */
  providerName: string;
  /** OpenAI 兼容 base url */
  baseUrl: string;
  apiKey: string;
  /** model id（如 deepseek-v4-flash） */
  model: string;
}

/** createInsightSession 的可选配置。 */
export interface InsightSessionOptions {
  /**
   * ai-insight skill 目录（含 SKILL.md + references/）。
   * 提供后：注入沙箱 read 工具（让模型按需读 skill body / references），
   * 并让 loader 仅加载该 skill（noSkills:true + additionalSkillPaths，不扫全局）。
   * 不提供则退化为旧行为（无 skill、无 read）。
   */
  skillDir?: string;
  /**
   * 当模型 read 某个 Lens 的 reference 文件时触发（推断 Agent 实际选用的视角）。
   * 每个 Lens 在一次 session 内只触发一次（避免重复）。server 据此 emit lens_selected。
   */
  onLensSelected?: (lens: LensKey) => void;
  /**
   * Pi SessionManager 持久化根目录（每个 conversation 一个子目录，存 .jsonl）。
   * 提供后：开启 Pi 原生持久化——首次运行用 SessionManager.create 新建文件，
   * 后续传入 sessionFile 时用 SessionManager.open 恢复历史。
   * 不提供则退化为 inMemory（无持久化，仅测试用）。
   */
  sessionDir?: string;
  /**
   * 既有 session 文件绝对路径（恢复对话历史用）。
   * 提供时用 SessionManager.open(sessionFile, sessionDir) 恢复；
   * 不提供时用 SessionManager.create(cwd, sessionDir) 新建。
   */
  sessionFile?: string;
}

/**
 * 构造沙箱 read 工具：只允许读 skillDir 子树内的文件。
 * 用 ReadOperations 钩子在 filesystem 级拦截越界路径——不靠 prompt 约束。
 * 该工具名 "read"，使 buildSystemPrompt 的 customPromptHasRead 闸门通过 → skill 元数据进 prompt。
 *
 * 副作用：当读到 `references/<lens>.md` 时触发 onLensSelected（每 Lens 一次），据此暴露 Agent 选用的视角。
 */
function createSandboxedReadTool(
  skillDir: string,
  onLensSelected?: (lens: LensKey) => void,
): ToolDefinition {
  const root = resolve(skillDir);
  const fired = new Set<LensKey>();
  const assertWithin = (absolutePath: string) => {
    // relative(root, abs)：同根下返回相对路径（不以 .. 开头）；越界返回 ../... 或绝对路径
    const rel = relative(root, resolve(absolutePath));
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error(`Permission denied: read 沙箱仅限 skill 目录（${absolutePath}）`);
    }
    return rel;
  };
  const maybeNotifyLens = (absolutePath: string) => {
    if (!onLensSelected) return;
    const rel = relative(root, resolve(absolutePath)).replace(/\\/g, "/");
    // 形如 "references/dual-take.md"
    const m = rel.match(/^references\/([^/]+\.md)$/);
    if (!m) return;
    const lens = LENS_REF_FILES[m[1]];
    if (lens && !fired.has(lens)) {
      fired.add(lens);
      onLensSelected(lens);
    }
  };
  const operations: ReadOperations = {
    readFile: async (p) => {
      assertWithin(p);
      maybeNotifyLens(p);
      return await fsReadFile(p);
    },
    access: async (p) => {
      assertWithin(p);
      await fsAccess(p, constants.R_OK);
    },
  };
  return createReadToolDefinition(root, { operations }) as ToolDefinition;
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
  opts?: InsightSessionOptions,
): Promise<AgentSession> {
  const cwd = sharedCwd();
  const aDir = sharedAgentDir();

  // 接入 ai-insight skill（见 ADR-0006）：
  //  - 注入沙箱 read 工具（名 "read"）→ buildSystemPrompt 的 customPromptHasRead 闸门通过
  //    → skill 元数据进 prompt，模型用 read 按需打开 SKILL.md / references（渐进披露）
  //  - additionalSkillPaths + noSkills:true → loader 只加载该 skill，不扫 ~/.agents/skills/
  const skillDir = opts?.skillDir;
  const tools = skillDir
    ? [...customTools, createSandboxedReadTool(skillDir, opts?.onLensSelected)]
    : customTools;

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
    noSkills: true, // 不扫默认位置（含 ~/.agents/skills/），杜绝全局 skill 泄漏
    additionalSkillPaths: skillDir ? [skillDir] : [], // 仅显式加载 ai-insight
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
    // Pi 原生 SessionManager：有 sessionDir 则走 .jsonl 持久化（恢复对话历史用），
    // 否则退化为 inMemory（仅测试用）。createAgentSession 内部会用
    // buildSessionContext() 注水历史到 agent.state.messages——与正常对话时一致。
    sessionManager: buildSessionManager(cwd, opts),
    settingsManager: SettingsManager.inMemory(),
    noTools: "builtin", // 禁 bash/edit/write；read 以 customTool 形式注入（见 createSandboxedReadTool）
    customTools: tools,
  });
  return session;
}

/**
 * 构造 Pi SessionManager：
 *  - 有 sessionFile：open 既有文件（恢复历史）
 *  - 有 sessionDir 无 sessionFile：create 新建（首次运行，executor 运行后回写路径到 DB）
 *  - 都没有：inMemory（仅测试，无持久化）
 */
function buildSessionManager(cwd: string, opts?: InsightSessionOptions): SessionManager {
  const sessionDir = opts?.sessionDir;
  const sessionFile = opts?.sessionFile;
  if (sessionFile) {
    return SessionManager.open(sessionFile, sessionDir);
  }
  if (sessionDir) {
    mkdirSync(sessionDir, { recursive: true });
    return SessionManager.create(cwd, sessionDir);
  }
  return SessionManager.inMemory(cwd);
}

/**
 * 不再缓存 session（每 run 独立），故此函数为 no-op。
 * 保留导出供 settings 热切换调用点（Phase D）兼容；provider 变更后下一 run 自然用新配置。
 */
export function resetSessionCache(): void {
  /* no-op: sessions are per-run */
}
