# 附录 A · 数据契约

> 全表 schema + 全 DTO + 全 SPI 接口签名的**单一真源**。Phase 文档引用本文，不重复定义。
>
> - §A.1–A.12：**Phase 0 已落地**的 12 表（Drizzle 实现见 `apps/server/src/db/schema.ts`）。
> - §A.13–A.17：**Phase 1B/1C 新增**的 5 表（Drizzle 代码待施工）。
> - §A.18：Fastify 装饰器总表。
> - §A.19：SPI 接口（ICollector / INotificationChannel / IAgentRuntime）。
> - §A.20：DTO 总表（按模块）。

---

## A.1 users（Phase 0）

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| external_id | varchar(128) | not null, unique |
| name | varchar(128) | not null |
| role | enum('USER','ADMIN') | default 'USER' |
| created_at | timestamp | default CURRENT_TIMESTAMP |
| last_seen_at | timestamp | nullable |

Drizzle 变量：`users`。行类型：`User`。

## A.2 categories（Phase 0）

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| code | varchar(64) | not null, unique |
| label | varchar(128) | not null |
| color | varchar(16) | not null |
| sort_order | int | default 0 |
| enabled | boolean | default true |

Drizzle 变量：`categories`。行类型：`Category`。

## A.3 sources（Phase 0）

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| code | varchar(64) | not null, unique |
| name | varchar(128) | not null |
| type | varchar(32) | not null（RSS/SEARCH_API/SEARCH_CRAWL/WEB_SCRAPER/自定义） |
| config | json | `Record<string,unknown>` |
| enabled | boolean | default true |
| created_at | timestamp | default CURRENT_TIMESTAMP |

Drizzle 变量：`sources`。行类型：`Source`。

> **config 形态**：按 `type` 不同，见 §A.19.1 的 `SourceConfig`。Phase 1A 任务卡会给各 type 的 zod schema。

## A.4 collect_logs（Phase 0）

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| source_id | int | not null, FK→sources.id |
| status | enum('RUNNING','SUCCESS','FAILED') | not null |
| started_at | timestamp | not null, default CURRENT_TIMESTAMP |
| finished_at | timestamp | default CURRENT_TIMESTAMP |
| items_fetched | int | default 0 |
| items_new | int | default 0 |
| error | text | nullable |

索引：`(source_id, status)` 复合；`started_at` 单列。
Drizzle 变量：`collectLogs`。行类型：`CollectLog`。

## A.5 raw_items（Phase 0）

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| source_id | int | not null, FK→sources.id |
| fingerprint | varchar(64) | not null, unique |
| url | text | not null |
| title | varchar(512) | not null |
| raw_text | text | nullable |
| published_at | timestamp | default CURRENT_TIMESTAMP |
| captured_at | timestamp | not null, default CURRENT_TIMESTAMP |
| dedupe_key | varchar(64) | nullable |

索引：`source_id` 单列；`dedupe_key` 单列。
Drizzle 变量：`rawItems`。行类型：`RawItem`。

> **fingerprint 算法**：见 1A 任务 1A.5（URL 归一化 → sha256 前 16 位）。

## A.6 articles（Phase 0）

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| raw_item_id | int | nullable, FK→raw_items.id |
| category_code | varchar(64) | nullable, FK→categories.code |
| summary | text | not null（中文摘要） |
| heat | int | not null（0–100） |
| tags | json | `string[]` |
| critical | boolean | default false（头条标记） |
| trend_comment | text | nullable（深度报告点评） |
| processed_at | timestamp | not null, default CURRENT_TIMESTAMP |

索引：`category_code`；`heat`；`critical`。
Drizzle 变量：`articles`。行类型：`Article`。

## A.7 report_schedules（Phase 0）

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| name | varchar(128) | not null |
| cron | varchar(64) | not null（5 段 cron） |
| period_hours | int | not null（裁剪窗口） |
| enabled | boolean | default true |
| created_at | timestamp | default CURRENT_TIMESTAMP |

Drizzle 变量：`reportSchedules`。行类型：`ReportSchedule`。

## A.8 subscriptions（Phase 0）

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| user_id | int | not null, FK→users.id |
| schedule_id | int | not null, FK→report_schedules.id |
| category_codes | json | `string[]` |
| keywords | json | `string[]` |
| channels | json | `string[]` |
| active | boolean | default true |
| updated_at | timestamp | default CURRENT_TIMESTAMP |

