/**
 * collect 工具 —— 按 sourceCode 调采集器。
 * 复用 Phase 1A 的 app.collectors。
 * 见 dev-spec 1B.5，验收 G2。
 */
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { AgentTool, AgentToolContext } from '../types';
import { sources } from '../../db/schema';

export function createCollectTool(app: FastifyInstance): AgentTool {
  return {
    name: 'collect',
    description: '从指定数据源获取最新内容。按 sourceCode 调预配置的采集器。',
    parameters: {
      type: 'object',
      properties: {
        sourceCode: {
          type: 'string',
          description: '数据源编码（如 rss-solidot, crawl-ithome）',
        },
      },
      required: ['sourceCode'],
    },
    async execute(args: Record<string, unknown>, ctx: AgentToolContext) {
      const sourceCode = args.sourceCode as string;
      if (!sourceCode) throw new Error('sourceCode 必填');

      const [src] = await app.db
        .select()
        .from(sources)
        .where(eq(sources.code, sourceCode))
        .limit(1);
      if (!src) throw new Error(`未知源: ${sourceCode}`);
      if (!src.enabled) throw new Error(`源 "${sourceCode}" 已禁用`);

      const collector = app.collectors.get(src.type);
      if (!collector) throw new Error(`未注册的采集器类型: ${src.type}`);

      const items = await collector.fetch({
        code: src.code,
        type: src.type,
        config: src.config as Record<string, unknown>,
      });

      // 返回摘要（前 10 条 + 总数，避免 token 爆炸）
      const summary = items.slice(0, 10).map((item) => ({
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt?.toISOString(),
      }));

      return { items: summary, total: items.length, sourceCode };
    },
  };
}
