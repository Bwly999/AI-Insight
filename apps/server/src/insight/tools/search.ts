/**
 * search 工具 —— 搜索查询类 API（mode='query' 的 SEARCH_API 源）。
 * 见 dev-spec 1B.5，验收 G2。
 */
import { eq, and } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { AgentTool, AgentToolContext } from '../types';
import { sources } from '../../db/schema';

export function createSearchTool(app: FastifyInstance): AgentTool {
  return {
    name: 'search',
    description: '用搜索引擎查询最新信息。内部调 mode=query 的 SEARCH_API 采集器。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        sourceCode: {
          type: 'string',
          description: '可选，指定搜索引擎的源 code（默认选第一个可用的搜索源）',
        },
      },
      required: ['query'],
    },
    async execute(args: Record<string, unknown>, ctx: AgentToolContext) {
      const query = args.query as string;
      if (!query) throw new Error('query 必填');

      let sourceCode = args.sourceCode as string | undefined;

      if (!sourceCode) {
        // 默认选第一个 enabled 的 mode='query' 源
        const allSources = await app.db
          .select()
          .from(sources)
          .where(and(eq(sources.enabled, true), eq(sources.type, 'SEARCH_API')));

        const querySource = allSources.find((s) => {
          const cfg = s.config as Record<string, unknown>;
          return cfg.mode === 'query';
        });
        if (!querySource) throw new Error('无可用的搜索引擎源');
        sourceCode = querySource.code;
      }

      const [src] = await app.db
        .select()
        .from(sources)
        .where(eq(sources.code, sourceCode!))
        .limit(1);

      if (!src) throw new Error(`未知源: ${sourceCode}`);
      if (!src.enabled) throw new Error(`源 "${sourceCode}" 已禁用`);

      const collector = app.collectors.get(src.type);
      if (!collector) throw new Error(`未注册的采集器类型: ${src.type}`);

      // 将 query 注入 config
      const config = { ...(src.config as Record<string, unknown>) } as Record<string, unknown>;
      if (config.mode === 'query') {
        // 用 query 替换 queryTemplate 中的 {keyword}
        const template = (config.queryTemplate as string) ?? '{keyword}';
        config.queryTemplate = template.replace('{keyword}', query);
      }

      const items = await collector.fetch({
        code: src.code,
        type: src.type,
        config,
      });

      const summary = items.slice(0, 10).map((item) => ({
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt?.toISOString(),
      }));

      return { items: summary, total: items.length, query, sourceCode };
    },
  };
}
