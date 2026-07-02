/**
 * Session 加载器 — 用 Pi 原生 SessionManager.open 从 .jsonl 重建 AgentMessage[]。
 *
 * 与正常对话时完全一致：Pi 内部 buildSessionContext() 处理 compaction/branch。
 * server 的 getConversationWithMessages 调此函数加载历史（不直接依赖 pi-coding-agent）。
 *
 * 类型说明：Pi 的 AgentMessage 联合体扩展了 BashExecution/Custom/Compaction 等自定义消息，
 * 但洞察场景（noTools:"builtin"）只会产生 UserMessage/AssistantMessage/ToolResultMessage 三种。
 * 此处用断言收窄为 shared-types 的 AgentMessage，避免 server 反向依赖 pi 包。
 */
import { existsSync } from "node:fs";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import type { AgentMessage } from "@ai-insight/shared-types";

/**
 * 从 Pi session .jsonl 文件加载 AgentMessage[]。
 * 文件不存在（旧库未迁移）或损坏时返回空数组，UI 降级为「无历史」。
 */
export function loadAgentMessages(sessionFile: string | undefined): AgentMessage[] {
  if (!sessionFile || !existsSync(sessionFile)) return [];
  try {
    const sm = SessionManager.open(sessionFile);
    // 断言收窄：洞察 session 不会产生 Bash/Custom/Compaction 消息（见上注释）
    return sm.buildSessionContext().messages as AgentMessage[];
  } catch {
    // 损坏的 session 文件不应让整个对话 500，降级为空历史
    return [];
  }
}

/** 取 Pi 为新 session 分配的 .jsonl 文件路径（用于回写到 DB）。 */
export function getSessionFile(sessionManager: { getSessionFile(): string | undefined }): string | undefined {
  return sessionManager.getSessionFile();
}
