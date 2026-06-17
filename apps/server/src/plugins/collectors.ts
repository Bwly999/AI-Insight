/**
 * collectors 插件（SPI）：采集器注册表 + 默认实现。
 * 见 doc/design-doc/04-后端架构.md §4.5、05-可插拔SPI设计.md §5.1。
 *
 * 注册：fastify.registerCollector(type, impl)
 * 查表：const c = fastify.collectors.get(source.type)
 *
 * Phase 0：仅注册注册表机制 + 占位实现（接口就绪）。
 * Phase 1：补 RssCollector / SearchApiCollector / SearchCrawlCollector 的真实抓取，
 *          以及 PlaywrightScraperCollector(预留)。
 */
import fp from 'fastify-plugin';
import type { ICollector, RawItemInput, SourceConfig } from '@ai-insight/shared-types';

/** 占位采集器：接口就绪，真实抓取 Phase 1 落地。 */
class StubCollector implements ICollector {
  constructor(
    readonly type: string,
    private readonly note: string,
  ) {}
  async fetch(_source: SourceConfig): Promise<RawItemInput[]> {
    throw new Error(`[collector:${this.type}] ${this.note}`);
  }
  async health(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: false, detail: `${this.type} collector: stub (Phase 1)` };
  }
}

export default fp(
  async (app) => {
    const collectors = new Map<string, ICollector>();

    const registerCollector = (type: string, impl: ICollector) => {
      collectors.set(type, impl);
      app.log.debug({ type }, 'collector registered');
    };

    app.decorate('collectors', collectors);
    app.decorate('registerCollector', registerCollector);

    // 注册默认实现（Phase 0 占位；Phase 1 替换为真实实现）
    registerCollector('RSS', new StubCollector('RSS', 'RSS 采集 Phase 1 实现（rss-parser）'));
    registerCollector(
      'SEARCH_API',
      new StubCollector('SEARCH_API', '搜索 API 型采集 Phase 1 实现'),
    );
    registerCollector(
      'SEARCH_CRAWL',
      new StubCollector('SEARCH_CRAWL', '搜索爬虫型采集 Phase 1 实现'),
    );
    registerCollector(
      'WEB_SCRAPER',
      new StubCollector('WEB_SCRAPER', 'Playwright 深度抓取预留（见 05-可插拔SPI §5.1）'),
    );

    app.log.info(
      { types: [...collectors.keys()] },
      'collectors plugin ready (SPI registry + 4 stubs)',
    );
  },
  { name: 'collectors' },
);
