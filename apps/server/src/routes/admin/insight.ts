/**
 * 管理端 · Insight 会话列表 + trace 回放。
 * 见 dev-spec 1B.10，API 清单 B.12。
 */
import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { PaginationQuery } from '@ai-insight/shared-types';
import { insightSessions, agentSteps, agentToolCalls } from '../../db/schema';

export default async function adminInsightRoutes(app: FastifyInstance): Promise<void> {
  const adminGuard = { preHandler: [app.auth, app.requireAdmin] };

  // GET /admin/insight/sessions — 会话列表
  app.get('/admin/insight/sessions', adminGuard, async (req, reply) => {
    const query = PaginationQuery.parse(req.query);
    const { page, pageSize } = query;
    const q = req.query as Record<string, string>;
    const userId = q['userId'] ? Number(q['userId']) : undefined;
    const status = q['status'];

    let where = undefined;
    if (userId) where = eq(insightSessions.userId, userId);

    const rows = await app.db
      .select()
      .from(insightSessions)
      .where(where)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .orderBy(desc(insightSessions.startedAt));

    const items = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      intent: r.intent,
      skillSet: r.skillSet,
      status: r.status,
      budget: r.budget,
      usedTokens: r.usedTokens,
      usedSteps: r.usedSteps,
      usedToolCalls: r.usedToolCalls,
      reportMarkdown: r.reportMarkdown,
      startedAt: r.startedAt?.toISOString() ?? '',
      finishedAt: r.finishedAt?.toISOString() ?? null,
    }));

    return reply.send({ items, total: items.length, page, pageSize });
  });

  // GET /admin/insight/sessions/:id/trace — 完整 trace
  app.get('/admin/insight/sessions/:id/trace', adminGuard, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sessionId = Number(id);

    const [session] = await app.db
      .select()
      .from(insightSessions)
      .where(eq(insightSessions.id, sessionId))
      .limit(1);
    if (!session) {
      return reply.code(404).send({ error: 'not_found', message: '会话不存在', statusCode: 404 });
    }

    const steps = await app.db
      .select()
      .from(agentSteps)
      .where(eq(agentSteps.sessionId, sessionId))
      .orderBy(agentSteps.stepNo);

    const toolCalls = await app.db
      .select()
      .from(agentToolCalls)
      .where(eq(agentToolCalls.sessionId, sessionId))
      .orderBy(agentToolCalls.createdAt);

    return reply.send({
      session: {
        id: session.id,
        userId: session.userId,
        intent: session.intent,
        status: session.status,
        usedTokens: session.usedTokens,
        usedSteps: session.usedSteps,
        usedToolCalls: session.usedToolCalls,
        reportMarkdown: session.reportMarkdown,
        startedAt: session.startedAt?.toISOString() ?? '',
        finishedAt: session.finishedAt?.toISOString() ?? null,
        error: session.error,
      },
      steps: steps.map((s) => ({
        id: s.id,
        stepNo: s.stepNo,
        role: s.role,
        content: s.content,
        tokens: s.tokens,
        createdAt: s.createdAt?.toISOString() ?? '',
      })),
      toolCalls: toolCalls.map((t) => ({
        id: t.id,
        tool: t.tool,
        args: t.args,
        result: t.result,
        ok: t.ok,
        error: t.error,
        durationMs: t.durationMs,
        createdAt: t.createdAt?.toISOString() ?? '',
      })),
    });
  });
}
