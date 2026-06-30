/**
 * 管理端路由 — 运行监控 / 定时 / 设置（admin 角色门禁）。
 *
 * preHandler: [authenticate, requireAdmin] —— 普通用户 403。
 * PUT /admin/settings 热切换：proxy 即时生效、llm 下次 run 生效（getProvider 惰性）、rssCadence 重排。
 * apiKey 不经此 API 写（env-only）；GET 响应不含密钥。
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as repo from "../repo.js";
import { configureProxy, rawFetch } from "@ai-insight/datasources";
import { setRssPollCron } from "../jobs/rss-poller.js";
import { resetSessionCache } from "@ai-insight/agent";
import { validateCron } from "../jobs/scheduler.js";
import { getProxySource } from "../runtime-config.js";
import { ProxyAgent } from "undici";
import { randomId } from "../util.js";
import type { DataSourceTag } from "@ai-insight/shared-types";

/** 校验代理 URL：必须是合法 http(s) URL。 */
function isValidProxyUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

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

  // 设置读取（无密钥）；附当前生效代理来源
  app.get("/api/admin/settings", { preHandler: [app.authenticate, requireAdmin] }, async () => {
    return { settings: repo.getAllSettings(), proxySource: getProxySource() };
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

    return { ok: true, settings: repo.getAllSettings(), proxySource: getProxySource() };
  });

  // 代理连通性测试（不写库；用传入或当前生效 proxy 临时建 dispatcher 探测）
  app.post("/api/admin/proxy/test", { preHandler: [app.authenticate, requireAdmin] }, async (req, reply) => {
    const body = (req.body ?? {}) as { proxy?: string };
    // 优先用传入值；空则取当前生效代理（settings/env）
    const testedProxy = (body.proxy ?? "").trim() || getProxySource().value;
    if (testedProxy && !isValidProxyUrl(testedProxy)) {
      return reply.code(400).send({ error: "invalid_proxy_url" });
    }
    const started = Date.now();
    try {
      const dispatcher = testedProxy ? new ProxyAgent(testedProxy) : undefined;
      const res = await rawFetch("https://www.google.com/generate_204", {
        timeoutMs: 8000,
        ...(dispatcher ? { dispatcher } : {}),
      });
      return { ok: true, status: res.status, latencyMs: Date.now() - started, testedProxy: testedProxy || "(direct)" };
    } catch (e) {
      return { ok: false, status: 0, latencyMs: Date.now() - started, testedProxy: testedProxy || "(direct)", error: (e as Error).message };
    }
  });

  // ─── admin 数据源管理（admin 门禁封装；数据源为全局实体，转发 repo）────────
  app.get("/api/admin/datasources", { preHandler: [app.authenticate, requireAdmin] }, async (req) => {
    const type = (req.query as { type?: "search" | "rss" | "crawler" }).type;
    return { items: repo.listDataSources(type) };
  });

  app.patch("/api/admin/datasources/:id", { preHandler: [app.authenticate, requireAdmin] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = (req.body ?? {}) as { enabled?: boolean; tags?: DataSourceTag[]; name?: string };
    const ds = repo.patchDataSource(id, body);
    if (!ds) return reply.code(404).send({ error: "not_found" });
    return ds;
  });

  app.post("/api/admin/datasources", { preHandler: [app.authenticate, requireAdmin] }, async (req, reply) => {
    const body = (req.body ?? {}) as { name: string; feedUrl: string; tags?: DataSourceTag[] };
    if (!body.feedUrl) return reply.code(400).send({ error: "feed_url_required" });
    const id = randomId("rss");
    const ds = repo.upsertDataSource(id, {
      type: "rss",
      name: body.name || body.feedUrl,
      tags: body.tags ?? ["general"],
      enabled: true,
      config: { feedUrl: body.feedUrl },
    });
    return reply.code(201).send(ds);
  });

  app.delete("/api/admin/datasources/:id", { preHandler: [app.authenticate, requireAdmin] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const ds = repo.getDataSource(id);
    if (!ds) return reply.code(404).send({ error: "not_found" });
    if (ds.type !== "rss") return reply.code(400).send({ error: "only_rss_deletable" });
    repo.deleteDataSource(id);
    return reply.code(204).send();
  });
}
