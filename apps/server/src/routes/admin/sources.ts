/**
 * 管理端 · 数据源 CRUD + 试采。
 * 见 dev-spec 1A.14，API 清单 B.5。
 */
import type { FastifyInstance } from 'fastify';
import { eq, like, and, desc, sql } from 'drizzle-orm';
import { CreateSourceBody, UpdateSourceBody, PaginationQuery } from '@ai-insight/shared-types';
import { sources, collectLogs } from '../../db/schema';

export default async function adminSourceRoutes(app: FastifyInstance): Promise<void> {
  const adminGuard = { preHandler: [app.auth, app.requireAdmin] };

  // GET /admin/sources — 列表（含最近采集状态）
  app.get('/admin/sources', adminGuard, async (req, reply) => {
    const query = PaginationQuery.parse(req.query);
    const { page, pageSize } = query;
    const type = (req.query as Record<string, string>)['type'];
    const enabled = (req.query as Record<string, string>)['enabled'];

    const conditions = [];
    if (type) conditions.push(eq(sources.type, type));
    if (enabled !== undefined) conditions.push(eq(sources.enabled, enabled === 'true'));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await app.db
      .select({
        id: sources.id,
        code: sources.code,
        name: sources.name,
        type: sources.type,
        config: sources.config,
        enabled: sources.enabled,
        createdAt: sources.createdAt,
      })
      .from(sources)
      .where(where)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .orderBy(sources.id);

    // 联查最近采集状态
    const items = await Promise.all(
      rows.map(async (row) => {
        const [lastLog] = await app.db
          .select({
            status: collectLogs.status,
            startedAt: collectLogs.startedAt,
          })
          .from(collectLogs)
          .where(eq(collectLogs.sourceId, row.id))
          .orderBy(desc(collectLogs.startedAt))
          .limit(1);
        return {
          ...row,
          config: maskApiKeys(row.config as Record<string, unknown>, app.crypto),
          lastCollectStatus: lastLog?.status ?? null,
          lastCollectAt: lastLog?.startedAt?.toISOString() ?? null,
        };
      }),
    );

    const [totalResult] = await app.db
      .select({ count: sql<number>`count(*)` })
      .from(sources)
      .where(where ?? undefined);

    return reply.send({ items, total: Number(totalResult.count), page, pageSize });
  });

  // POST /admin/sources — 新建源
  app.post('/admin/sources', adminGuard, async (req, reply) => {
    const body = CreateSourceBody.parse(req.body);
    const safeConfig = encryptApiKeys(body.config, app.crypto);
    const [row] = await app.db
      .insert(sources)
      .values({
        code: body.code,
        name: body.name,
        type: body.type,
        config: safeConfig,
        enabled: body.enabled,
      })
      .$returningId();
    const [inserted] = await app.db.select().from(sources).where(eq(sources.id, row.id)).limit(1);
    return reply.code(201).send({
      ...inserted,
      config: maskApiKeys(inserted.config as Record<string, unknown>, app.crypto),
    });
  });

  // GET /admin/sources/:id — 详情
  app.get('/admin/sources/:id', adminGuard, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await app.db.select().from(sources).where(eq(sources.id, Number(id))).limit(1);
    if (!row) return reply.code(404).send({ error: 'not_found', message: '源不存在', statusCode: 404 });
    return reply.send({
      ...row,
      config: maskApiKeys(row.config as Record<string, unknown>, app.crypto),
    });
  });

  // PUT /admin/sources/:id — 更新
  app.put('/admin/sources/:id', adminGuard, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateSourceBody.parse(req.body);
    const safeConfig = body.config ? encryptApiKeys(body.config, app.crypto) : undefined;
    const vals: Record<string, unknown> = {};
    if (body.code !== undefined) vals.code = body.code;
    if (body.name !== undefined) vals.name = body.name;
    if (body.type !== undefined) vals.type = body.type;
    if (safeConfig !== undefined) vals.config = safeConfig;
    if (body.enabled !== undefined) vals.enabled = body.enabled;

    await app.db.update(sources).set(vals).where(eq(sources.id, Number(id)));
    const [updated] = await app.db.select().from(sources).where(eq(sources.id, Number(id))).limit(1);
    if (!updated) return reply.code(404).send({ error: 'not_found', message: '源不存在', statusCode: 404 });
    return reply.send({
      ...updated,
      config: maskApiKeys(updated.config as Record<string, unknown>, app.crypto),
    });
  });

  // DELETE /admin/sources/:id — 删除
  app.delete('/admin/sources/:id', adminGuard, async (req, reply) => {
    const { id } = req.params as { id: string };
    await app.db.delete(sources).where(eq(sources.id, Number(id)));
    return reply.send({ ok: true });
  });

  // POST /admin/sources/:id/test — 试采（不落库）
  app.post('/admin/sources/:id/test', adminGuard, async (req, reply) => {
    const { id } = req.params as { id: string };
    const [src] = await app.db.select().from(sources).where(eq(sources.id, Number(id))).limit(1);
    if (!src) return reply.code(404).send({ error: 'not_found', message: '源不存在', statusCode: 404 });

    const collector = app.collectors.get(src.type);
    if (!collector) throw new Error(`未注册的采集器类型: ${src.type}`);

    const items = await collector.fetch({
      code: src.code,
      type: src.type,
      config: src.config as Record<string, unknown>,
    });
    return reply.send({ items: items.slice(0, 10), count: items.length });
  });
}

/** 加密 config 中的 apiKey 字段 */
function encryptApiKeys(config: Record<string, unknown>, crypto: { encrypt: (s: string) => string }): Record<string, unknown> {
  const result = { ...config };
  for (const key of Object.keys(result)) {
    if (key.toLowerCase().includes('apikey') || key.toLowerCase().includes('api_key')) {
      const val = result[key];
      if (typeof val === 'string' && val.length > 0) {
        result[key] = crypto.encrypt(val);
      }
    }
  }
  return result;
}

/** 脱敏 config 中的加密 apiKey */
function maskApiKeys(config: Record<string, unknown>, crypto: { decrypt: (s: string) => string; mask: (s: string) => string }): Record<string, unknown> {
  const result = { ...config };
  for (const key of Object.keys(result)) {
    if (key.toLowerCase().includes('apikey') || key.toLowerCase().includes('api_key')) {
      const val = result[key];
      if (typeof val === 'string' && val.length > 0) {
        try {
          const decrypted = crypto.decrypt(val);
          result[key] = crypto.mask(decrypted);
        } catch {
          result[key] = '****';
        }
      }
    }
  }
  return result;
}
