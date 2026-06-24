/**
 * 正文提取（extract_content）— fallback 链：Jina → Firecrawl → 本地降级。
 *
 * 借 union-search 的三引擎 fallback 模式（缺 key 的引擎自动跳过）。
 * 返回 { title?, content }。content 为 markdown。
 */
import { fetchText } from "./http.js";
import FirecrawlApp from "firecrawl";

export interface ExtractResult {
  url: string;
  title?: string;
  content: string; // markdown
  engine: "jina" | "firecrawl" | "local";
}

interface JinaJsonResponse {
  code?: number;
  data?: {
    title?: string;
    content?: string;
    description?: string;
    url?: string;
  };
}

/** Jina Reader（无 key 也能用，key 仅提升限流）。 */
async function extractWithJina(
  url: string,
  key?: string,
): Promise<ExtractResult> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Return-Format": "markdown",
  };
  const k = key ?? process.env.JINA_API_KEY;
  if (k) headers.Authorization = `Bearer ${k}`;

  const raw = await fetchText(`https://r.jina.ai/${url}`, {
    headers,
    timeoutMs: 25000,
  });
  let json: JinaJsonResponse;
  try {
    json = JSON.parse(raw) as JinaJsonResponse;
  } catch {
    // 非 JSON（可能是纯文本 markdown）
    return { url, content: raw.slice(0, 20000), engine: "jina" };
  }
  if (!json.data?.content) {
    throw new Error("Jina: empty content");
  }
  return {
    url,
    title: json.data.title,
    content: json.data.content.slice(0, 20000),
    engine: "jina",
  };
}

/** Firecrawl scrapeUrl（markdown）。 */
async function extractWithFirecrawl(
  url: string,
  apiKey?: string,
): Promise<ExtractResult> {
  const key = apiKey ?? process.env.FIRECRAWL_API_KEY ?? "";
  if (!key) throw new Error("Firecrawl: no API key");
  const client = new FirecrawlApp({ apiKey: key });
  const res = await client.scrapeUrl(url, { formats: ["markdown"] });
  if (!("success" in res) || !res.success) {
    throw new Error("Firecrawl scrape failed");
  }
  const md = (res as { markdown?: string }).markdown;
  if (!md) throw new Error("Firecrawl: empty markdown");
  return {
    url,
    title: (res as { metadata?: { title?: string } }).metadata?.title,
    content: md.slice(0, 20000),
    engine: "firecrawl",
  };
}

/**
 * 本地降级：fetch HTML → 极简正文提取（去 script/style，取文本）。
 * 精度不如前两者，但零依赖、无限流。
 */
async function extractLocal(url: string): Promise<ExtractResult> {
  const html = await fetchText(url, { timeoutMs: 15000 });
  // 去 script/style/head/nav
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return {
    url,
    title: titleMatch?.[1]?.trim(),
    content: cleaned.slice(0, 20000) || "(无法提取正文)",
    engine: "local",
  };
}

/**
 * 提取正文：Jina → Firecrawl → 本地降级。任一成功即返回。
 * 每个引擎缺 key 或抛错则降级到下一个。
 */
export async function extractContent(url: string): Promise<ExtractResult> {
  const errors: string[] = [];

  // 1. Jina（无 key 也可用）
  try {
    return await extractWithJina(url);
  } catch (e) {
    errors.push(`jina: ${(e as Error).message}`);
  }

  // 2. Firecrawl
  try {
    return await extractWithFirecrawl(url);
  } catch (e) {
    errors.push(`firecrawl: ${(e as Error).message}`);
  }

  // 3. 本地降级
  try {
    return await extractLocal(url);
  } catch (e) {
    errors.push(`local: ${(e as Error).message}`);
  }

  throw new Error(`extract_content 全部失败: ${errors.join(" | ")}`);
}
