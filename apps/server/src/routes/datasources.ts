/**
 * 数据源路由 — 列表 / 启停 / 标签 / RSS 增删。
 *
 * search/crawler 仅启停；rss 可增删（设计 §3.3）。
 */
import type { FastifyInstance } from "fastify";
import type { DataSourceTag } from "@ai-insight/shared-types";
import * as repo from "../repo.js";
import { randomId } from "../util.js";
import { pollOneFeed } from "../jobs/rss-poller.js";

export async function dataSourceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/datasources", { preHandler: app.authenticate }, async (req) => {
    const type = (req.query as { type?: "search" | "rss" | "crawler" }).type;
    return { items: repo.listDataSources(type) };
  });

  app.patch("/api/datasources/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = (req.body ?? {}) as { enabled?: boolean; tags?: DataSourceTag[]; name?: string };
    const ds = repo.patchDataSource(id, body);
    if (!ds) return reply.code(404).send({ error: "not_found" });
    // 启用 RSS feed 时即时首拉（消除 30min 盲区）
    if (body.enabled === true && ds.type === "rss") void pollOneFeed(id);
    return ds;
  });

  // RSS 增（仅 rss 类型）
  app.post("/api/datasources", { preHandler: app.authenticate }, async (req, reply) => {
    const body = (req.body ?? {}) as {
      name: string;
      feedUrl: string;
      tags?: DataSourceTag[];
    };
    if (!body.feedUrl) return reply.code(400).send({ error: "feed_url_required" });
    const id = randomId("rss");
    const ds = repo.upsertDataSource(id, {
      type: "rss",
      name: body.name || body.feedUrl,
      tags: body.tags ?? ["general"],
      enabled: true,
      config: { feedUrl: body.feedUrl },
    });
    // 新建 RSS feed 即时首拉建索引
    void pollOneFeed(ds.id);
    return reply.code(201).send(ds);
  });

  // RSS 删
  app.delete("/api/datasources/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const ds = repo.getDataSource(id);
    if (!ds) return reply.code(404).send({ error: "not_found" });
    if (ds.type !== "rss") return reply.code(400).send({ error: "only_rss_deletable" });
    repo.deleteDataSource(id);
    return reply.code(204).send();
  });
}
