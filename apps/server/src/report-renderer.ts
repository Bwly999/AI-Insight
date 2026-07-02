/**
 * 报告渲染 — markdown → editorial standalone HTML（升级为 EditorialReport 模板）。
 *
 * 流程：markdown → bodyHtml（极简转换）→ renderReportStandalone（@vue/server-renderer）。
 * Phase 4：从 Phase 3 的极简版升级为 editorial 版式。
 */
import type { Report } from "@ai-insight/shared-types";
import { renderReportStandalone } from "@ai-insight/shared-ui";

/** 极简 markdown → HTML（覆盖标题/列表/链接/引用/代码）。 */
export function markdownToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        out.push("<pre><code>");
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(esc(line));
      continue;
    }

    const inline = (t: string) =>
      esc(t)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      if (inList) { out.push("</ul>"); inList = false; }
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    // 水平分隔线 --- / *** / ___（≥3 个同一字符，允许空格）
    if (/^(\s*[-*_]\s*){3,}$/.test(line) && /([-*_])\1\1/.test(line.replace(/\s/g, ""))) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("<hr />");
      continue;
    }
    if (line.startsWith("> ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (line.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  if (inCode) out.push("</code></pre>");

  return out.join("\n");
}

/**
 * 渲染 standalone HTML 报告（editorial 版式，可独立打开/下载）。
 */
export async function renderReportHtml(opts: {
  title: string;
  markdown: string;
  standfirst?: string;
  meta?: { issueNo?: string; createdAt?: string; signalCount?: number; sourceCount?: number };
}): Promise<string> {
  const bodyHtml = markdownToHtml(opts.markdown);
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
