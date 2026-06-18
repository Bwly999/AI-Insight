/**
 * 管理端 · Skill 版本管理。
 * 见 dev-spec 1C.6，API 清单 B.12。
 */
import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { CreateSkillRevisionBody } from '@ai-insight/shared-types';
import { skillRevisions, users } from '../../db/schema';

export default async function adminSkillRoutes(app: FastifyInstance): Promise<void> {
  const adminGuard = { preHandler: [app.auth, app.requireAdmin] };

  // GET /admin/skills — 版本列表
  app.get('/admin/skills', adminGuard, async (_req, reply) => {
    const rows = await app.db
      .select({
        id: skillRevisions.id,
        name: skillRevisions.name,
        version: skillRevisions.version,
        frontmatter: skillRevisions.frontmatter,
        bodyMd: skillRevisions.bodyMd,
        authorId: skillRevisions.authorId,
        authorName: users.name,
        enabled: skillRevisions.enabled,
        createdAt: skillRevisions.createdAt,
        auditNote: skillRevisions.auditNote,
      })
      .from(skillRevisions)
      .leftJoin(users, eq(skillRevisions.authorId, users.id))
      .orderBy(desc(skillRevisions.createdAt));

    return reply.send(rows);
  });

  // POST /admin/skills — 上传新版本
  app.post('/admin/skills', adminGuard, async (req, reply) => {
    const body = CreateSkillRevisionBody.parse(req.body);
    const userId = req.user!.id;

    const [row] = await app.db
      .insert(skillRevisions)
      .values({
        name: body.name,
        version: body.version,
        frontmatter: body.frontmatter,
        bodyMd: body.bodyMd,
        authorId: userId,
        enabled: false, // 默认不启用
        auditNote: body.auditNote,
      })
      .$returningId();

    const [inserted] = await app.db
      .select()
      .from(skillRevisions)
      .where(eq(skillRevisions.id, row.id))
      .limit(1);

    return reply.code(201).send(inserted);
  });

  // POST /admin/skills/:name/enable — 启用某版本（同 name 其他版本禁用）
  app.post('/admin/skills/:name/enable', adminGuard, async (req, reply) => {
    const { name } = req.params as { name: string };
    const body = req.body as { version?: string };
    if (!body.version) {
      return reply.code(400).send({ error: 'validation', message: 'version 必填', statusCode: 400 });
    }

    // 事务：同 name 其他版本 disabled → 指定版本 enabled
    await app.db
      .update(skillRevisions)
      .set({ enabled: false })
      .where(eq(skillRevisions.name, name));

    await app.db
      .update(skillRevisions)
      .set({ enabled: true })
      .where(and(eq(skillRevisions.name, name), eq(skillRevisions.version, body.version)));

    return reply.send({ ok: true, name, version: body.version });
  });

  // POST /admin/skills/:name/disable — 禁用
  app.post('/admin/skills/:name/disable', adminGuard, async (req, reply) => {
    const { name } = req.params as { name: string };
    await app.db
      .update(skillRevisions)
      .set({ enabled: false })
      .where(eq(skillRevisions.name, name));
    return reply.send({ ok: true, name });
  });
}
