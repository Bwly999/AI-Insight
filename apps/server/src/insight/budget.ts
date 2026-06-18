/**
 * BudgetGuard —— 预算守卫。
 * 每步检查 token / 步数 / 工具调用次数是否超限。
 * 见 dev-spec 1B.8，验收 G3。
 */
import type { SessionBudget } from '@ai-insight/shared-types';
import { BudgetExceededError } from './types';

export class BudgetGuard {
  private tokens = 0;
  private steps = 0;
  private toolCalls = 0;

  constructor(private budget: SessionBudget) {}

  consume(delta: { tokens?: number; steps?: number; toolCalls?: number }): void {
    this.tokens += delta.tokens ?? 0;
    this.steps += delta.steps ?? 0;
    this.toolCalls += delta.toolCalls ?? 0;

    if (this.tokens >= this.budget.maxTokens) {
      throw new BudgetExceededError(
        `token 预算超限: ${this.tokens}/${this.budget.maxTokens}`,
      );
    }
    if (this.steps >= this.budget.maxSteps) {
      throw new BudgetExceededError(
        `步骤数预算超限: ${this.steps}/${this.budget.maxSteps}`,
      );
    }
    if (this.toolCalls >= this.budget.maxToolCalls) {
      throw new BudgetExceededError(
        `工具调用次数预算超限: ${this.toolCalls}/${this.budget.maxToolCalls}`,
      );
    }
  }

  get usedTokens(): number { return this.tokens; }
  get usedSteps(): number { return this.steps; }
  get usedToolCalls(): number { return this.toolCalls; }

  get maxTokens(): number { return this.budget.maxTokens; }
  get maxSteps(): number { return this.budget.maxSteps; }
  get maxToolCalls(): number { return this.budget.maxToolCalls; }

  /** 剩余预算 */
  remaining(): { tokens: number; steps: number; toolCalls: number } {
    return {
      tokens: Math.max(0, this.budget.maxTokens - this.tokens),
      steps: Math.max(0, this.budget.maxSteps - this.steps),
      toolCalls: Math.max(0, this.budget.maxToolCalls - this.toolCalls),
    };
  }

  /** 快照 */
  snapshot(): { used: { tokens: number; steps: number; toolCalls: number }; max: SessionBudget } {
    return {
      used: { tokens: this.tokens, steps: this.steps, toolCalls: this.toolCalls },
      max: { ...this.budget },
    };
  }

  /** 是否接近上限（>80%） */
  isNearLimit(): boolean {
    const ratio = (field: 'tokens' | 'steps' | 'toolCalls') => {
      const max = this.budget[field];
      if (max <= 0) return 0;
      return this[field] / max;
    };
    return ratio('tokens') > 0.8 || ratio('steps') > 0.8 || ratio('toolCalls') > 0.8;
  }

  /** 工具调用前预估 token（按 args 长度粗估） */
  estimateTokens(args: Record<string, unknown>): number {
    const str = JSON.stringify(args);
    return Math.ceil(str.length / 4); // 粗略：每 4 字符 ≈ 1 token
  }
}
