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
}
