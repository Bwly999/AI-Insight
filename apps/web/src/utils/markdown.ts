/**
 * 轻量 markdown → HTML（无依赖）。
 *
 * 抽自 ReportView.vue 并增强：
 *  - 有序列表（`1.`）
 *  - 无序列表自动包裹 <ul>
 *  - 基础表格（GFM pipe table）
 *  - 引用标记：`[1]` `[2]` → <sup class="cite" data-cite="1">①</sup>（点击高亮右栏来源）
 *  - 保留与服务端一致的 inline 转义
 *
 * 仅用于消息内 / 报告客户端预览；复杂场景（嵌套/图片）仍以服务端渲染为准。
 */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 1→① 2→② …（>20 回退为 [n]） */
function circledNum(n: number): string {
  const map = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];
  return n >= 1 && n <= 20 ? map[n - 1] : `[${n}]`;
}

function inline(t: string): string {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // 链接 [text](url) 必须先于 [n] 引用，避免误伤
    .replace(/\[(.+?)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // 引用标记 [n] → ①（仅匹配纯数字方括号，且前面不是 ] 以排除链接残余）
    .replace(/\[(\d+)\]/g, (_, n) => {
      const num = parseInt(n, 10);
      return `<sup class="cite" data-cite="${num}">${circledNum(num)}</sup>`;
    });
}

/**
 * 仅渲染 inline markdown（**bold** / *italic* / `code` / 链接 / 引用），不产生块级元素。
 * 用于标题、卡片等只允许内联标记的场景：先 esc() 转义，再应用 inline 规则，安全用于 v-html。
 */
export function mdInline(t: string): string {
  return inline(t);
}

/** 解析 GFM 管道表格块（lines 已是该表格的连续行）。 */
function tableToHtml(lines: string[]): string {
  const rows = lines.map((l) =>
    l
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .split("|")
      .map((c) => c.trim()),
  );
  if (rows.length < 2) return lines.map((l) => `<p>${inline(l)}</p>`).join("");
  const header = rows[0];
  const body = rows.slice(1).filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));
  const thead = `<thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${body
    .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

export function mdToHtml(md: string): string {
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
      out.push(tableToHtml(tbl));
      continue;
    }

    // 标题
    const h = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
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
      out.push(`<blockquote>${inline(trimmed.slice(2))}</blockquote>`);
      i++;
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < rawLines.length && /^\s*\d+\.\s+/.test(rawLines[i])) {
        items.push(`<li>${inline(rawLines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // 无序列表
    if (/^\s*[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < rawLines.length && /^\s*[-*]\s+/.test(rawLines[i])) {
        items.push(`<li>${inline(rawLines[i].replace(/^\s*[-*]\s+/, ""))}</li>`);
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
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return out.join("\n");
}
