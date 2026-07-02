/**
 * 报告 markdown 头部裁剪 — 单一来源（server renderReportHtml + web ReportModal 共用）。
 *
 * 问题：报告的 title 与 standfirst 已在报头（report-masthead）单独渲染，
 * 但 agent 写入的 markdown 正文顶部往往也重复了 `# 标题` 与 `> 导语` 行，
 * 导致同一行在报头与正文各出现一次。本工具在 markdown → bodyHtml 之前剔除这些行。
 *
 * 纯函数、无依赖，server（SSR）与 web（客户端）运行时皆可安全加载。
 */

/**
 * 标题/导语归一化：去全部空白 + 去首尾常见标点（# 、 ｜ | · — - : 。 .），
 * 用于容错匹配模型写入的 H1 / 引用行与传入 title / standfirst 的细微差异。
 */
function norm(s: string): string {
  return s
    .replace(/\s+/g, "")
    .replace(/^[#、｜|·—\-:\s]+|[｜|·。.\s]+$/g, "");
}

/**
 * 从报告 markdown 顶部剔除已在报头（masthead）单独渲染的标题与导语行，避免重复。
 *
 * 规则（按行序处理 markdown 顶部，遇到首个正文行即停）：
 *  - 顶部连续的空行直接跳过；
 *  - 顶部 `# ` 开头且文本与 title 归一化后相同的 H1 行 → 删除；
 *  - 顶部 `> ` 开头且内容与 standfirst 归一化后相同的引用行 → 删除；
 *  - 其余内容（正文、列表、表格等）一律保留。
 *
 * @param markdown   报告 markdown 全文
 * @param title      报告标题（报头单独渲染的那一份）
 * @param standfirst 报告导语（报头单独渲染的那一份）
 */
export function stripReportHeader(
  markdown: string,
  title?: string,
  standfirst?: string,
): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const titleKey = title ? norm(title) : "";
  const standfirstKey = standfirst ? norm(standfirst) : "";

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === "") {
      i++;
      continue;
    }
    // 顶部 H1（# 或任意层级，通常是 #），文本与 title 相同时剔除
    const h = trimmed.match(/^#{1,4}\s+(.*)$/);
    if (h && titleKey && norm(h[1]) === titleKey) {
      i++;
      continue;
    }
    // 顶部导语引用行：内容与 standfirst 相同时剔除
    if (standfirstKey && trimmed.startsWith(">")) {
      const content = trimmed.replace(/^>\s*/, "");
      if (norm(content) === standfirstKey) {
        i++;
        continue;
      }
    }
    break;
  }

  // 丢弃被剔除行后的首个空行（避免正文前出现多余空行），其余原样保留
  if (i > 0 && lines[i]?.trim() === "") i++;
  return lines.slice(i).join("\n");
}
