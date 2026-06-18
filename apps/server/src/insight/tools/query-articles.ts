/**
 * queryArticles 工具 —— 查询已处理的 Article 池。
 * 见 dev-spec 1B.5，验收 G2。
 */
import { eq, and, like, gte, desc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { AgentTool, AgentToolContext } from '../types';
import { articles } from '../../db/schema';

export function createQueryArticlesTool(app: FastifyInstance): AgentTool {
  return {
    name: 'queryArticles',
    description: '查询已处理的知识库文章。按关键词/分类/时间筛选。',
    parameters: {
      type: 'object',
      properties: {
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: '关键词列表（标题/摘要模糊匹配）',
        },
        category: { type: 'string', description: '分类编码（如 ai, tech）' },
        since: { type: 'string', description: '起始时间 ISO 字符串' },
        limit: { type: 'number', description: '返回条数（默认 20）' },
      },
    },
    async execute(args: Record<string, unknown>, ctx: AgentToolContext) {
      const keywords = args.keywords as string[] | undefined;
      const category = args.category as string | undefined;
      const since = args.since as string | undefined;
      const limit = Math.min((args.limit as number) ?? 20, 50);

      const conditions = [];
      if (category) conditions.push(eq(articles.categoryCode, category));
      if (since) conditions.push(gte(articles.processedAt, new Date(since)));

      let rows = app.db
        .select({
          id: articles.id,
          summary: articles.summary,
          heat: articles.heat,
          tags: articles.tags,
          categoryCode: articles.categoryCode,
          critical: articles.critical,
          processedAt: articles.processedAt,
        })
        .from(articles)
        .$dynamic();

      if (conditions.length > 0) {
        rows = rows.where(and(...conditions)) as typeof rows;
      }

      const result = await rows.orderBy(desc(articles.heat)).limit(limit);

      // keywords 过滤（简单文本匹配）
      let filtered = result;
      if (keywords && keywords.length > 0) {
        filtered = result.filter((a) =>
          keywords.some(
            (kw) =>
              a.summary.toLowerCase().includes(kw.toLowerCase()) ||
              (a.tags ?? []).some((t) => t.toLowerCase().includes(kw.toLowerCase())),
          ),
        );
      }

      return {
        articles: filtered.map((a) => ({
          id: a.id,
          summary: a.summary,
          heat: a.heat,
          tags: a.tags,
          category: a.categoryCode,
          critical: a.critical,
          processedAt: a.processedAt?.toISOString(),
        })),
        total: filtered.length,
      };
    },
  };
}
