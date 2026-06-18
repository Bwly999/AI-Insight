/**
 * 管理端 · Article 池 + 纠错。
 * 见 dev-spec 2.3，验收 C5/C6。
 */
import type { FastifyInstance } from 'fastify';
import { eq, desc, gte } from 'drizzle-orm';
import { PaginationQuery } from '@ai-insight/shared-types';
import { articles } from '../../db/schema';

export default async function adminArticleRoutes(app: FastifyInstance): Promise<void> {
  const adminGuard = { preHandler: [app.auth, app.requireAdmin] };

  // GET /admin/articles — 列表
  app.get('/admin/articles', adminGuard, async (req, reply) => {
    const query = PaginationQuery.parse(req.query);
    const { page, pageSize } = query;
    const q = req.query as Record<string, string>;
    const category = q['category'];
    const since = q['since'];

    const rows = await app.db
      .select()
      .from(articles)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .orderBy(desc(articles.heat));

    return reply.send({
      items: rows.map((r) => ({
        id: r.id,
        rawItemId: r.rawItemId,
        categoryCode: r.categoryCode,
        summary: r.summary,
        heat: r.heat,
        tags: r.tags,
        critical: r.critical,
        trendComment: r.trendComment,
        processedAt: r.processedAt?.toISOString(),
      })),
      total: rows.length,
      page,
      pageSize,
    });
  });

  // PUT /admin/articles/:id — 纠错
  app.put('/admin/articles/:id', adminGuard, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      summary?: string;
      heat?: number;
      critical?: boolean;
      tags?: string[];
      trendComment?: string;
    };

    const vals: Record<string, unknown> = {};
    if (body.summary !== undefined) vals.summary = body.summary;
    if (body.heat !== undefined) vals.heat = Math.max(0, Math.min(100, body.heat));
    if (body.critical !== undefined) vals.critical = body.critical;
    if (body.tags !== undefined) vals.tags = body.tags;
    if (body.trendComment !== undefined) vals.trendComment = body.trendComment;

    await app.db.update(articles).set(vals).where(eq(articles.id, Number(id)));
    return reply.send({ ok: true });
  });
}
