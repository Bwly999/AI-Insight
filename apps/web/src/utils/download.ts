/**
 * 报告下载工具 — 经鉴权 fetch 取 on-demand 渲染的 standalone HTML 再落盘。
 *
 * 统一供 ReportCard（卡片下载）与 ReportModal（弹窗下载）共用，保证两个下载入口
 * 产出与系统内实时一致的 HTML。fetch 带 Authorization 头（dev/prod 皆可，
 * 规避 <a download> 浏览器导航不带 Bearer 头导致 prod 401 的问题）。
 */
import { fetchReportHtml } from "@ai-insight/api-client";

/**
 * 下载报告 HTML：fetch → Blob → 触发 <a download> 点击。
 * @param id       报告 id
 * @param filename 落盘文件名（含 .html）
 */
export async function downloadReportHtml(id: string, filename: string): Promise<void> {
  const html = await fetchReportHtml(id);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
