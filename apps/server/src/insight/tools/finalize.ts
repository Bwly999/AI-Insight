/**
 * finalize 工具 —— 产出洞察报告。
 * 必须调，否则 session 无产出。
 * 见 dev-spec 1B.5，验收 G2。
 */
import type { FastifyInstance } from 'fastify';
import type { AgentTool, AgentToolContext } from '../types';

export function createFinalizeTool(app: FastifyInstance): AgentTool {
  return {
    name: 'finalize',
    description: '产出最终洞察报告。调用此工具后 Agent 将会结束会话。',
    parameters: {
      type: 'object',
      properties: {
        reportMarkdown: {
          type: 'string',
          description: '完整的洞察报告（Markdown 格式）',
        },
        sourceArticleIds: {
          type: 'array',
          items: { type: 'number' },
          description: '引用的 article ID 列表',
        },
      },
      required: ['reportMarkdown'],
    },
    async execute(args: Record<string, unknown>, ctx: AgentToolContext) {
      const reportMarkdown = args.reportMarkdown as string;
      if (!reportMarkdown) throw new Error('reportMarkdown 必填');

      const sourceArticleIds = (args.sourceArticleIds as number[]) ?? [];

      return {
        ok: true,
        sessionId: ctx.sessionId,
        reportMarkdown,
        sourceArticleIds,
        message: '报告已生成',
      };
    },
  };
}
