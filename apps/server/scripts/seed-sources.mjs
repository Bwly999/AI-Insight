/**
 * 灌入源种子数据（幂等：INSERT … ON DUPLICATE KEY UPDATE）。
 *
 * 用法：cd apps/server && node scripts/seed-sources.mjs
 * 依赖：mysql2（已在 production deps）。
 */
import mysql from 'mysql2/promise';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL
  ?? 'mysql://root:aiinsight@localhost:3306/ai_insight';

const sourcesSeed = [
  { code: 'rss-solidot', name: 'Solidot', type: 'RSS', config: { feedUrl: 'https://solidot.org/index.rss', maxItems: 50, stripHtml: true, interval: 1800, category: 'tech' }, enabled: 1 },
  { code: 'rss-aihot', name: 'AI Hot', type: 'RSS', config: { feedUrl: 'https://aihot.com/feed/all.xml', maxItems: 50, stripHtml: true, interval: 1800, category: 'ai' }, enabled: 1 },
  { code: 'rss-arxiv-csai', name: 'arXiv CS.AI', type: 'RSS', config: { feedUrl: 'https://rss.arxiv.org/rss/cs.AI', maxItems: 30, stripHtml: true, interval: 3600, category: 'ai' }, enabled: 1 },
  { code: 'crawl-ithome', name: 'IT之家热榜', type: 'SEARCH_CRAWL', config: { listUrl: 'https://www.ithome.com/', itemSelector: '.latest li, .hot li', fieldSelectors: { title: 'a', url: 'a', date: 'span.date' }, maxResults: 50, interval: 1800, category: 'tech' }, enabled: 1 },
  { code: 'crawl-hackernews', name: 'Hacker News', type: 'SEARCH_CRAWL', config: { listUrl: 'https://news.ycombinator.com/', itemSelector: 'tr.athing', fieldSelectors: { title: 'td.title .titleline a', url: 'td.title .titleline a' }, maxResults: 30, interval: 1800, category: 'tech' }, enabled: 1 },
  { code: 'crawl-github-trending', name: 'GitHub Trending', type: 'SEARCH_CRAWL', config: { listUrl: 'https://github.com/trending', itemSelector: 'article.Box-row', fieldSelectors: { title: 'h2 a', url: 'h2 a' }, maxResults: 25, interval: 3600, category: 'tech' }, enabled: 1 },
  { code: 'api-wallstreetcn-live', name: '华尔街见闻快讯', type: 'SEARCH_API', config: { mode: 'list', endpoint: 'https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&limit=50', resultPath: 'data.items[*]', fieldMap: { title: 'title', url: 'uri', publishedAt: 'display_time', summary: 'content_short' }, maxResults: 50, interval: 600, category: 'finance' }, enabled: 1 },
  { code: 'api-bilibili-hot', name: 'Bilibili 热门', type: 'SEARCH_API', config: { mode: 'list', endpoint: 'https://api.bilibili.com/x/web-interface/popular', resultPath: 'data.list[*]', fieldMap: { title: 'title', url: 'short_link_v2', publishedAt: 'pubdate', summary: 'desc' }, maxResults: 50, interval: 1800, category: 'soc' }, enabled: 1 },
  { code: 'api-v2ex-hot', name: 'V2EX 热议', type: 'SEARCH_API', config: { mode: 'list', endpoint: 'https://www.v2ex.com/api/v2/topics/hot', headers: { 'Content-Type': 'application/json' }, resultPath: '[*]', fieldMap: { title: 'title', url: 'url', publishedAt: 'created', summary: 'content_rendered' }, maxResults: 20, interval: 1800, category: 'tech' }, enabled: 1 },
  { code: 'api-hackernews-firebase', name: 'Hacker News (Firebase)', type: 'SEARCH_API', config: { mode: 'list', endpoint: 'https://hacker-news.firebaseio.com/v0/topstories.json', resultPath: '[*]', fieldMap: { title: 'title', url: 'url', publishedAt: 'time', summary: 'text' }, maxResults: 30, interval: 1800, category: 'tech' }, enabled: 1 },
  { code: 'search-tavily', name: 'Tavily Search', type: 'SEARCH_API', config: { mode: 'query', endpoint: 'https://api.tavily.com/search', method: 'POST', apiKeyRef: 'tavilyApiKey', apiKeyHeader: 'Authorization: Bearer ', queryField: 'query', queryTemplate: '{keyword}', resultPath: 'results[*]', fieldMap: { title: 'title', url: 'url', publishedAt: 'published_date', summary: 'content' }, tavilyApiKey: '', maxResults: 10, interval: 0, days: 7 }, enabled: 0 },
  { code: 'search-brave', name: 'Brave Search', type: 'SEARCH_API', config: { mode: 'query', endpoint: 'https://api.search.brave.com/res/v1/web/search', method: 'GET', apiKeyRef: 'braveApiKey', apiKeyHeader: 'X-Subscription-Token: ', queryField: 'q', queryTemplate: '{keyword}', resultPath: 'web.results[*]', fieldMap: { title: 'title', url: 'url', publishedAt: 'age', summary: 'description' }, braveApiKey: '', maxResults: 10, interval: 0, days: 7 }, enabled: 0 },
];

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  for (const s of sourcesSeed) {
    const [existing] = await conn.execute(
      'SELECT id FROM sources WHERE code = ?',
      [s.code],
    );
    if (existing[0]) {
      await conn.execute(
        'UPDATE sources SET name=?, type=?, config=?, enabled=? WHERE code=?',
        [s.name, s.type, JSON.stringify(s.config), s.enabled, s.code],
      );
      console.log(`UPDATE  ${s.code}`);
    } else {
      await conn.execute(
        'INSERT INTO sources (code, name, type, config, enabled) VALUES (?, ?, ?, ?, ?)',
        [s.code, s.name, s.type, JSON.stringify(s.config), s.enabled],
      );
      console.log(`INSERT  ${s.code}`);
    }
  }

  await conn.end();
  console.log(`\n✅ 完成：${sourcesSeed.length} 条源种子已同步`);
}

main().catch((err) => {
  console.error('❌ 种子灌入失败', err);
  process.exit(1);
});