索引：`user_id`；`schedule_id`。
Drizzle 变量：`subscriptions`。行类型：`Subscription`。

## A.9 reports（Phase 0）

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| issue_no | varchar(32) | not null |
| user_id | int | not null, FK→users.id |
| schedule_id | int | not null, FK→report_schedules.id |
| period_start | timestamp | not null, default CURRENT_TIMESTAMP（worker 覆盖） |
| period_end | timestamp | not null, default CURRENT_TIMESTAMP |
| headline_json | json | `unknown` |
| body_json | json | `unknown` |
| status | enum('GENERATING','READY','SENT','FAILED') | not null |
| created_at | timestamp | default CURRENT_TIMESTAMP |
| sent_at | timestamp | default CURRENT_TIMESTAMP |

索引：`(user_id, issue_no)` 复合；`schedule_id`。
Drizzle 变量：`reports`。行类型：`Report`。

> **issueNo 规则**（留白 14.3.4）：Mode 1 用 `{scheduleCode}.{YYYYMMDD}-{seq}`（如 `DAILY.20260618-001`）；Mode 2 用 `INS-{sessionId}`。

## A.10 report_items（Phase 0）

| 列 | 类型 | 约束 |
|---|---|---|
| report_id | int | not null, FK→reports.id, PK 组成 |
| article_id | int | not null, FK→articles.id, PK 组成 |
| sort_order | int | not null |
| section | varchar(32) | nullable（headline/featured/archive） |

PK：`(report_id, article_id)` 复合。索引：`report_id`。
Drizzle 变量：`reportItems`。行类型：`ReportItem`。

## A.11 notification_logs（Phase 0）

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| user_id | int | not null, FK→users.id |
| report_id | int | nullable, FK→reports.id |
| channel | varchar(32) | not null |
| status | enum('PENDING','SUCCESS','FAILED') | not null |
| payload | json | `unknown`（NotificationPayload） |
| idempotency_key | varchar(128) | nullable（幂等：report+channel） |
| error | text | nullable |
| created_at | timestamp | default CURRENT_TIMESTAMP |

索引：`(report_id, channel)` 复合；`idempotency_key`。
Drizzle 变量：`notificationLogs`。行类型：`NotificationLog`。

## A.12 feedback（Phase 0）

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| user_id | int | not null, FK→users.id |
| article_id | int | not null, FK→articles.id |
| type | enum('USEFUL','USELESS','COLLECT') | not null |
| note | text | nullable |
| created_at | timestamp | default CURRENT_TIMESTAMP |

索引：`(user_id, article_id)` 复合。
Drizzle 变量：`feedback`。行类型：`Feedback`。

---

## A.13 insight_sessions（Phase 1B 新增）

一次 Mode 2 Agent 会话。

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| user_id | int | not null, FK→users.id |
| intent | text | not null（用户意图原文） |
| skill_set | json | `string[]`（允许加载的 skill name） |
| status | enum('RUNNING','SUCCESS','FAILED','ABORTED') | not null |
| budget | json | `SessionBudget` |
| used_tokens | int | default 0 |
| used_steps | int | default 0 |
| used_tool_calls | int | default 0 |
| report_markdown | longtext | nullable |
| source_article_ids | json | `number[]`（引用的 articles） |
| started_at | timestamp | not null, default CURRENT_TIMESTAMP |
| finished_at | timestamp | nullable |
| error | text | nullable |

索引：`user_id`；`(status, started_at)` 复合。
Drizzle 变量：`insightSessions`。行类型：`InsightSession`。

## A.14 agent_steps（Phase 1B 新增）

Agent 每一步思考（用于回放）。

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| session_id | int | not null, FK→insight_sessions.id |
| step_no | int | not null（从 1 递增） |
| role | enum('ASSISTANT','TOOL','SYSTEM') | not null |
| content | text | nullable（思考/输出文本） |
| tool_calls | json | nullable（本步的工具调用列表） |
| tokens | int | default 0 |
| created_at | timestamp | default CURRENT_TIMESTAMP |

索引：`session_id`；`(session_id, step_no)` 复合。
Drizzle 变量：`agentSteps`。行类型：`AgentStep`。

## A.15 agent_tool_calls（Phase 1B 新增）

