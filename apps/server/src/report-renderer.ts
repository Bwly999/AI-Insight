/**
 * 报告渲染 — markdown → editorial standalone HTML（升级为 EditorialReport 模板）。
 *
 * 流程：markdown → bodyHtml（mdToHtml，与 web 共用单一来源）→ renderReportStandalone（@vue/server-renderer）。
 * Phase 4：从 Phase 3 的极简版升级为 editorial 版式。
 *
 * 注：下载入口 GET /api/reports/:id/html 在请求时按本函数实时渲染（不读 reports.html 烘焙列），
 * 故系统内渲染逻辑变更对历史/新报告均即时生效。
 */
import { renderReportStandalone, stripReportHeader, mdToHtml } from "@ai-insight/shared-ui";

/**
 * 渲染 standalone HTML 报告（editorial 版式，可独立打开/下载）。
 *
 * title / standfirst 在 masthead 报头单独渲染（editorial-ssr.ts 用 mdInline 解析内联标记），
 * 故需从正文 markdown 中剔除否则会出现"标题/导语在报头与正文各出现一次"的重复。
 */
export async function renderReportHtml(opts: {
  title: string;
  markdown: string;
  standfirst?: string;
  meta?: { issueNo?: string; createdAt?: string; signalCount?: number; sourceCount?: number };
}): Promise<string> {
  const bodyHtml = mdToHtml(stripReportHeader(opts.markdown, opts.title, opts.standfirst));
  return renderReportStandalone({
    title: opts.title,
    standfirst: opts.standfirst,
    bodyHtml,
    meta: opts.meta,
  });
}

/** 从报告 markdown 提取 standfirst（首个 > 引用行）。 */
export function extractStandfirst(markdown: string): string | undefined {
  const m = markdown.match(/^>\s*(.+)$/m);
  return m?.[1];
}
