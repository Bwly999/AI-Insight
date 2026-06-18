/**
 * AiSdkRuntime —— 用 Vercel AI SDK 实现的 IAgentRuntime 兜底。
 * 当 Pi Agent SDK（W1）不可用时的备用方案。
 * 见 dev-spec 1B.7，验收 G1。
 */
import { streamText, tool } from 'ai';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type {
  IAgentRuntime,
  RunInsightInput,
  RunInsightResult,
  AgentStepEvent,
  SessionBudget,
} from '@ai-insight/shared-types';
import type { AgentTool, AgentToolContext, SkillFrontmatter } from './types';
import { BudgetGuard } from './budget';
import { createInsightTools } from './extension';

/**
 * 将 AgentTool 转为 AI SDK tool 定义。
 */
function toAiSdkTool(t: AgentTool) {
  return tool({
    description: t.description,
    parameters: z.object(
      Object.entries(
        ((t.parameters as { properties?: Record<string, unknown> })?.properties ?? {}) as Record<
          string,
          { type?: string; description?: string }
        >,
      ).reduce(
        (acc, [key, val]) => {
          const v = val as { type?: string; description?: string };
          if (v.type === 'array') {
            (acc as Record<string, unknown>)[key] = z
              .array(z.string())
              .describe(v.description ?? '');
          } else {
            (acc as Record<string, unknown>)[key] = z
              .string()
              .describe(v.description ?? '');
          }
          return acc;
        },
        {} as Record<string, z.ZodTypeAny>,
      ),
    ),
    execute: async (args: Record<string, unknown>) => {
      // 由外层包装处理
      return args;
    },
  });
}

export class AiSdkRuntime implements IAgentRuntime {
  constructor(private app: FastifyInstance) {}

  async run(
    input: RunInsightInput,
    onStep: (event: AgentStepEvent) => void,
  ): Promise<RunInsightResult> {
    const budget = new BudgetGuard(input.budget);
    const tools = createInsightTools(this.app, {
      sessionId: 0, // 由 orchestrator 写入后更新
      userId: input.userId,
      stepNo: 0,
    });

    const systemPrompt = `你是一个 AI 洞察分析师。你的任务是根据用户的意图，使用可用工具收集信息，然后产出结构化的洞察报告。

可用工具：
${tools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

请按以下步骤工作：
1. 先理解用户意图
2. 使用 collect 或 search 工具收集数据
3. 使用 queryArticles 查询已有知识库
4. 综合分析后调用 finalize 产出报告

注意：
- 每次工具调用后仔细分析结果
- 最终必须调用 finalize 产出报告
- 报告用 Markdown 格式`;

    let messages: Array<{ role: 'user' | 'assistant' | 'tool'; content: string; toolCallId?: string }> = [
      { role: 'user', content: input.intent },
    ];

    let stepNo = 0;
    const maxIterations = Math.min(input.budget.maxSteps, 15);

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      budget.consume({ steps: 1 });
      stepNo++;

      try {
        const aiTools = tools.reduce(
          (acc, t) => {
            acc[t.name] = toAiSdkTool(t);
            return acc;
          },
          {} as Record<string, ReturnType<typeof tool>>,
        );

        const result = await streamText({
          model: this.app.llm.chat as Parameters<typeof streamText>[0]['model'],
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'tool',
            content: m.content,
            ...(m.toolCallId ? { toolCallId: m.toolCallId } : {}),
          })),
          tools: aiTools,
          maxSteps: 1, // 每次迭代只走一步
        });

        // 消耗估算 token
        const usage = await result.usage;
        budget.consume({ tokens: usage?.totalTokens ?? 0 });

        // 处理响应
        let fullContent = '';
        for await (const chunk of result.textStream) {
          fullContent += chunk;
        }

        if (fullContent) {
          onStep({
            type: 'step',
            stepNo,
            role: 'ASSISTANT',
            content: fullContent,
            tokens: usage?.totalTokens,
          });
          messages.push({ role: 'assistant', content: fullContent });

          // 检查是否调用了 finalize
          if (fullContent.toLowerCase().includes('报告已生成') ||
              fullContent.includes('finalize')) {
            break;
          }
        }

        // 检查是否有工具调用
        const toolCalls = (result as unknown as { toolCalls?: Array<{ toolName: string; args: Record<string, unknown> }> })?.toolCalls ?? [];

        for (const tc of toolCalls) {
          const toolDef = tools.find((t) => t.name === tc.toolName);
          if (!toolDef) continue;

          onStep({
            type: 'tool_call',
            stepNo,
            toolName: tc.toolName,
            toolArgs: tc.args,
          });

          const startTime = Date.now();
          try {
            const toolResult = await toolDef.execute(tc.args, {
              sessionId: 0,
              userId: input.userId,
              stepNo,
            });

            budget.consume({ toolCalls: 1 });

            onStep({
              type: 'tool_result',
              stepNo,
              toolName: tc.toolName,
              toolResult,
            });

            messages.push({
              role: 'tool',
              content: JSON.stringify(toolResult),
              toolCallId: tc.toolName,
            });

            // 如果 finalize 成功，结束循环
            if (tc.toolName === 'finalize') {
              const result = toolResult as { reportMarkdown?: string; sourceArticleIds?: number[] };
              onStep({ type: 'final', stepNo, content: result.reportMarkdown });

              return {
                sessionId: 0,
                status: 'SUCCESS',
                reportMarkdown: result.reportMarkdown,
                usedTokens: budget.usedTokens,
                usedSteps: budget.usedSteps,
                usedToolCalls: budget.usedToolCalls,
              };
            }
          } catch (err) {
            onStep({
              type: 'tool_result',
              stepNo,
              toolName: tc.toolName,
              toolResult: { error: (err as Error).message },
            });
            messages.push({
              role: 'tool',
              content: `错误: ${(err as Error).message}`,
              toolCallId: tc.toolName,
            });
          }
        }
      } catch (err) {
        if ((err as Error).name === 'BudgetExceededError') {
          onStep({ type: 'error', stepNo, content: '预算超限', status: 'ABORTED' });
          return {
            sessionId: 0,
            status: 'ABORTED',
            usedTokens: budget.usedTokens,
            usedSteps: budget.usedSteps,
            usedToolCalls: budget.usedToolCalls,
          } as RunInsightResult;
        }
        throw err;
      }
    }

    // 未调 finalize
    onStep({ type: 'error', stepNo, content: '未调用 finalize 工具', status: 'FAILED' });
    return {
      sessionId: 0,
      status: 'FAILED',
      usedTokens: budget.usedTokens,
      usedSteps: budget.usedSteps,
      usedToolCalls: budget.usedToolCalls,
    } as RunInsightResult;
  }
}
