/**
 * 鉴权路由：GET /auth/me（验收 A9）。
 * 见 doc/design-doc/04-后端架构.md §4.3。
 *
 * 平台无登录接口：token 由外部登录服务签发。
 * preHandler = fastify.auth（解包 + 查库定 role）。
 */
import type { FastifyInstance } from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  // GET /auth/me —— 当前用户 + 角色
  app.get(
    '/auth/me',
    { preHandler: [app.auth] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const u = req.user;
      if (!u) {
        return reply.code(401).send({ error: 'unauthorized', message: 'no user', statusCode: 401 });
      }
      return reply.send({
        id: u.id,
        externalId: u.externalId,
        name: u.name,
        role: u.role,
      });
    },
  );

  // 开发工具：签发测试 token（仅 dev 且配置了 secret），便于验收 A9/A10 手工构造
  if (app.signDevToken) {
    app.post(
      '/auth/dev-token',
      async (req: FastifyRequest, reply: FastifyReply) => {
        const body = (req.body ?? {}) as { externalId?: string; name?: string; role?: 'USER' | 'ADMIN' };
        const externalId = body.externalId ?? 'dev-user';
        const name = body.name ?? externalId;
        const token = await app.signDevToken!({ externalId, name, role: body.role });
        return reply.send({ token });
      },
    );
  }
}
