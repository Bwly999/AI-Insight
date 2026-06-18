/**
 * WebScraperCollector —— Playwright 深度抓取预留。
 * Phase 1A 仅占位，正文抓取 Phase 2 实现。
 * 见 dev-spec 1A.8，验收 B10。
 */
import type { ICollector, RawItemInput, SourceConfig, CollectorHealth } from '@ai-insight/shared-types';

export class WebScraperCollector implements ICollector {
  readonly type = 'WEB_SCRAPER';

  async fetch(source: SourceConfig): Promise<RawItemInput[]> {
    // Phase 1A 占位：返回一条占位记录
    const url = (source.config?.url as string) ?? '';
    return [
      {
        sourceCode: source.code,
        url,
        title: '[web-scraper placeholder]',
        rawText: '',
      } as RawItemInput,
    ];
  }

  async health(_source: SourceConfig): Promise<CollectorHealth> {
    return { ok: true, detail: 'placeholder, real impl in Phase 2' };
  }
}
