/**
 * 报告路由 — 列表 / 详情 / standalone HTML。
 */
import type { FastifyInstance } from "fastify";
import * as repo from "../repo.js";
import { renderReportHtml } from "../report-renderer.js";
import { loadAgentMessages, deriveCitationsFromMessages } from "@ai-insight/agent";

/** 按 report.runId → conversation.sessionFile 派生 citations（运行时注入，不落 DB）。 */
function deriveCitationsForReport(report: { conversationId: string }): import("@ai-insight/shared-types").Citation[] {
  const conv = repo.getConversation(report.conversationId);
  if (!conv?.sessionFile) return [];
  return deriveCitationsFromMessages(loadAgentMessages(conv.sessionFile));
}

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/reports", { preHandler: app.authenticate }, async (req) => {
    const conversationId = (req.query as { conversationId?: string }).conversationId;
    return { items: repo.listReports(conversationId) };
  });

  app.get("/api/reports/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const report = repo.getReport((req.params as { id: string }).id);
    if (!report) return reply.code(404).send({ error: "not_found" });
    // 运行时从 Pi 会话文件派生引用列表注入（不存 DB，与 LLM 视角一致）
    report.citations = deriveCitationsForReport(report);
    return report;
  });

  // standalone HTML（可直接在浏览器打开 / 下载分享）
  // 按需渲染：不读 reports.html 烘焙列，而是从持久化的 markdown/title/standfirst/createdAt
  // 用当前 renderReportHtml 实时生成。系统内渲染逻辑变更对历史/新报告均即时生效，
  // 保证下载 HTML 与系统内预览实时一致。
  app.get("/api/reports/:id/html", { preHandler: app.authenticate }, async (req, reply) => {
    const report = repo.getReport((req.params as { id: string }).id);
    if (!report) return reply.code(404).send({ error: "not_found" });
    reply.header("Content-Type", "text/html; charset=utf-8");
    return renderReportHtml({
      title: report.title,
      markdown: report.markdown,
      standfirst: report.standfirst,
      citations: deriveCitationsForReport(report),
      meta: { createdAt: report.createdAt },
    });
  });
}
