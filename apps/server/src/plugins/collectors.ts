/**
 * collectors 插件（SPI）：采集器注册表。
 * 见 doc/design-doc/04-后端架构.md §4.5、05-可插拔SPI设计.md §5.1。
 *
 * Phase 1A：注册 4 个真实采集器（RSS / SEARCH_API / SEARCH_CRAWL / WEB_SCRAPER）。
 */
import fp from 'fastify-plugin';
import type { ICollector } from '@ai-insight/shared-types';
import { RssCollector } from '../collectors/rss';
import { SearchApiCollector } from '../collectors/search-api';
import { SearchCrawlCollector } from '../collectors/search-crawl';
import { WebScraperCollector } from '../collectors/web-scraper';

export default fp(
  async (app) => {
    const collectors = new Map<string, ICollector>();

    const registerCollector = (type: string, impl: ICollector) => {
      collectors.set(type, impl);
      app.log.debug({ type }, 'collector registered');
    };

    app.decorate('collectors', collectors);
    app.decorate('registerCollector', registerCollector);

    // 注册 4 个真实采集器
    registerCollector('RSS', new RssCollector(app.http));
    registerCollector('SEARCH_API', new SearchApiCollector(app.http, app.crypto));
    registerCollector('SEARCH_CRAWL', new SearchCrawlCollector(app.http));
    registerCollector('WEB_SCRAPER', new WebScraperCollector());

    app.log.info(
      { types: [...collectors.keys()] },
      'collectors plugin ready (RSS / SEARCH_API / SEARCH_CRAWL / WEB_SCRAPER)',
    );
  },
  { name: 'collectors' },
);
