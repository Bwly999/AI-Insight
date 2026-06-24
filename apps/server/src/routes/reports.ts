/**
 * 报告路由 — 列表 / 详情 / standalone HTML。
 */
import type { FastifyInstance } from "fastify";
import * as repo from "../repo.js";

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/reports", { preHandler: app.authenticate }, async (req) => {
    const conversationId = (req.query as { conversationId?: string }).conversationId;
    return { items: repo.listReports(conversationId) };
  });

  app.get("/api/reports/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const report = repo.getReport((req.params as { id: string }).id);
    if (!report) return reply.code(404).send({ error: "not_found" });
    return report;
  });

  // standalone HTML（可直接在浏览器打开 / 下载分享）
  app.get("/api/reports/:id/html", { preHandler: app.authenticate }, async (req, reply) => {
    const report = repo.getReport((req.params as { id: string }).id);
    if (!report) return reply.code(404).send({ error: "not_found" });
    reply.header("Content-Type", "text/html; charset=utf-8");
    return report.html;
  });
}
