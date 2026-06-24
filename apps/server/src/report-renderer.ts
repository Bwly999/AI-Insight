/**
 * 报告渲染（MVP 极简版）— markdown → standalone HTML。
 *
 * Phase 4 会替换为 EditorialReport（@vue/server-renderer）的 editorial 版式。
 * 当前先用极简 markdown→HTML 包一个可读的独立页面，保证 save_report 闭环可用。
 */
import type { Report } from "@ai-insight/shared-types";

/** 极简 markdown → HTML（无外部依赖，覆盖标题/列表/链接/引用/代码）。 */
export function markdownToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 代码块
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

    // 行内格式 + 链接
    const inline = (t: string) =>
      esc(t)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // 标题
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      if (inList) { out.push("</ul>"); inList = false; }
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    // 引用
    if (line.startsWith("> ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }
    // 列表
    if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      continue;
    }
    // 空行
    if (line.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      continue;
    }
    // 普通段落
    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  if (inCode) out.push("</code></pre>");

  return out.join("\n");
}

/** 渲染 standalone HTML 报告（可独立打开/下载）。 */
export function renderReportHtml(opts: {
  title: string;
  markdown: string;
  standfirst?: string;
}): string {
  const body = markdownToHtml(opts.markdown);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(opts.title)} · AI-Insight 洞察报告</title>
<style>
  :root{--ink:#0b1220;--ink2:#5a6575;--line:#e5e8ed;--brand:#0d6e72;--paper:#fafbfc;}
  *{box-sizing:border-box;}
  body{margin:0;background:var(--paper);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
    line-height:1.7;-webkit-font-smoothing:antialiased;}
  .wrap{max-width:780px;margin:0 auto;padding:48px 28px 80px;}
  header{border-bottom:3px solid var(--ink);padding-bottom:20px;margin-bottom:32px;}
  .kicker{font-family:ui-monospace,monospace;text-transform:uppercase;letter-spacing:.16em;
    font-size:11px;color:var(--brand);font-weight:600;}
  h1{font-size:34px;line-height:1.15;margin:8px 0 0;letter-spacing:-.01em;}
  .standfirst{font-size:17px;color:var(--ink2);margin-top:12px;font-style:italic;}
  h2{font-size:23px;margin:36px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line);}
  h3{font-size:18px;margin:28px 0 10px;}
  p{margin:10px 0;}
  ul{padding-left:22px;margin:10px 0;}
  li{margin:5px 0;}
  a{color:var(--brand);}
  blockquote{margin:16px 0;padding:8px 16px;border-left:3px solid var(--brand);
    background:#f4f8f8;color:var(--ink2);border-radius:0 6px 6px 0;}
  code{background:#eef1f5;padding:1px 5px;border-radius:4px;font-family:ui-monospace,monospace;font-size:.92em;}
  pre{background:#0b1220;color:#e6eaf0;padding:16px;border-radius:10px;overflow-x:auto;}
  pre code{background:none;color:inherit;padding:0;}
  footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--line);
    font-size:12px;color:var(--ink2);font-family:ui-monospace,monospace;}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="kicker">AI-Insight · 洞察报告</div>
    <h1>${escapeHtml(opts.title)}</h1>
    ${opts.standfirst ? `<div class="standfirst">${escapeHtml(opts.standfirst)}</div>` : ""}
  </header>
  <main>
${body}
  </main>
  <footer>由 AI-Insight Agent 自主采集数据源并综合生成 · ${new Date().toISOString().slice(0, 10)}</footer>
</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 从报告 markdown 提取 standfirst（首个 > 引用行）。 */
export function extractStandfirst(markdown: string): string | undefined {
  const m = markdown.match(/^>\s*(.+)$/m);
  return m?.[1];
}
