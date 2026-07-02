/**
 * Citation 派生 — 从 Pi 会话历史（AgentMessage[]）反解析工具结果，生成全局编号的引用列表。
 *
 * 真相源：Pi .jsonl 会话文件里的 ToolResultMessage.content（formatItems 渲染的文本，含 url/summary）。
 * 不落 DB：每次渲染报告时从会话文件派生注入，保证与 LLM 视角一致。
 *
 * 编号规则：per-conversation 跨 run 累加。search/crawl/fetch_rss 的每条 item 按对话顺序递增 citeNo；
 * extract_content 不分配新编号，而是按 url 匹配提升既有 citation 的 hasContent=true。
 */
import type { AgentMessage, ToolResultMessage, Citation } from "@ai-insight/shared-types";

/** 从 ToolResultMessage.content 取纯文本（formatItems 输出）。 */
function toolText(msg: ToolResultMessage): string {
  const c = msg.content?.[0];
  return c && typeof c === "object" && "text" in c ? c.text : "";
}

/**
 * 反解析 formatItems 文本，提取每条 item 的 title/url/summary。
 *
 * formatItems 格式（tools.ts）：
 *   N. 「src」title [热度x] (date) — summary
 *      url
 *
 * url 行为 3 空格缩进，稳定可提取。title/summary 从内容行按固定后缀（[热度]、(date)、 — summary）剥离。
 */
export function parseFormatItems(
  text: string,
): { title: string; url: string; summary?: string }[] {
  const lines = text.split("\n");
  const items: { title: string; url: string; summary?: string }[] = [];
  let i = 0;
  // 跳过开头 summary 行，直到首个 "N. " 序号行
  while (i < lines.length && !/^\d+\.\s/.test(lines[i].trim())) i++;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^(\d+)\.\s+(.*)$/);
    if (!m) continue;
    let rest = m[2];
    // 下一非空行是 url（缩进）
    let url = "";
    while (i + 1 < lines.length && lines[i + 1].trim() === "") i++;
    if (i + 1 < lines.length) {
      const next = lines[i + 1].replace(/^\s+/, "");
      if (/^https?:\/\//.test(next)) {
        url = next;
        i++;
      }
    }
    if (!url) continue;
    // 去掉 「src」 前缀
    rest = rest.replace(/^「[^」]*」/, "");
    // 提取 summary（ — 之后；注意 formatItems 用 " — " 分隔）
    let summary: string | undefined;
    const dash = rest.indexOf(" — ");
    if (dash >= 0) {
      summary = rest.slice(dash + 3).trim() || undefined;
      rest = rest.slice(0, dash);
    }
    // 去掉 [热度x] 和 (date) 后缀
    rest = rest
      .replace(/\s*\[热度\d+\]/g, "")
      .replace(/\s*\(\d{4}-\d{2}-\d{2}\)/g, "")
      .trim();
    items.push({ title: rest, url, summary });
  }
  return items;
}

/** 从 extract_content 的 content 文本提取 url（格式：`来源: url (引擎: ...)`）。 */
function extractUrlFromContent(text: string): string | undefined {
  const m = text.match(/来源:\s*(\S+)/);
  return m?.[1];
}

const ITEM_TOOLS = new Set(["search", "crawl", "fetch_rss"]);

/**
 * 从 AgentMessage[] 派生全局编号的 Citation 列表。
 *
 * 遍历 toolResult 消息：item 类工具（search/crawl/fetch_rss）的每条 item 按
 * 对话顺序递增 citeNo；extract_content 按 url 匹配提升既有 citation 的 hasContent。
 */
export function deriveCitationsFromMessages(messages: AgentMessage[]): Citation[] {
  const citations: Citation[] = [];
  let citeNo = 0;
  for (const msg of messages) {
    if (msg.role !== "toolResult") continue;
    const text = toolText(msg);
    if (!text) continue;
    if (ITEM_TOOLS.has(msg.toolName)) {
      const items = parseFormatItems(text);
      for (const it of items) {
        citeNo++;
        citations.push({
          citeNo,
          url: it.url,
          title: it.title,
          summary: it.summary,
          hasContent: false,
        });
      }
    } else if (msg.toolName === "extract_content") {
      const url = extractUrlFromContent(text);
      if (url) {
        // 按 url 匹配提升既有 citation（规范化比较：去末尾斜杠/fragment）
        const norm = normalizeUrlKey(url);
        const cite = citations.find((c) => normalizeUrlKey(c.url) === norm);
        if (cite) cite.hasContent = true;
      }
    }
  }
  return citations;
}

/** 规范化 url 用于匹配：去 fragment、去末尾斜杠、小写 host。 */
function normalizeUrlKey(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname.replace(/\/$/, "")}${u.search}`;
  } catch {
    return raw;
  }
}
