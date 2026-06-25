/**
 * 管理端路由 — 运行监控 / 定时 / 设置（admin 角色门禁）。
 *
 * preHandler: [authenticate, requireAdmin] —— 普通用户 403。
 * PUT /admin/settings 热切换：proxy 即时生效、llm 下次 run 生效（getProvider 惰性）、rssCadence 重排。
 * apiKey 不经此 API 写（env-only）；GET 响应不含密钥。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as repo from "../repo.js";
import { configureProxy } from "@ai-insight/datasources";
import { setRssPollCron } from "../jobs/rss-poller.js";
import { resetSessionCache } from "@ai-insight/agent";
import { validateCron } from "../jobs/scheduler.js";

async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (req.user?.role !== "admin") {
    return reply.code(403).send({ error: "forbidden" });
  }
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // 全量运行监控
  app.get("/api/admin/runs", { preHandler: [app.authenticate, requireAdmin] }, async () => {
    return { items: repo.listAllRuns() };
  });

  // 全量定时任务
  app.get("/api/admin/schedules", { preHandler: [app.authenticate, requireAdmin] }, async () => {
    return { items: repo.listSchedules() };
  });

  // 设置读取（无密钥）
  app.get("/api/admin/settings", { preHandler: [app.authenticate, requireAdmin] }, async () => {
    return { settings: repo.getAllSettings() };
  });

  // 设置热切换
  app.put("/api/admin/settings", { preHandler: [app.authenticate, requireAdmin] }, async (req, reply) => {
    const body = (req.body ?? {}) as {
      proxy?: string;
      llm?: { providerName?: string; baseUrl?: string; model?: string };
      rssCadence?: string;
    };

    if (body.proxy !== undefined) {
      repo.setSetting("proxy", body.proxy);
      configureProxy(body.proxy || null); // 空串 = 清代理，即时生效
    }
    if (body.llm !== undefined) {
      // 不接受 apiKey；仅存 providerName/baseUrl/model
      const safe = {
        ...(body.llm.providerName != null && { providerName: body.llm.providerName }),
        ...(body.llm.baseUrl != null && { baseUrl: body.llm.baseUrl }),
        ...(body.llm.model != null && { model: body.llm.model }),
      };
      repo.setSetting("llm", JSON.stringify(safe));
      resetSessionCache(); // 每 run 独立 session，此处 no-op；下次 run 读新 provider
    }
    if (body.rssCadence !== undefined) {
      if (!validateCron(body.rssCadence)) {
        return reply.code(400).send({ error: "invalid_cron" });
      }
      repo.setSetting("rssCadence", body.rssCadence);
      setRssPollCron(body.rssCadence); // 停旧 task + 排新
    }

    return { ok: true, settings: repo.getAllSettings() };
  });
}
