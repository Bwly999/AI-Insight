/**
 * 用户端 · Mode 2 主动洞察路由（SSE 流）。
 * 见 dev-spec 1B.9，API 清单 B.4。
 */
import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { CreateInsightSessionBody, PaginationQuery } from '@ai-insight/shared-types';
import { insightSessions, agentSteps, agentToolCalls, subscriptions, reportSchedules } from '../db/schema';
import { runInsightSession } from '../insight/orchestrator';

export default async function insightRoutes(app: FastifyInstance): Promise<void> {
  const userGuard = { preHandler: [app.auth] };

  // POST /insight/sessions — 发起洞察会话（SSE 流）
  app.post('/insight/sessions', userGuard, async (req, reply) => {
    const body = CreateInsightSessionBody.parse(req.body);
    const userId = req.user!.id;

    // 设置 SSE 头
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders();

    let aborted = false;
    req.raw.on('close', () => {
      aborted = true;
    });

    const onStep = (event: any) => {
      if (aborted) return;
      const eventType = event.type;
      const data = JSON.stringify(event);
      reply.raw.write(`event: ${eventType}\ndata: ${data}\n\n`);
    };

    try {
      const { sessionId } = await runInsightSession(app, {
        userId,
        intent: body.intent,
        skillSet: body.skillSet,
        budget: body.budget,
        onStep,
      });

      // 发送 sessionId（用于客户端断线重连）
      onStep({ type: 'session', sessionId });
    } catch (err) {
      onStep({ type: 'error', content: (err as Error).message });
    }

    // 不关闭 reply — SSE 保持连接
  });

  // GET /insight/sessions/:id/stream — 断线重连
  app.get('/insight/sessions/:id/stream', userGuard, async (req, reply) => {
    const { id } = req.params as { id: string };
    const sessionId = Number(id);

    // 检查 session 归属
    const [session] = await app.db
      .select()
      .from(insightSessions)
      .where(eq(insightSessions.id, sessionId))
      .limit(1);
    if (!session || session.userId !== req.user!.id) {
      return reply.code(404).send({ error: 'not_found', message: '会话不存在', statusCode: 404 });
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.flushHeaders();

    // 重放已有的 steps
    const steps = await app.db
      .select()
      .from(agentSteps)
      .where(eq(agentSteps.sessionId, sessionId))
      .orderBy(agentSteps.stepNo);

    for (const step of steps) {
      reply.raw.write(
        `event: step\ndata: ${JSON.stringify({
          type: 'step',
          stepNo: step.stepNo,
          role: step.role,
          content: step.content,
          tokens: step.tokens,
        })}\n\n`,
      );
    }

    // 若已完成，发 final 事件
    if (session.status !== 'RUNNING') {
      reply.raw.write(
        `event: final\ndata: ${JSON.stringify({
          type: 'final',
          sessionId,
          status: session.status,
          reportMarkdown: session.reportMarkdown,
          usedTokens: session.usedTokens,
          usedSteps: session.usedSteps,
        })}\n\n`,
      );
    }

    req.raw.on('close', () => {
      reply.raw.end();
    });
  });

  // GET /insight/sessions/:id — 取最终报告
  app.get('/insight/sessions/:id', userGuard, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [session] = await app.db
      .select()
      .from(insightSessions)
      .where(eq(insightSessions.id, Number(id)))
      .limit(1);
    if (!session || session.userId !== req.user!.id) {
      return reply.code(404).send({ error: 'not_found', message: '会话不存在', statusCode: 404 });
    }
    return reply.send({
      id: session.id,
      userId: session.userId,
      intent: session.intent,
      skillSet: session.skillSet,
      status: session.status,
      budget: session.budget,
      usedTokens: session.usedTokens,
      usedSteps: session.usedSteps,
      usedToolCalls: session.usedToolCalls,
      reportMarkdown: session.reportMarkdown,
      sourceArticleIds: session.sourceArticleIds ?? [],
      startedAt: session.startedAt?.toISOString() ?? '',
      finishedAt: session.finishedAt?.toISOString() ?? null,
      error: session.error,
    });
  });

  // GET /insight/sessions — 我的会话历史
  app.get('/insight/sessions', userGuard, async (req, reply) => {
    const query = PaginationQuery.parse(req.query);
    const { page, pageSize } = query;
    const status = (req.query as Record<string, string>)['status'];
    const userId = req.user!.id;

    const where = status
      ? eq(insightSessions.status, status as any)
      : undefined;

    const rows = await app.db
      .select()
      .from(insightSessions)
      .where(where)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .orderBy(desc(insightSessions.startedAt));

    const items = rows
      .filter((r) => r.userId === userId)
      .map((r) => ({
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

  // POST /insight/sessions/:id/to-subscription — 一键转 Mode 1 订阅
  app.post('/insight/sessions/:id/to-subscription', userGuard, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { scheduleId?: number };
    const userId = req.user!.id;
    const sessionId = Number(id);

    const [session] = await app.db
      .select()
      .from(insightSessions)
      .where(eq(insightSessions.id, sessionId))
      .limit(1);
    if (!session || session.userId !== userId) {
      return reply.code(404).send({ error: 'not_found', message: '会话不存在', statusCode: 404 });
    }

    // 尝试从 session 的 watch-shape 输出解析 categoryCodes 和 keywords
    let categoryCodes: string[] = [];
    let keywords: string[] = [];
    if (session.reportMarkdown) {
      try {
        const parsed = JSON.parse(session.reportMarkdown);
        categoryCodes = parsed.categoryCodes ?? [];
        keywords = parsed.keywords ?? [];
      } catch {
        // 不是 JSON 格式，忽略
      }
    }

    const scheduleId = body.scheduleId ?? 1; // 默认第一个 schedule

    const [sub] = await app.db
      .insert(subscriptions)
      .values({
        userId,
        scheduleId,
        categoryCodes,
        keywords,
        channels: ['CONSOLE'],
        active: true,
      })
      .$returningId();

    return reply.send({ id: sub.id, scheduleId, categoryCodes, keywords });
  });
}
