/**
 * 鉴权路由 — dev-login（dev 降级）。
 * POST /api/auth/dev-login → { token, user }
 */
import type { FastifyInstance } from "fastify";
import { signDevToken } from "../auth.js";
import { isDevAuthMode } from "../config.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/auth/dev-login", async (req, reply) => {
    const body = (req.body ?? {}) as { role?: "user" | "admin"; userId?: string };
    const role = body.role ?? "user";
    const userId = body.userId ?? "dev-user";
    if (!isDevAuthMode()) {
      return reply.code(400).send({
        error: "dev_login_disabled",
        message: "dev-login 仅在无 JWT_SECRET 时可用（prod 请用内网 SSO）",
      });
    }
    const token = signDevToken(userId, role);
    return { token, user: { id: userId, role, name: "WL" } };
  });

  // 当前用户（由 authenticate 装饰填充）
  app.get("/api/auth/me", { preHandler: app.authenticate }, async (req) => {
    return { user: req.user };
  });
}