每次工具调用（审计）。

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| session_id | int | not null, FK→insight_sessions.id |
| step_id | int | nullable, FK→agent_steps.id |
| tool | enum('COLLECT','SEARCH','EXTRACT','QUERY_ARTICLES','VAULT_READ','VAULT_WRITE','FINALIZE') | not null |
| args | json | nullable |
| result | json | nullable |
| ok | boolean | not null |
| error | text | nullable |
| duration_ms | int | default 0 |
| created_at | timestamp | default CURRENT_TIMESTAMP |

索引：`session_id`；`tool`。
Drizzle 变量：`agentToolCalls`。行类型：`AgentToolCall`。

## A.16 skill_revisions（Phase 1B 新增）

声明式 Skill 的版本记录。

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| name | varchar(64) | not null |
| version | varchar(16) | not null |
| frontmatter | json | `SkillFrontmatter` |
| body_md | longtext | not null |
| author_id | int | not null, FK→users.id |
| enabled | boolean | default false |
| created_at | timestamp | default CURRENT_TIMESTAMP |
| audit_note | text | not null（改动说明，强制写） |

唯一约束：`(name, version)`。索引：`(name, enabled)`。
Drizzle 变量：`skillRevisions`。行类型：`SkillRevision`。

## A.17 vault_entries（Phase 1C 新增）

跨 session 洞察沉淀。

| 列 | 类型 | 约束 |
|---|---|---|
| id | int | PK, autoincrement |
| title | varchar(256) | not null |
| body_md | longtext | not null |
| tags | json | `string[]` |
| source_session_id | int | nullable, FK→insight_sessions.id |
| pinned | boolean | default false |
| created_at | timestamp | default CURRENT_TIMESTAMP |
| updated_at | timestamp | default CURRENT_TIMESTAMP |

索引：`tags`（JSON 索引或虚拟列，MySQL 8.0+）；`source_session_id`。
Drizzle 变量：`vaultEntries`。行类型：`VaultEntry`。

---

## A.18 Fastify 装饰器总表

| 装饰器 | 类型 | 来源插件 | Phase |
|---|---|---|---|
| `app.db` | `DrizzleDB`（MySql2Database） | db.ts | 0 |
| `app.queue` | `{ collection, processing, report, delivery: Queue }` | queue.ts | 0 |
| `app.http` | `undici.Dispatcher` | http-client.ts | 0 |
| `app.llm` | `{ chat: LanguageModel, model: string }` | llm.ts | 0 |
| `app.collectors` | `Map<string, ICollector>` | collectors.ts | 0 |
| `app.registerCollector(type, impl)` | `(t: string, i: ICollector) => void` | collectors.ts | 0 |
| `app.notifiers` | `Map<string, INotificationChannel>` | notifiers.ts | 0 |
| `app.registerNotifier(channel, impl)` | `(c: string, i: INotificationChannel) => void` | notifiers.ts | 0 |
| `app.auth` | `preHandler: (req, reply) => Promise<void>` | auth.ts | 0 |
| `app.requireAdmin` | `preHandler: (req, reply) => Promise<void>` | auth.ts | 0 |
| `app.signDevToken?` | `(opts) => Promise<string>` | auth.ts（dev only） | 0 |
| `app.scheduler` | `Scheduler`（cron 管理） | scheduler.ts | 1A（重写） |
| `app.crypto` | `CryptoUtil`（加解密 apiKey） | crypto.ts（新） | 1A |
| `app.agentRuntime` | `IAgentRuntime` | agent-runtime.ts（新） | 1B |

---

## A.19 SPI 接口

### A.19.1 ICollector（采集器）

> 已定义于 `packages/shared-types/src/spi/collector.ts`。

```ts
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
  type: string;  // 'RSS' | 'SEARCH_API' | 'SEARCH_CRAWL' | 'WEB_SCRAPER' | 自定义
  config: Record<string, unknown>;
}

export interface CollectorHealth {
  ok: boolean;
  detail?: string;
}

export interface ICollector {
  readonly type: string;
  fetch(source: SourceConfig): Promise<RawItemInput[]>;
  health?(source: SourceConfig): Promise<CollectorHealth>;
}
```

**config 形态**（按 type，Phase 1A 标准化）：

