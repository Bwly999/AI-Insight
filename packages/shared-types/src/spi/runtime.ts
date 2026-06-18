/**
 * IAgentRuntime —— Mode 2 Agent 运行时 SPI。
 * 见 design-doc/16 §5.2 / dev-spec 1B.3，附录 A.19.3。
 */

export interface SessionBudget {
  maxSteps: number;
  maxToolCalls: number;
  maxTokens: number;
}

export interface RunInsightInput {
  userId: number;
  intent: string;
  skillSet: string[];
  budget: SessionBudget;
}

export interface RunInsightResult {
  sessionId: number;
  status: 'SUCCESS' | 'FAILED' | 'ABORTED';
  reportMarkdown?: string;
  usedTokens: number;
  usedSteps: number;
  usedToolCalls: number;
}

export interface AgentStepEvent {
  type: 'step' | 'tool_call' | 'tool_result' | 'final' | 'error';
  stepNo: number;
  role?: 'ASSISTANT' | 'TOOL' | 'SYSTEM';
  content?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  tokens?: number;
}

export interface IAgentRuntime {
  run(
    input: RunInsightInput,
    onStep: (event: AgentStepEvent) => void,
  ): Promise<RunInsightResult>;
}
