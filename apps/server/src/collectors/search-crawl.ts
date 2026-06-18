/**
 * SearchCrawlCollector —— HTML 爬虫型采集器。
 * 用 cheerio 解析 HTML，支持 CSS 选择器提取列表。
 * 见 dev-spec 1A.7，验收 B4。
 */
import * as cheerio from 'cheerio';
import { Dispatcher } from 'undici';
import type { ICollector, RawItemInput, SourceConfig, CollectorHealth } from '@ai-insight/shared-types';

interface SearchCrawlConfig {
  listUrl?: string;
  searchUrlTemplate?: string;
  itemSelector: string;
  fieldSelectors: {
    title: string;
    url: string;
    date?: string;
  };
  maxResults?: number;
}

export class SearchCrawlCollector implements ICollector {
  readonly type = 'SEARCH_CRAWL';

  constructor(private http: Dispatcher) {}

  async fetch(source: SourceConfig): Promise<RawItemInput[]> {
    const cfg = source.config as unknown as SearchCrawlConfig;
    const targetUrl = cfg.listUrl;
    if (!targetUrl) throw new Error(`[SearchCrawlCollector/${source.code}] listUrl 未配置`);

    const resp = await this.http.request({
      method: 'GET',
      path: new URL(targetUrl).pathname + new URL(targetUrl).search,
      origin: new URL(targetUrl).origin,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Insight/0.1; Crawl)',
      },
    });

    const statusCode = resp.statusCode ?? 0;
    if (statusCode >= 400) {
      throw new Error(`[SearchCrawlCollector/${source.code}] HTTP ${statusCode}`);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of resp.body) {
      chunks.push(Buffer.from(chunk));
    }
    const html = Buffer.concat(chunks).toString('utf-8');
    const $ = cheerio.load(html);

    const origin = new URL(targetUrl).origin;
    const maxResults = cfg.maxResults ?? 50;
    const results: RawItemInput[] = [];

    $(cfg.itemSelector).slice(0, maxResults).each((_i, el) => {
      const $item = $(el);
      const title = $item.find(cfg.fieldSelectors.title).text().trim();
      const urlRaw = $item.find(cfg.fieldSelectors.url).attr('href') ?? '';

      if (!title || !urlRaw) return; // 跳过缺失项

      // 相对 URL 转绝对
      const url = urlRaw.startsWith('http') ? urlRaw : `${origin}${urlRaw.startsWith('/') ? '' : '/'}${urlRaw}`;

      let publishedAt: Date | undefined;
      if (cfg.fieldSelectors.date) {
        const dateStr = $item.find(cfg.fieldSelectors.date).text().trim();
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) publishedAt = d;
        }
      }

      results.push({
        sourceCode: source.code,
        url,
        title,
        publishedAt,
      } as RawItemInput);
    });

    return results;
  }

  async health(source: SourceConfig): Promise<CollectorHealth> {
    try {
      const cfg = source.config as unknown as SearchCrawlConfig;
      if (!cfg.listUrl && !cfg.searchUrlTemplate) return { ok: false, detail: 'URL 未配置' };
      return { ok: true, detail: '已配置' };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }
}