```ts
// RSS
interface RssConfig {
  feedUrl: string;
  maxItems?: number;       // 默认 50
  stripHtml?: boolean;     // 默认 true
}

// SEARCH_API mode='list'（无 query，直接拉列表）
interface SearchApiListConfig {
  mode: 'list';
  endpoint: string;
  method?: 'GET' | 'POST';  // 默认 GET
  headers?: Record<string, string>;
  resultPath: string;       // 点路径，如 'data.list' 或 'data.items[*]'
  fieldMap: { title: string; url: string; publishedAt?: string; summary?: string };
  maxResults?: number;      // 默认 50
}

// SEARCH_API mode='query'（带 query + apiKey）
interface SearchApiQueryConfig {
  mode: 'query';
  endpoint: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  apiKeyRef: string;        // 引用 sources 表的加密 key（见 crypto）
  apiKeyHeader?: string;    // 默认 'Authorization: Bearer '
  queryField: string;       // query 参数名，如 'query' / 'q'
  queryTemplate?: string;   // 模板，如 'AI {keyword}'，{keyword} 由 Agent 传入
  resultPath: string;
  fieldMap: { title: string; url: string; publishedAt?: string; summary?: string };
  days?: number;            // 时间窗
  maxResults?: number;
}

// SEARCH_CRAWL（HTML 爬取）
interface SearchCrawlConfig {
  listUrl?: string;              // mode='list'：固定 URL
  searchUrlTemplate?: string;    // mode='query'：含 {query} 占位
  itemSelector: string;          // CSS 选择器，如 '#list .item'
  fieldSelectors: {
    title: string;               // 相对 item 的选择器
    url: string;                 // 相对 item 的选择器（可取 href）
    date?: string;               // 可选
  };
  maxResults?: number;           // 默认 50
}

// WEB_SCRAPER（正文补全，Phase 2）
interface WebScraperConfig {
  bodyExtractor: 'readability' | 'firecrawl';
  maxBytes?: number;             // 默认 1MB
  selectors?: { content?: string }; // readability 通常无需
}
```

### A.19.2 INotificationChannel（推送通道）

> 已定义于 `packages/shared-types/src/spi/notifier.ts`。

```ts
export interface NotificationPayload {
  userId: string;
  userName: string;
  reportId: string;
  issueNo: string;
  subject: string;
  summary: string;
  reportUrl: string;
  reportDeepJson: unknown;
  meta?: Record<string, unknown>;
}

export interface NotificationResult {
  ok: boolean;
  error?: string;
}

export interface INotificationChannel {
  readonly channel: string;  // 'CONSOLE' | 'EMAIL' | 'WECOM' | 'FEISHU' | 自定义
  send(p: NotificationPayload): Promise<NotificationResult>;
}
```

### A.19.3 IAgentRuntime（Mode 2 Agent 运行时，Phase 1B 新增）

> Pi Agent SDK 的抽象，便于 W1 不可得时换兜底实现。

```ts
export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
  execute: (args: Record<string, unknown>, ctx: AgentToolContext) => Promise<unknown>;
}

export interface AgentToolContext {
  sessionId: number;
  userId: number;
  stepNo: number;
}

export interface SessionBudget {
  maxSteps: number;       // 默认 25
  maxToolCalls: number;   // 默认 40
  maxTokens: number;      // 默认 60000
}

export interface RunInsightInput {
  userId: number;
  intent: string;
  skillSet: string[];
  budget: SessionBudget;
}

export interface RunInsightResult {
  sessionId: number;
  status: 'SUCCESS' | 'FAILED' | 'ABORTED';
  reportMarkdown?: string;
  usedTokens: number;
  usedSteps: number;
  usedToolCalls: number;
}

export interface IAgentRuntime {
  /** 流式跑一个 insight session，通过回调推 step 事件（SSE 用）。 */
  run(
    input: RunInsightInput,
    onStep: (event: AgentStepEvent) => void,
  ): Promise<RunInsightResult>;
}

export interface AgentStepEvent {
  type: 'step' | 'tool_call' | 'tool_result' | 'final' | 'error';
  stepNo: number;
  role?: 'ASSISTANT' | 'TOOL' | 'SYSTEM';
  content?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  tokens?: number;
}
```

