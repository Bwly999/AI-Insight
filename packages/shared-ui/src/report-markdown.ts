/**
 * 报告 markdown 处理 — 单一来源（server SSR 渲染 + web 客户端预览共用）。
 *
 * 本模块为"下载 HTML"与"系统内预览"的唯一 markdown 渲染路径，保证两者实时一致：
 *  - mdToHtml：块级 markdown → HTML（标题 / 分隔线 / 引用 / 有序+无序列表 / GFM 管道表格 /
 *    段落合并 / [n] 引用→①）。server 的 standalone HTML 与 web 的 ReportModal/MessageBlocks 共用。
 *  - mdInline：仅内联标记（**bold** / *italic* / `code` / 链接 / [n] 引用），用于报头标题/导语等
 *    只允许内联的场景；先 esc() 再应用规则，可安全用于 v-html / innerHTML。
 *  - stripReportHeader：正文转 HTML 前剔除已在报头单独渲染的标题/导语行，避免重复。
 *
 * 纯函数、无依赖，server（SSR/tsx）与 web（Vite）运行时皆可安全加载。
 */
import type { Citation } from "@ai-insight/shared-types";

// ─── 内联层（esc + inline 规则）─────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 转义 href 属性值（防引号/& 注入）。 */
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** 1→① 2→② …（>20 回退为 [n]） */
function circledNum(n: number): string {
  const map = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];
  return n >= 1 && n <= 20 ? map[n - 1] : `[${n}]`;
}

/** 构建 citeNo → Citation 查找表。 */
function buildCiteMap(citations?: Citation[]): Map<number, Citation> | undefined {
  if (!citations?.length) return undefined;
  const m = new Map<number, Citation>();
  for (const c of citations) m.set(c.citeNo, c);
  return m;
}

/**
 * 渲染引用标记 [n] 或 [n,m,...]：
 *  - 有 citations 上下文时：hasContent→数字①（<a> 点击跳转原文）；summary-only→🔗（data-cites 聚合，点击弹窗）
 *  - 无 citations 上下文（兼容旧调用/无来源场景）：回退为纯 ① 数字
 *  - 编号不存在（LLM 编错号）：渲染灰色 [n]，不造假链接
 */
function renderCiteToken(nums: string, citeMap?: Map<number, Citation>): string {
  const ns = nums.split(",").map((s) => parseInt(s.trim(), 10));
  if (!citeMap) {
    return ns.map((n) => `<sup class="cite" data-cite="${n}">${circledNum(n)}</sup>`).join("");
  }
  const numParts: string[] = [];
  const linkParts: number[] = [];
  for (const n of ns) {
    const c = citeMap.get(n);
    if (!c) {
      numParts.push(`<sup class="cite-missing">[${n}]</sup>`);
    } else if (c.hasContent) {
      numParts.push(
        `<a class="cite-num" href="${escapeAttr(c.url)}" target="_blank" rel="noopener noreferrer"><sup>${circledNum(n)}</sup></a>`,
      );
    } else {
      linkParts.push(n);
    }
  }
  let out = numParts.join("");
  if (linkParts.length) {
    out += `<sup class="cite-link" data-cites="${linkParts.join(",")}">🔗</sup>`;
  }
  return out;
}

function inline(t: string, citeMap?: Map<number, Citation>): string {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // 链接 [text](url) 必须先于 [n] 引用，避免误伤
    .replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // 引用标记 [n] 或 [n,m,...] → 数字①/🔗（仅匹配纯数字+逗号方括号）
    .replace(/\[(\d+(?:,\s*\d+)*)\]/g, (_, nums: string) => renderCiteToken(nums, citeMap));
}

/**
 * 仅渲染 inline markdown（**bold** / *italic* / `code` / 链接 / 引用），不产生块级元素。
 * 用于标题、导语、卡片等只允许内联标记的场景：先 esc() 转义，再应用 inline 规则，安全用于 v-html / innerHTML。
 */
