# 05 · 可插拔 SPI 设计

本平台的核心扩展性建立在三个可插拔接口（SPI）之上。所有接口定义在 `packages/shared-types`，前后端共享。

## 5.1 采集器 `ICollector`

### 接口契约

```ts
// packages/shared-types
export interface RawItemInput {
  sourceCode: string;
  url: string;
  title: string;
  rawText?: string;
  publishedAt?: Date;
  meta?: Record<string, unknown>;
}

export interface SourceConfig {
  code: string;
  type: string;                 // 'RSS' | 'SEARCH_API' | 'SEARCH_CRAWL' | 'WEB_SCRAPER' | 自定义
  config: Record<string, unknown>;
}

export interface ICollector {
  readonly type: string;
  fetch(source: SourceConfig): Promise<RawItemInput[]>;
  health?(source: SourceConfig): Promise<{ ok: boolean; detail?: string }>;
}
```

### 注册机制

`collectors.ts` 插件维护 `Map<type, ICollector>`：

```ts
fastify.decorate('collectors', new Map<string, ICollector>());
fastify.decorate('registerCollector', (type: string, impl: ICollector) => {
  fastify.collectors.set(type, impl);
});

// 调度时按 type 查表
const collector = fastify.collectors.get(source.type);
const items = await collector.fetch({ code: source.code, type: source.type, config: source.config });
```

### 内置实现

| type | 实现类 | 说明 |
|---|---|---|
| `RSS` | `RssCollector` | rss-parser 解析 RSS/Atom，开箱即用 |
| `SEARCH_API` | `SearchApiCollector` | 适配 SerpAPI / Serper / Bing API 等，config 填 `endpoint / params / apiKey` |
| `SEARCH_CRAWL` | `SearchCrawlCollector` | 适配 `fetch bing?q=` 等爬虫式搜索，config 填 `searchUrlTemplate + 结果选择器` |
| `WEB_SCRAPER` | `PlaywrightScraperCollector` | **能力预留**：依赖装好、接口就绪，深度正文抓取逻辑后期补 |

### 通用搜索分型（核心诉求）

使用方明确要求搜索要做成「通用架构，能适配各种 API 甚至 web fetch bing?q= 爬虫形式」。设计上搜索不是一个固定实现，而是一族可配置采集器：

- **API 型（`SEARCH_API`）**：通过 HTTP 调用结构化搜索 API，config 描述请求模板与响应映射。
- **爬虫型（`SEARCH_CRAWL`）**：通过 HTTP 抓取搜索结果页 HTML，config 描述 URL 模板与 CSS 选择器抽取。

两者共享 `ICollector` 接口，管理端配置时只需选 type + 填 config，无需改代码。

## 5.2 推送通道 `INotificationChannel`

### 接口契约

```ts
// packages/shared-types
export interface NotificationPayload {
  userId: string;
  userName: string;
  reportId: string;
  issueNo: string;
  subject: string;              // 标题
  summary: string;              // 摘要
  reportUrl: string;            // 站内报告链接
  reportDeepJson: unknown;      // 完整报告数据（通道按需取）
  meta?: Record<string, unknown>;
}

export interface INotificationChannel {
  readonly channel: string;     // 'CONSOLE' | 'EMAIL' | 'WECOM' | 'FEISHU' | 自定义
  send(p: NotificationPayload): Promise<{ ok: boolean; error?: string }>;
}
```

### 注册机制

```ts
fastify.decorate('notifiers', new Map<string, INotificationChannel>());
fastify.decorate('registerNotifier', (channel: string, impl: INotificationChannel) => {
  fastify.notifiers.set(channel, impl);
});
```

### 默认实现：ConsoleNotifier

```ts
@Injectable() // 伪代码，Fastify 下为普通类
export class ConsoleNotifier implements INotificationChannel {
  readonly channel = 'CONSOLE';
  async send(p: NotificationPayload) {
    console.log('[NOTIFY→CONSOLE]', p.userId, p.subject, p.summary, p.reportUrl);
    return { ok: true };
  }
}
fastify.registerNotifier('CONSOLE', new ConsoleNotifier());
```

满足使用方「简单实现先跑」诉求，零依赖。

### 内网扩展（使用方实现）

使用方在内网实现 Email / 企业微信 / 飞书 / 钉钉 / Telegram 等通道，`registerNotifier` 注册即用，**核心 delivery 代码零改动**：

```ts
// 使用方内网代码
fastify.registerNotifier('WECOM', new WeComChannel({ webhook: '...', secret: '...' }));
fastify.registerNotifier('EMAIL', new EmailChannel({ smtp: '...' }));
```

## 5.3 LLM（Vercel AI SDK，非自研 SPI）

LLM **不手写 provider 抽象**，直接使用 Vercel AI SDK。`llm.ts` 插件初始化时把 `baseURL` 指向内网模型服务（OpenAI 兼容地址）：

```ts
// llm.ts
import { createOpenAI } from '@ai-sdk/openai';

const provider = createOpenAI({
  baseURL: process.env.LLM_BASE_URL ?? 'http://internal-llm/v1',  // 内网地址
  apiKey:  process.env.LLM_API_KEY ?? 'internal',
});

fastify.decorate('llm', {
  // chat 模型
  chat: provider('internal-model-name'),
});
```

处理管道使用：

- **`generateText`**：自由文本产出（领域点评、趋势总结、编辑荐语、语义判重）。
- **`generateObject` + zod**：结构化产出（分类、热度、摘要字段）。

### 为何不用 embedding
使用方确认内网 LLM **无 embedding 能力，仅 chat**。因此：
- 去重走「指纹（URL 归一化）+ LLM 语义判重」，**无需 pgvector / 向量库**。
- 数据库用纯 MySQL 即可。

## 5.4 SPI 总览

| SPI | 接口 | 默认实现 | 内网扩展 |
|---|---|---|---|
| 采集器 | `ICollector` | RSS / SearchApi / SearchCrawl / Playwright(预留) | 内部知识库 / 内网数据源 |
| 推送通道 | `INotificationChannel` | ConsoleNotifier（打印） | Email / 企微 / 飞书 / 钉钉 / Telegram |
| LLM | Vercel AI SDK（非自研） | 内网 OpenAI 兼容地址 | 内网私有模型（改 baseURL） |

四类扩展均**不改核心代码**，靠接口 + Fastify plugin 注册接入。
