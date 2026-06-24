/**
 * Fastify 应用工厂 — 注册 CORS / auth 装饰 / 路由。
 *
 * auth 装饰：request.user 可用（经 TokenVerifier 校验）。
 * 路由按域分文件（routes/*.ts），在此注册。
 */
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { createTokenVerifier, type AuthPrincipal, type TokenVerifier } from "./auth.js";

declare module "fastify" {
  interface FastifyInstance {
    tokenVerifier: TokenVerifier;
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: AuthPrincipal | null;
  }
}

export interface BuildAppOptions {
  tokenVerifier?: TokenVerifier;
  corsOrigin?: string | string[];
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    // dev 下降低日志级别减少噪音（可通过 LOG_LEVEL 覆盖）
    logger: { level: process.env.LOG_LEVEL ?? "warn" },
  });

  // CORS（dev 允许 web 5173 跨域）
  await app.register(cors, {
    origin: opts.corsOrigin ?? ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  // auth 装饰
  const tokenVerifier = opts.tokenVerifier ?? createTokenVerifier();
  app.decorate("tokenVerifier", tokenVerifier);
  app.decorateRequest("user", null);
  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      // dev 模式放行（无 token 也算 dev-user）；prod 返回 401
      if (process.env.JWT_SECRET) {
        return reply.code(401).send({ error: "missing token" });
      }
      req.user = { userId: "dev-user", role: "user" };
      return;
    }
    const token = auth.slice(7);
    const principal = await tokenVerifier.verify(token);
    if (!principal) {
      return reply.code(401).send({ error: "invalid token" });
    }
    req.user = principal;
  });

  // 统一错误格式
  app.setErrorHandler((err: unknown, _req, reply) => {
    const e = err as { statusCode?: number; name?: string; message?: string };
    const status = e.statusCode ?? 500;
    app.log.error({ err }, "request error");
    reply.code(status).send({
      error: status >= 500 ? "internal_error" : (e.name ?? "error").toLowerCase(),
      message: e.message ?? "unknown error",
    });
  });

  // 健康检查
  app.get("/api/health", async () => ({ ok: true, ts: Date.now() }));

  return app;
}
