/**
 * insight extension —— 聚合所有受控工具。
 * Phase 1C：7 个工具全部注册。
 * 白名单仅允许安全的工具（G5）。
 * 见 dev-spec 1B.5 / 1C.2 / 1C.3。
 */
import type { FastifyInstance } from 'fastify';
import type { AgentTool, AgentToolContext, SkillFrontmatter } from './types';
import { createCollectTool } from './tools/collect';
import { createSearchTool } from './tools/search';
import { createQueryArticlesTool } from './tools/query-articles';
import { createFinalizeTool } from './tools/finalize';
import { createExtractTool } from './tools/extract';
import { createVaultReadTool, createVaultWriteTool } from './tools/vault';

/** 基础白名单（所有 session 都有） */
const BASE_TOOLS = ['collect', 'search', 'queryArticles', 'finalize', 'extract', 'vaultRead'];

/** 需要 skill 声明的工具 */
const OPT_IN_TOOLS = ['vaultWrite'];

export function createInsightTools(
  app: FastifyInstance,
  ctx: AgentToolContext,
  skill?: SkillFrontmatter,
): AgentTool[] {
  const allTools: AgentTool[] = [
    createCollectTool(app),
    createSearchTool(app),
    createQueryArticlesTool(app),
    createFinalizeTool(app),
    createExtractTool(app.http),
    createVaultReadTool(app),
  ];

  // vaultWrite 需要 skill 声明 vault_write=true
  if (skill?.vaultWrite) {
    allTools.push(createVaultWriteTool(app));
  }

  // 按 skill 的 tools 白名单筛选
  const allowedTools = skill?.tools ? [...BASE_TOOLS, ...OPT_IN_TOOLS] : BASE_TOOLS;
  return allTools.filter((t) => allowedTools.includes(t.name));
}
