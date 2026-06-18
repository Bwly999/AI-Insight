/**
 * extract 工具 —— 抓取 URL 正文（用 @mozilla/readability）。
 * 见 dev-spec 1C.2，验收 H1。
 */
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { Dispatcher } from 'undici';
import type { AgentTool, AgentToolContext } from '../types';

export function createExtractTool(http: Dispatcher): AgentTool {
  return {
    name: 'extract',
    description: '抓取指定 URL 的正文内容（纯文本），用于深度分析。',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '要抓取的文章 URL' },
        maxBytes: { type: 'number', description: '最大字节数（默认 1MB）' },
      },
      required: ['url'],
    },
    async execute(args: Record<string, unknown>, _ctx: AgentToolContext) {
      const url = args.url as string;
      if (!url) throw new Error('url 必填');

      const maxBytes = (args.maxBytes as number) ?? 1_048_576;

      const resp = await http.request({
        method: 'GET',
        path: new URL(url).pathname + new URL(url).search,
        origin: new URL(url).origin,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AI-Insight/0.1; Extractor)',
        },
      });

      const statusCode = resp.statusCode ?? 0;
      if (statusCode >= 400) {
        throw new Error(`[extract] HTTP ${statusCode}`);
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      for await (const chunk of resp.body) {
        const buf = Buffer.from(chunk);
        totalBytes += buf.length;
        if (totalBytes > maxBytes) {
          chunks.push(buf.subarray(0, buf.length - (totalBytes - maxBytes)));
          break;
        }
        chunks.push(buf);
      }

      const html = Buffer.concat(chunks).toString('utf-8');
      const truncated = totalBytes > maxBytes;

      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article) {
        return { url, content: null, title: null, wordCount: 0, truncated, error: '无法解析正文' };
      }

      return {
        url,
        title: article.title,
        content: article.textContent?.slice(0, 10000) ?? '',
        wordCount: article.textContent?.split(/\s+/).length ?? 0,
        truncated,
      };
    },
  };
}