export function mdInline(t: string, citations?: Citation[]): string {
  return inline(t, buildCiteMap(citations));
}

// ─── 块级层（mdToHtml）──────────────────────────────────────────────────────

/** 解析 GFM 管道表格块（lines 已是该表格的连续行）。 */
function tableToHtml(lines: string[], citeMap?: Map<number, Citation>): string {
  const rows = lines.map((l) =>
    l
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .split("|")
      .map((c) => c.trim()),
  );
  if (rows.length < 2) return lines.map((l) => `<p>${inline(l, citeMap)}</p>`).join("");
  const header = rows[0];
  const body = rows.slice(1).filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));
  const thead = `<thead><tr>${header.map((c) => `<th>${inline(c, citeMap)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${body
    .map((r) => `<tr>${r.map((c) => `<td>${inline(c, citeMap)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

/**
 * 轻量 markdown → HTML（无依赖）。
 *
 * 覆盖：标题 / 水平分隔线 / 引用块 / 有序+无序列表 / GFM 管道表格 / 段落合并 / [n] 引用→①。
 * server standalone HTML 与 web 客户端预览共用本函数，确保下载 HTML 与系统内一致。
 */
export function mdToHtml(md: string, citations?: Citation[]): string {
  const citeMap = buildCiteMap(citations);
  const rawLines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 空行
    if (trimmed === "") {
      i++;
      continue;
    }

    // 表格块：含 | 且下一行是分隔行
    if (trimmed.includes("|") && rawLines[i + 1] && /^\s*\|?[\s:|-]+\|?\s*$/.test(rawLines[i + 1]) && rawLines[i + 1].includes("-")) {
      const tbl: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().includes("|")) {
        tbl.push(rawLines[i]);
        i++;
      }
      out.push(tableToHtml(tbl, citeMap));
      continue;
    }

    // 标题
    const h = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2], citeMap)}</h${h[1].length}>`);
      i++;
      continue;
    }

    // 水平分隔线 --- / *** / ___（≥3 个，可空格，行内仅此内容）
    if (/^(\s*[-*_]\s*){3,}$/.test(line) && /([-*_])\1\1/.test(line.replace(/\s/g, ""))) {
      out.push("<hr />");
      i++;
      continue;
    }

    // 引用块
    if (trimmed.startsWith("> ")) {
      out.push(`<blockquote>${inline(trimmed.slice(2), citeMap)}</blockquote>`);
      i++;
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < rawLines.length && /^\s*\d+\.\s+/.test(rawLines[i])) {
        items.push(`<li>${inline(rawLines[i].replace(/^\s*\d+\.\s+/, ""), citeMap)}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // 无序列表
    if (/^\s*[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < rawLines.length && /^\s*[-*]\s+/.test(rawLines[i])) {
        items.push(`<li>${inline(rawLines[i].replace(/^\s*[-*]\s+/, ""), citeMap)}</li>`);
        i++;
      }
      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // 普通段落（合并连续普通行）
    const para: string[] = [];
    while (
      i < rawLines.length &&
      rawLines[i].trim() !== "" &&
      !/^(#{1,4})\s+/.test(rawLines[i].trim()) &&
      !rawLines[i].trim().startsWith("> ") &&
      !/^\s*[-*]\s+/.test(rawLines[i].trim()) &&
      !/^\s*\d+\.\s+/.test(rawLines[i].trim()) &&
      !/^(\s*[-*_]\s*){3,}$/.test(rawLines[i]) &&
      !(rawLines[i].trim().includes("|") && rawLines[i + 1] && /^\s*\|?[\s:|-]+\|?\s*$/.test(rawLines[i + 1]) && rawLines[i + 1].includes("-"))
    ) {
      para.push(rawLines[i]);
      i++;
    }
    out.push(`<p>${inline(para.join(" "), citeMap)}</p>`);
  }

  return out.join("\n");
}

// ─── 报头裁剪（stripReportHeader）───────────────────────────────────────────

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
