/**
 * insight extension —— 聚合所有受控工具。
 * 只注册白名单内的 4 个工具。
 * 见 dev-spec 1B.5，验收 G5。
 */
import type { FastifyInstance } from 'fastify';
import type { AgentTool, AgentToolContext } from './types';
import { createCollectTool } from './tools/collect';
import { createSearchTool } from './tools/search';
import { createQueryArticlesTool } from './tools/query-articles';
import { createFinalizeTool } from './tools/finalize';

/** 白名单：仅允许这些工具 */
const ALLOWED_TOOLS = ['collect', 'search', 'queryArticles', 'finalize'];

export function createInsightTools(
  app: FastifyInstance,
  ctx: AgentToolContext,
): AgentTool[] {
  const allTools: AgentTool[] = [
    createCollectTool(app),
    createSearchTool(app),
    createQueryArticlesTool(app),
    createFinalizeTool(app),
  ];

  // 只返回白名单内的工具
  return allTools.filter((t) => ALLOWED_TOOLS.includes(t.name));
}
