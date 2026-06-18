/**
 * RssCollector —— RSS 采集器。
 * 见 dev-spec 1A.5，验收 B2。
 */
import Parser from 'rss-parser';
import { Dispatcher } from 'undici';
import type { ICollector, RawItemInput, SourceConfig, CollectorHealth } from '@ai-insight/shared-types';

interface RssConfig {
  feedUrl?: string;
  maxItems?: number;
  stripHtml?: boolean;
}

export class RssCollector implements ICollector {
  readonly type = 'RSS';
  private parser = new Parser();

  constructor(private http: Dispatcher) {}

  async fetch(source: SourceConfig): Promise<RawItemInput[]> {
    const cfg = source.config as unknown as RssConfig;
    const feedUrl = cfg.feedUrl;
    if (!feedUrl) throw new Error(`[RssCollector/${source.code}] feedUrl 未配置`);

    // 用 undici 拉文本（走代理），再喂给 rss-parser
    const resp = await this.http.request({
      method: 'GET',
      path: feedUrl,
      origin: new URL(feedUrl).origin,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Insight/0.1; RSS)',
      },
    });

    const statusCode = resp.statusCode ?? 0;
    if (statusCode >= 400) {
      throw new Error(`[RssCollector/${source.code}] HTTP ${statusCode}`);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of resp.body) {
      chunks.push(Buffer.from(chunk));
    }
    const xmlText = Buffer.concat(chunks).toString('utf-8');

    const feed = await this.parser.parseString(xmlText);
    const maxItems = cfg.maxItems ?? 50;
    const stripHtml = cfg.stripHtml ?? true;

    const items = (feed.items ?? []).slice(0, maxItems);
    return items.map((item) => {
      const title = item.title?.trim();
      const url = item.link?.trim();
      // 跳过无 title 的项
      if (!title) return null;

      let publishedAt: Date | undefined;
      if (item.isoDate) {
        const d = new Date(item.isoDate);
        if (!isNaN(d.getTime())) publishedAt = d;
      } else if (item.pubDate) {
        const d = new Date(item.pubDate);
        if (!isNaN(d.getTime())) publishedAt = d;
      }

      let rawText = item.contentSnippet ?? item.summary ?? item.content ?? '';
      if (stripHtml && rawText) {
        rawText = rawText.replace(/<[^>]*>/g, '').trim();
      }

      return {
        sourceCode: source.code,
        url: url ?? '',
        title,
        rawText: rawText || undefined,
        publishedAt,
      } as RawItemInput;
    }).filter(Boolean) as RawItemInput[];
  }

  async health(source: SourceConfig): Promise<CollectorHealth> {
    try {
      const cfg = source.config as unknown as RssConfig;
      if (!cfg.feedUrl) return { ok: false, detail: 'feedUrl 未配置' };
      const resp = await this.http.request({
        method: 'HEAD',
        path: cfg.feedUrl,
        origin: new URL(cfg.feedUrl).origin,
      });
      const ok = (resp.statusCode ?? 0) < 400;
      return { ok, detail: ok ? '可达' : `HTTP ${resp.statusCode}` };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }
}
