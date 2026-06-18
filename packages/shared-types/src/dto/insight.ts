/**
 * Mode 2 主动洞察 DTO。
 * 见 dev-spec 1B.2，附录 A.13/A.14/A.15。
 */
import { z } from 'zod';

export const CreateInsightSessionBody = z.object({
  intent: z.string().min(1).max(2000),
  skillSet: z.array(z.string()).default(['lens-deep-insight']),
  budget: z
    .object({
      maxSteps: z.number().int().min(1).max(100).default(25),
      maxToolCalls: z.number().int().min(1).max(200).default(40),
      maxTokens: z.number().int().min(1000).max(500000).default(60000),
    })
    .default({ maxSteps: 25, maxToolCalls: 40, maxTokens: 60000 }),
});
export type CreateInsightSessionBody = z.infer<typeof CreateInsightSessionBody>;

export interface InsightSessionView {
  id: number;
  userId: number;
  intent: string;
  skillSet: string[];
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ABORTED';
  budget: { maxSteps: number; maxToolCalls: number; maxTokens: number };
  usedTokens: number;
  usedSteps: number;
  usedToolCalls: number;
  reportMarkdown: string | null;
  sourceArticleIds: number[];
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}

export interface AgentStepView {
  id: number;
  sessionId: number;
  stepNo: number;
  role: 'ASSISTANT' | 'TOOL' | 'SYSTEM';
  content: string | null;
  toolCalls: unknown[] | null;
  tokens: number;
  createdAt: string;
}

export interface AgentToolCallView {
  id: number;
  sessionId: number;
  stepId: number | null;
  tool: string;
  args: unknown;
  result: unknown;
  ok: boolean;
  error: string | null;
  durationMs: number;
  createdAt: string;
}
