/**
 * Insight 模块内部类型。
 * 见 dev-spec 1B.3 / 附录 A.19.3。
 */
import type { SessionBudget } from '@ai-insight/shared-types';
import type { AgentToolName } from '@ai-insight/shared-types';

/** Skill YAML frontmatter（解析后） */
export interface SkillFrontmatter {
  name: string;
  description: string;
  version: string;
  tools: AgentToolName[];
  vaultWrite?: boolean;
  budget?: Partial<SessionBudget>;
  trigger?: { keywords?: string[] };
}

/** 工具上下文（execute 时传入） */
export interface AgentToolContext {
  sessionId: number;
  userId: number;
  stepNo: number;
}

/** 工具定义 */
export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, ctx: AgentToolContext) => Promise<unknown>;
}

/** 预算超出错误 */
export class BudgetExceededError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'BudgetExceededError';
  }
}
