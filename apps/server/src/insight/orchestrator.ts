/**
 * insight orchestrator —— session 编排。
 * 创建 session → 加载 skill → 运行 Agent → 持久化 trace → 更新状态。
 * 见 dev-spec 1B.8，验收 G3/G4。
 */
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type {
  RunInsightInput,
  RunInsightResult,
  SessionBudget,
  AgentStepEvent,
} from '@ai-insight/shared-types';
import { insightSessions, agentSteps, agentToolCalls } from '../db/schema';
import { loadSkills } from './skill-loader';
import { BudgetExceededError } from './types';
import { BudgetGuard } from './budget';

export interface RunInsightArgs {
  userId: number;
  intent: string;
  skillSet: string[];
  budget: SessionBudget;
  onStep: (event: AgentStepEvent) => void;
}

export async function runInsightSession(
  app: FastifyInstance,
  args: RunInsightArgs,
): Promise<{ sessionId: number }> {
  // 1. 创建 session 记录
  const [session] = await app.db
    .insert(insightSessions)
    .values({
      userId: args.userId,
      intent: args.intent,
      skillSet: args.skillSet,
      status: 'RUNNING',
      budget: args.budget,
    })
    .$returningId();

  const sessionId = session.id;

  // 异步启动 Agent（不阻塞 SSE 响应）
  setImmediate(async () => {
    try {
      const result = await runWithTrace(app, sessionId, args);

      // 更新 session
      await app.db
        .update(insightSessions)
        .set({
          status: result.status,
          reportMarkdown: result.reportMarkdown ?? null,
          usedTokens: result.usedTokens,
          usedSteps: result.usedSteps,
          usedToolCalls: result.usedToolCalls,
          finishedAt: new Date(),
          error: result.status === 'FAILED' ? 'Agent 执行失败' : null,
        })
        .where(eq(insightSessions.id, sessionId));

      args.onStep({
        type: 'final',
        stepNo: result.usedSteps,
        content: result.reportMarkdown,
        tokens: result.usedTokens,
      });
    } catch (err) {
      const isBudget = (err as Error).name === 'BudgetExceededError';
      await app.db
        .update(insightSessions)
        .set({
          status: isBudget ? 'ABORTED' : 'FAILED',
          finishedAt: new Date(),
          error: (err as Error).message?.slice(0, 1000),
        })
        .where(eq(insightSessions.id, sessionId));

      args.onStep({
        type: 'error',
        stepNo: 0,
        content: (err as Error).message,
        status: isBudget ? 'ABORTED' : 'FAILED',
      });
    }
  });

  return { sessionId };
}

async function runWithTrace(
  app: FastifyInstance,
  sessionId: number,
  args: RunInsightArgs,
): Promise<RunInsightResult> {
  const budget = new BudgetGuard(args.budget);

  // 加载 skill
  const skills = await loadSkills(app, args.skillSet);

  // 合并 skill 的 budget override
  const mergedBudget: SessionBudget = { ...args.budget };
  for (const skill of skills) {
    if (skill.frontmatter.budget) {
      Object.assign(mergedBudget, skill.frontmatter.budget);
    }
  }

  // 创建 tool context
  const toolCtx = { sessionId, userId: args.userId, stepNo: 0 };

  // 在 runtime 中注册工具的审计包装
  const originalOnStep = args.onStep;
  let stepNo = 0;

  const wrappedOnStep = async (event: AgentStepEvent) => {
    stepNo = event.stepNo || stepNo + 1;

    // 写 agent_steps
    if (event.type === 'step' || event.type === 'tool_call') {
      await app.db.insert(agentSteps).values({
        sessionId,
        stepNo,
        role: event.role ?? 'ASSISTANT',
        content: event.content ?? null,
        toolCalls: event.toolName ? [{ name: event.toolName, args: event.toolArgs }] : null,
        tokens: event.tokens ?? 0,
      });
    }

    // 写 agent_tool_calls
    if (event.type === 'tool_call' || event.type === 'tool_result') {
      await app.db.insert(agentToolCalls).values({
        sessionId,
        stepId: null, // 简化：不关联 step
        tool: (event.toolName?.toUpperCase() ?? 'COLLECT') as any,
        args: event.toolArgs as any,
        result: event.toolResult as any,
        ok: event.type !== 'error',
        error: event.type === 'error' ? (event.content ?? null) : null,
        durationMs: 0,
      });
    }

    // 转发给原始 onStep（SSE）
    originalOnStep(event);
  };

  // 运行 Agent
  const result = await app.agentRuntime.run(
    {
      userId: args.userId,
      intent: args.intent,
      skillSet: args.skillSet,
      budget: mergedBudget,
    },
    (event) => {
      // 同步执行，但用 void 处理异步写入
      void wrappedOnStep(event);
      // 阻塞等待写入完成有性能问题，这里简化处理
    },
  );

  return result;
}
