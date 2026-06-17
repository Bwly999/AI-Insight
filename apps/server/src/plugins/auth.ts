/**
 * auth 插件：preHandler 解 Bearer + jose 解 JWT + 查库定 role → request.user。
 * 见 doc/design-doc/04-后端架构.md §4.2、07-核心流程.md（鉴权链）、10-安全与可靠性.md。
 *
 * 平台无登录接口：token 由外部登录服务签发，后端仅解包 + 查角色。
 *
 * 鉴权链：
 *   1. 取 Authorization: Bearer <token>
 *   2. jose.jwtVerify(token, { secret, issuer?, audience? })
 *   3. 从 payload 映射出 { externalId, name }（映射路径留白，见下 TODO）
 *   4. 查 users 表：不存在则按「首次见到 externalId 自动建 USER」(见 06 §6.2)；
 *      存在则取 role，更新 lastSeenAt
 *   5. request.user = { id, externalId, name, role }
 *
 * 【留白 · 使用方填】(doc/design-doc/14-留白与后续确认.md)
 *   - JWT_SECRET 来源（默认从 env.JWT_SECRET）
 *   - JWT 声明路径：externalId 取 payload.id / sub / 自定义？name 取 payload.name / username？
 *   - 是否校验 issuer/audience
 *   - 外部 ID 与库的映射策略（默认：首次见到自动建 USER）
 *
 * 开发降级：当 JWT_SECRET 未配置且 NODE_ENV=development 时，允许「假数据」token
 *   （验收 A9/A10：可用手工构造的 token 验证骨架）。
 */
import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { jwtVerify, SignJWT, UnsecuredJWT } from 'jose';
import { eq } from 'drizzle-orm';
import type { AuthUser, UserRole } from '@ai-insight/shared-types';
import { config } from '../config.js';
import { users } from '../db/schema.js';

/** 从 JWT payload 映射出平台身份。留白点 #1：使用方可改字段路径。 */
function mapClaims(payload: Record<string, unknown>): { externalId: string; name: string } {
  // 留白 TODO：使用方按其外部登录服务的实际声明调整以下字段优先级。
  const externalId =
    (payload.id as string | undefined) ??
    (payload.sub as string | undefined) ??
    '';
  const name =
    (payload.name as string | undefined) ??
    (payload.username as string | undefined) ??
    (payload.preferred_username as string | undefined) ??
    externalId;
  return { externalId, name };
}

function unauthorized(reply: FastifyReply, message: string) {
  return reply.code(401).send({ error: 'unauthorized', message, statusCode: 401 });
}

/** 核心 preHandler：解包 + 查库定 role。 */
async function attachUser(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    void unauthorized(reply, 'missing bearer token');
    return;
  }
  const token = header.slice(7).trim();

  let externalId: string;
  let name: string;

  if (config.jwt.secret) {
    // 生产/标准路径：jose 校验签名 + 声明
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(config.jwt.secret),
        {
          ...(config.jwt.issuer ? { issuer: config.jwt.issuer } : {}),
          ...(config.jwt.audience ? { audience: config.jwt.audience } : {}),
        },
      );
      ({ externalId, name } = mapClaims(payload));
    } catch (err) {
      req.log.warn({ err: (err as Error).message }, 'jwt verify failed');
      void unauthorized(reply, 'invalid token');
      return;
    }
  } else if (config.nodeEnv === 'development') {
    // 开发降级：不校验签名，仅解包 payload（仅用于骨架验收 A9/A10，禁用于生产）。
    // 注：jose 的 decodeJwt 会拒绝 alg=none 的无签名 JWT，故这里宽容解码——
    // 直接取三段式 JWT 的第二段做 base64url 解码。
    let payload: Record<string, unknown> = {};
    try {
      const parts = token.split('.');
      const part = parts.length >= 2 ? parts[1]! : token;
      const json = Buffer.from(part, 'base64url').toString('utf8');
      payload = JSON.parse(json) as Record<string, unknown>;
    } catch {
      payload = {};
    }
    ({ externalId, name } = mapClaims(payload));
    if (!externalId) {
      // 支持「假数据」token：裸字符串或 {id:...}
      externalId = (token as string) || 'dev-user';
      name = name || externalId;
    }
    req.log.warn({ externalId }, '[auth] dev mode: signature NOT verified');
  } else {
    void unauthorized(reply, 'auth not configured (JWT_SECRET missing)');
    return;
  }

  if (!externalId) {
    void unauthorized(reply, 'token missing subject');
    return;
  }

  // 查库：不存在则首次见到自动建 USER（默认映射策略，见 06 §6.2）
  const db = req.server.db;
  const rows = await db.select().from(users).where(eq(users.externalId, externalId)).limit(1);
  let row = rows[0];
  if (!row) {
    const inserted = await db.insert(users).values({
      externalId,
      name,
      role: 'USER',
    });
    const id = Number(inserted[0].insertId);
    row = { id, externalId, name, role: 'USER' as UserRole, createdAt: null, lastSeenAt: null };
  } else {
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, row.id));
  }

  const user: AuthUser = {
    id: row.id,
    externalId: row.externalId,
    name: row.name,
    role: row.role,
  };
  req.user = user;
}

/** 管理员守卫：要求 role === 'ADMIN'，否则 403（验收 A10 / F2）。 */
async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!req.user) {
    void unauthorized(reply, 'not authenticated');
    return;
  }
  if (req.user.role !== 'ADMIN') {
    return reply.code(403).send({
      error: 'forbidden',
      message: 'admin role required',
      statusCode: 403,
    });
  }
}

export default fp(
  async (app) => {
    // 注册为具名 hook，供路由以 preHandler 引用
    app.decorate('auth', attachUser);
    app.decorate('requireAdmin', requireAdmin);

    // 开发工具：签发测试 token（仅 dev，便于验收 A9/A10 手工构造）
    if (config.nodeEnv === 'development' && config.jwt.secret) {
      app.decorate(
        'signDevToken',
        async (opts: { externalId: string; name: string; role?: UserRole }) =>
          new SignJWT({ id: opts.externalId, name: opts.name, role: opts.role ?? 'USER' })
            .setProtectedHeader({ alg: 'HS256' })
            .setSubject(opts.externalId)
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(new TextEncoder().encode(config.jwt.secret)),
      );
    } else if (config.nodeEnv === 'development') {
      // 开发降级：未配置 JWT_SECRET 时也提供 dev-token，产出由 auth 的
      // dev-fallback 路径（jose decodeJwt）接受的 token，便于骨架验收 A9/A10。
      app.decorate('signDevToken', async (opts: { externalId: string; name: string; role?: UserRole }) => {
        // 用 jose 的 UnsecuredJWT（alg=none）签发；dev-fallback 路径仅 decodeJwt，不验签，
        // 故此 token 可被接受，用于骨架验收 A9/A10（仅 dev）。
        return new UnsecuredJWT({ id: opts.externalId, name: opts.name, role: opts.role ?? 'USER' })
          .setSubject(opts.externalId)
          .setIssuedAt()
          .setExpirationTime('1h')
          .encode();
      });
    }

    app.log.info(
      {
        secretConfigured: Boolean(config.jwt.secret),
        devFallback: config.nodeEnv === 'development',
      },
      'auth plugin ready (jose jwtVerify preHandler)',
    );
  },
  { name: 'auth' },
);

// 类型：把 decorate 的 auth/requireAdmin 暴露到实例类型
declare module 'fastify' {
  interface FastifyInstance {
    auth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    signDevToken?(opts: { externalId: string; name: string; role?: UserRole }): Promise<string>;
  }
}
