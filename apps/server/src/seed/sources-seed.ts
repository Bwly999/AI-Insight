/**
 * 源种子数据 —— 12 条默认数据源。
 * 见 design-doc/16 §3.4 表格，dev-spec 1A.13。
 *
 * 导入方式：scripts/seed-sources.mjs（INSERT … ON DUPLICATE KEY UPDATE，幂等）。
 */
import type { CreateSourceBody } from '@ai-insight/shared-types';

const sourcesSeed: CreateSourceBody[] = [
  // ── RSS ──
  {
    code: 'rss-solidot',
    name: 'Solidot',
    type: 'RSS',
    enabled: true,
    config: {
      feedUrl: 'https://solidot.org/index.rss',
      maxItems: 50,
      stripHtml: true,
      interval: 1800,
      category: 'tech',
    },
  },
  {
    code: 'rss-aihot',
    name: 'AI Hot',
    type: 'RSS',
    enabled: true,
    config: {
      feedUrl: 'https://aihot.com/feed/all.xml',
      maxItems: 50,
      stripHtml: true,
      interval: 1800,
      category: 'ai',
    },
  },
  {
    code: 'rss-arxiv-csai',
    name: 'arXiv CS.AI',
    type: 'RSS',
    enabled: true,
    config: {
      feedUrl: 'https://rss.arxiv.org/rss/cs.AI',
      maxItems: 30,
      stripHtml: true,
      interval: 3600,
      category: 'ai',
    },
  },

  // ── SEARCH_CRAWL ──
  {
    code: 'crawl-ithome',
    name: 'IT之家热榜',
    type: 'SEARCH_CRAWL',
    enabled: true,
    config: {
      listUrl: 'https://www.ithome.com/',
      itemSelector: '.latest li, .hot li',
      fieldSelectors: {
        title: 'a',
        url: 'a',
        date: 'span.date',
      },
      maxResults: 50,
      interval: 1800,
      category: 'tech',
    },
  },
  {
    code: 'crawl-hackernews',
    name: 'Hacker News',
    type: 'SEARCH_CRAWL',
    enabled: true,
    config: {
      listUrl: 'https://news.ycombinator.com/',
      itemSelector: 'tr.athing',
      fieldSelectors: {
        title: 'td.title .titleline a',
        url: 'td.title .titleline a',
      },
      maxResults: 30,
      interval: 1800,
      category: 'tech',
    },
  },
  {
    code: 'crawl-github-trending',
    name: 'GitHub Trending',
    type: 'SEARCH_CRAWL',
    enabled: true,
    config: {
      listUrl: 'https://github.com/trending',
      itemSelector: 'article.Box-row',
      fieldSelectors: {
        title: 'h2 a',
        url: 'h2 a',
      },
      maxResults: 25,
      interval: 3600,
      category: 'tech',
    },
  },

  // ── SEARCH_API (mode=list) ──
  {
    code: 'api-wallstreetcn-live',
    name: '华尔街见闻快讯',
    type: 'SEARCH_API',
    enabled: true,
    config: {
      mode: 'list',
      endpoint: 'https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&limit=50',
      resultPath: 'data.items[*]',
      fieldMap: {
        title: 'title',
        url: 'uri',
        publishedAt: 'display_time',
        summary: 'content_short',
      },
      maxResults: 50,
      interval: 600,
      category: 'finance',
    },
  },
  {
    code: 'api-bilibili-hot',
    name: 'Bilibili 热门',
    type: 'SEARCH_API',
    enabled: true,
    config: {
      mode: 'list',
      endpoint: 'https://api.bilibili.com/x/web-interface/popular',
      resultPath: 'data.list[*]',
      fieldMap: {
        title: 'title',
        url: 'short_link_v2',
        publishedAt: 'pubdate',
        summary: 'desc',
      },
      maxResults: 50,
      interval: 1800,
      category: 'soc',
    },
  },
  {
    code: 'api-v2ex-hot',
    name: 'V2EX 热议',
    type: 'SEARCH_API',
    enabled: true,
    config: {
      mode: 'list',
      endpoint: 'https://www.v2ex.com/api/v2/topics/hot',
      headers: { 'Content-Type': 'application/json' },
      resultPath: '[*]',
      fieldMap: {
        title: 'title',
        url: 'url',
        publishedAt: 'created',
        summary: 'content_rendered',
      },
      maxResults: 20,
      interval: 1800,
      category: 'tech',
    },
  },
  {
    code: 'api-hackernews-firebase',
    name: 'Hacker News (Firebase)',
    type: 'SEARCH_API',
    enabled: true,
    config: {
      mode: 'list',
      endpoint: 'https://hacker-news.firebaseio.com/v0/topstories.json',
      resultPath: '[*]',
      fieldMap: {
        title: 'title',
        url: 'url',
        publishedAt: 'time',
        summary: 'text',
      },
      maxResults: 30,
      interval: 1800,
      category: 'tech',
    },
  },

  // ── SEARCH_API (mode=query, 需 key, 默认 disabled) ──
  {
    code: 'search-tavily',
    name: 'Tavily Search',
    type: 'SEARCH_API',
    enabled: false,
    config: {
      mode: 'query',
      endpoint: 'https://api.tavily.com/search',
      method: 'POST',
      apiKeyRef: 'tavilyApiKey',
      apiKeyHeader: 'Authorization: Bearer ',
      queryField: 'query',
      queryTemplate: '{keyword}',
      resultPath: 'results[*]',
      fieldMap: {
        title: 'title',
        url: 'url',
        publishedAt: 'published_date',
        summary: 'content',
      },
      tavilyApiKey: '',
      maxResults: 10,
      interval: 0,
      days: 7,
    },
  },
  {
    code: 'search-brave',
    name: 'Brave Search',
    type: 'SEARCH_API',
    enabled: false,
    config: {
      mode: 'query',
      endpoint: 'https://api.search.brave.com/res/v1/web/search',
      method: 'GET',
      apiKeyRef: 'braveApiKey',
      apiKeyHeader: 'X-Subscription-Token: ',
      queryField: 'q',
      queryTemplate: '{keyword}',
      resultPath: 'web.results[*]',
      fieldMap: {
        title: 'title',
        url: 'url',
        publishedAt: 'age',
        summary: 'description',
      },
      braveApiKey: '',
      maxResults: 10,
      interval: 0,
      days: 7,
    },
  },
];

export default sourcesSeed;
