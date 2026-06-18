/**
 * vaultRead / vaultWrite 工具 —— 跨 session 洞察沉淀库。
 * 见 dev-spec 1C.3，验收 H2。
 */
import { eq, or, like, and, desc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { AgentTool, AgentToolContext } from '../types';
import { vaultEntries } from '../../db/schema';

export function createVaultReadTool(app: FastifyInstance): AgentTool {
  return {
    name: 'vaultRead',
    description: '查询历史洞察沉淀库。按关键词/标签筛选。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词（标题/内容匹配）' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '标签筛选',
        },
        limit: { type: 'number', description: '返回条数（默认 10）' },
      },
    },
    async execute(args: Record<string, unknown>, _ctx: AgentToolContext) {
      const query = args.query as string | undefined;
      const tags = args.tags as string[] | undefined;
      const limit = Math.min((args.limit as number) ?? 10, 30);

      const conditions: any[] = [];
      if (query) {
        conditions.push(
          or(
            like(vaultEntries.title, `%${query}%`),
            like(vaultEntries.bodyMd, `%${query}%`),
          ),
        );
      }

      const rows = await app.db
        .select()
        .from(vaultEntries)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(vaultEntries.pinned), desc(vaultEntries.updatedAt))
        .limit(limit);

      const items = rows.map((r) => ({
        id: r.id,
        title: r.title,
        // body 只返回前 500 字
        bodyPreview: r.bodyMd.slice(0, 500),
        tags: r.tags,
        pinned: r.pinned,
        updatedAt: r.updatedAt?.toISOString(),
      }));

      return { items, total: items.length };
    },
  };
}

export function createVaultWriteTool(app: FastifyInstance): AgentTool {
  return {
    name: 'vaultWrite',
    description: '将洞察结果保存到沉淀库（跨 session 可查）。需 skill 声明 vault_write=true。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '沉淀条目标题' },
        body: { type: 'string', description: '沉淀内容（Markdown）' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '标签列表',
        },
      },
      required: ['title', 'body'],
    },
    async execute(args: Record<string, unknown>, ctx: AgentToolContext) {
      const title = args.title as string;
      const body = args.body as string;
      const tags = (args.tags as string[]) ?? [];

      if (!title || !body) throw new Error('title 和 body 必填');

      await app.db.insert(vaultEntries).values({
        title,
        bodyMd: body,
        tags,
        sourceSessionId: ctx.sessionId,
      });

      return { ok: true, title, tags };
    },
  };
}