**实现**：
- `PiAgentRuntime`（默认，`apps/server/src/insight/runtime-pi.ts`）—— 用 `@mariozechner/pi-coding-agent`。
- `AiSdkRuntime`（兜底，`apps/server/src/insight/runtime-aisdk.ts`）—— Vercel AI SDK + 自写循环，W1 不可得时启用。

---

## A.20 DTO 总表

> 全部已定义于 `packages/shared-types/src/dto/`。这里只列名字 + 出处文件，签名查源文件。

| DTO | 文件 | 用途 |
|---|---|---|
| `PaginationQuery`, `Paginated<T>`, `ApiError` | `common.ts` | 分页与错误 |
| `AuthUser`, `AuthMeResponse`, `JwtClaimsShape` | `auth.ts` | 认证 |
| `SourceTypeValues`, `CreateSourceBody`, `UpdateSourceBody`, `SourceView`, `SourceListItem` | `source.ts` | 数据源 CRUD |
| `CreateCategoryBody`, `UpdateCategoryBody`, `CategoryView` | `category.ts` | 分类 CRUD |
| `CreateScheduleBody`, `UpdateScheduleBody`, `ScheduleView`, `ScheduleListItem` | `schedule.ts` | 报告调度 CRUD |
| `UpsertSubscriptionBody`, `SubscriptionView` | `subscription.ts` | 订阅 |
| `ArticleView`, `ReportHeadline`, `ReportBodyItem`, `ReportTrendSection`, `ReportView`, `ReportArchiveItem`, `UpdateArticleBody` | `report.ts` | 报告与文章 |
| `CreateFeedbackBody`, `FeedbackArticleLite`, `FeedbackView` | `feedback.ts` | 反馈 |
| `ProxyConfigBody`, `ProxyConfigView`, `GlobalCronBody`, `GlobalCronView`, `NotificationChannelView`, `AdminUserView`, `UpdateUserRoleBody`, `CollectLogView`, `NotificationLogView`, `DashboardStats` | `system.ts` | 管理端系统 |
| **（Phase 1B 新增）** `CreateInsightSessionBody`, `InsightSessionView`, `AgentStepView`, `AgentToolCallView` | `insight.ts`（新） | Mode 2 会话 |
| **（Phase 1B 新增）** `CreateSkillRevisionBody`, `SkillRevisionView` | `skill.ts`（新） | Skill 版本 |
| **（Phase 1C 新增）** `VaultEntryView`, `CreateVaultEntryBody` | `vault.ts`（新） | 沉淀库 |

**Phase 1B/1C 新增 DTO 的签名**：见对应任务卡（1B.4 / 1B.6 / 1C.3）。

---

## A.21 枚举总表

> 定义于 `packages/shared-types/src/enums.ts`。

| 枚举 | 值 |
|---|---|
| `UserRole` | `'USER' \| 'ADMIN'` |
| `SourceType` | `'RSS' \| 'SEARCH_API' \| 'SEARCH_CRAWL' \| 'WEB_SCRAPER'` |
| `CollectStatus` | `'RUNNING' \| 'SUCCESS' \| 'FAILED'` |
| `ReportStatus` | `'GENERATING' \| 'READY' \| 'SENT' \| 'FAILED'` |
| `NotificationStatus` | `'PENDING' \| 'SUCCESS' \| 'FAILED'` |
| `FeedbackType` | `'USEFUL' \| 'USELESS' \| 'COLLECT'` |
| `NotificationChannelType` | `'CONSOLE' \| 'EMAIL' \| 'WECOM' \| 'FEISHU' \| 'DINGTALK' \| 'TELEGRAM'` |
| `ReportSection` | `'headline' \| 'featured' \| 'archive'` |
| `ProxyAuthScheme` | `'none' \| 'basic' \| 'bearer'` |
| `GlobalCronName` | `'collect' \| 'process'` |
| **（Phase 1B 新增）** `InsightStatus` | `'RUNNING' \| 'SUCCESS' \| 'FAILED' \| 'ABORTED'` |
| **（Phase 1B 新增）** `AgentStepRole` | `'ASSISTANT' \| 'TOOL' \| 'SYSTEM'` |
| **（Phase 1B 新增）** `AgentToolName` | `'COLLECT' \| 'SEARCH' \| 'EXTRACT' \| 'QUERY_ARTICLES' \| 'VAULT_READ' \| 'VAULT_WRITE' \| 'FINALIZE'` |
