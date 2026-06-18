# 附录 B · API 清单

> 全 REST 端点总表。`权限`列：`公开`=无 preHandler；`USER`=`[app.auth]`；`ADMIN`=`[app.auth, app.requireAdmin]`。
> `Phase`列：0=已实现；1A/1B/1C/2/3/4/5=待实现。
> Body/Resp 类型引用 `附录 A.20` 的 DTO。

---

## B.1 公共

| Method | Path | 权限 | Phase | 说明 |
|---|---|---|---|---|
| GET | `/health` | 公开 | 0 | 健康检查（插件装载状态） |
| GET | `/api/health` | 公开 | 0 | `/health` 别名（Nginx 反代用） |

## B.2 认证

| Method | Path | 权限 | Phase | Body | Resp | 说明 |
|---|---|---|---|---|---|---|
| GET | `/auth/me` | USER | 0 | — | `AuthMeResponse` | 当前用户信息 |
| POST | `/auth/dev-token` | 公开 | 0 | `{ externalId?, name?, role? }` | `{ token }` | dev-only，签发测试 token |

## B.3 用户端（需登录）

| Method | Path | 权限 | Phase | Body | Resp | 说明 |
|---|---|---|---|---|---|---|
| GET | `/reports/current` | USER | 3 | — | `ReportView` | 本期报告（按用户订阅） |
| GET | `/reports` | USER | 3 | `?page&size` | `Paginated<ReportArchiveItem>` | 往期报告列表 |
| GET | `/reports/:id` | USER | 3 | — | `ReportView` | 报告详情 |
| GET | `/subscriptions` | USER | 3 | — | `SubscriptionView[]` | 我的订阅 |
| PUT | `/subscriptions` | USER | 3 | `UpsertSubscriptionBody` | `SubscriptionView` | 更新订阅 |
| GET | `/categories` | USER | 3 | — | `CategoryView[]` | 可订阅领域列表 |
| POST | `/feedback` | USER | 3 | `CreateFeedbackBody` | `FeedbackView` | 对 article 反馈/收藏 |
| GET | `/feedback` | USER | 3 | `?type` | `FeedbackView[]` | 我的反馈/收藏列表 |

## B.4 用户端 · Mode 2 主动洞察

| Method | Path | 权限 | Phase | Body | Resp | 说明 |
|---|---|---|---|---|---|---|
| POST | `/insight/sessions` | USER | 1B | `CreateInsightSessionBody` | SSE 流 + `{ sessionId }` | 发起洞察会话 |
| GET | `/insight/sessions/:id/stream` | USER | 1B | — | SSE 流 | 实时推 step（断线重连） |
| GET | `/insight/sessions/:id` | USER | 1B | — | `InsightSessionView` | 取最终报告 + trace 摘要 |
| GET | `/insight/sessions` | USER | 1B | `?page&size&status` | `Paginated<InsightSessionView>` | 我的会话历史 |
| POST | `/insight/sessions/:id/to-subscription` | USER | 1C | `{ scheduleId }` | `SubscriptionView` | 一键转 Mode 1 订阅 |
| GET | `/vault` | USER | 1C | `?page&size&tag&q` | `Paginated<VaultEntryView>` | 沉淀库浏览 |

## B.5 管理端 · 数据源（Phase 1A）

| Method | Path | 权限 | Phase | Body | Resp | 说明 |
|---|---|---|---|---|---|---|
| GET | `/admin/sources` | ADMIN | 1A | `?page&size&type&enabled` | `Paginated<SourceListItem>` | 数据源列表（含最近采集状态） |
| POST | `/admin/sources` | ADMIN | 1A | `CreateSourceBody` | `SourceView` | 新建源 |
| GET | `/admin/sources/:id` | ADMIN | 1A | — | `SourceView` | 源详情 |
| PUT | `/admin/sources/:id` | ADMIN | 1A | `UpdateSourceBody` | `SourceView` | 更新源 |
| DELETE | `/admin/sources/:id` | ADMIN | 1A | — | `{ ok }` | 删除源 |
| POST | `/admin/sources/:id/test` | ADMIN | 1A | — | `{ items: RawItemInput[], count }` | 试采（不落库，回显前 N 条） |
| POST | `/admin/collect/run` | ADMIN | 1A | `{ sourceId? }` | `{ jobId }` | 手动触发采集（全部或单源） |
| GET | `/admin/collect/logs` | ADMIN | 1A | `?sourceId&page&size&status` | `Paginated<CollectLogView>` | 采集日志 |

## B.6 管理端 · 系统（Phase 1A）

| Method | Path | 权限 | Phase | Body | Resp | 说明 |
|---|---|---|---|---|---|---|
| GET | `/admin/proxy` | ADMIN | 1A | — | `ProxyConfigView` | 读代理配置（脱敏） |
| PUT | `/admin/proxy` | ADMIN | 1A | `ProxyConfigBody` | `ProxyConfigView` | 写代理配置（触发 http-client 重建） |
| POST | `/admin/proxy/test` | ADMIN | 1A | — | `{ ok, detail }` | 代理连通性测试 |
| GET | `/admin/cron` | ADMIN | 1A | — | `GlobalCronView` | 读全局 cron |
| PUT | `/admin/cron` | ADMIN | 1A | `GlobalCronBody` | `GlobalCronView` | 写全局 cron（触发 scheduler 重载） |

## B.7 管理端 · 分类与调度（Phase 2/3）

| Method | Path | 权限 | Phase | Body | Resp | 说明 |
|---|---|---|---|---|---|---|
| GET | `/admin/categories` | ADMIN | 2 | — | `CategoryView[]` | 分类列表 |
| POST | `/admin/categories` | ADMIN | 2 | `CreateCategoryBody` | `CategoryView` | 新建分类 |
| PUT | `/admin/categories/:id` | ADMIN | 2 | `UpdateCategoryBody` | `CategoryView` | 更新分类 |
| DELETE | `/admin/categories/:id` | ADMIN | 2 | — | `{ ok }` | 删除分类 |
| GET | `/admin/schedules` | ADMIN | 3 | — | `ScheduleListItem[]` | 调度目标列表 |
| POST | `/admin/schedules` | ADMIN | 3 | `CreateScheduleBody` | `ScheduleView` | 新建调度 |
| PUT | `/admin/schedules/:id` | ADMIN | 3 | `UpdateScheduleBody` | `ScheduleView` | 更新调度 |
| DELETE | `/admin/schedules/:id` | ADMIN | 3 | — | `{ ok }` | 删除调度 |

## B.8 管理端 · AI 处理（Phase 2）

| Method | Path | 权限 | Phase | Body | Resp | 说明 |
|---|---|---|---|---|---|---|
| GET | `/admin/articles` | ADMIN | 2 | `?page&size&category&since` | `Paginated<ArticleView>` | Article 池浏览 |
| PUT | `/admin/articles/:id` | ADMIN | 2 | `UpdateArticleBody` | `ArticleView` | 事后纠错（改 summary/heat/critical） |
| POST | `/admin/process/run` | ADMIN | 2 | `{ since? }` | `{ jobId }` | 手动触发处理 |
| GET | `/admin/process/status` | ADMIN | 2 | — | `{ pending, running, failed, tokenUsage }` | 处理监控 |
| POST | `/admin/process/rerun/:articleId` | ADMIN | 2 | — | `{ ok }` | 重跑单条 |

## B.9 管理端 · 报告（Phase 3）

| Method | Path | 权限 | Phase | Body | Resp | 说明 |
|---|---|---|---|---|---|---|
| GET | `/admin/reports` | ADMIN | 3 | `?page&size&scheduleId&status` | `Paginated<ReportView>` | 报告列表 |
| GET | `/admin/reports/:id` | ADMIN | 3 | — | `ReportView` | 报告详情 |
| POST | `/admin/reports/generate` | ADMIN | 3 | `{ scheduleId }` | `{ jobId }` | 手动触发报告生成 |

## B.10 管理端 · 推送（Phase 4）

| Method | Path | 权限 | Phase | Body | Resp | 说明 |
|---|---|---|---|---|---|---|
| GET | `/admin/channels` | ADMIN | 4 | — | `NotificationChannelView[]` | 已注册通道列表 |
| POST | `/admin/channels/:channel/test` | ADMIN | 4 | — | `{ ok, detail }` | 通道连通性测试 |
| GET | `/admin/notifications` | ADMIN | 4 | `?page&size&status&channel` | `Paginated<NotificationLogView>` | 推送日志 |
| POST | `/admin/notifications/:id/retry` | ADMIN | 4 | — | `{ ok }` | 手动重推单条 |

## B.11 管理端 · 用户（Phase 5）

| Method | Path | 权限 | Phase | Body | Resp | 说明 |
|---|---|---|---|---|---|---|
| GET | `/admin/users` | ADMIN | 5 | `?page&size` | `Paginated<AdminUserView>` | 用户列表 |
| PUT | `/admin/users/:id/role` | ADMIN | 5 | `UpdateUserRoleBody` | `AdminUserView` | 改角色 |

## B.12 管理端 · Insight 与 Skill（Phase 1B/1C）

| Method | Path | 权限 | Phase | Body | Resp | 说明 |
|---|---|---|---|---|---|---|
| GET | `/admin/insight/sessions` | ADMIN | 1B | `?page&size&userId&status` | `Paginated<InsightSessionView>` | 全部会话列表 |
| GET | `/admin/insight/sessions/:id/trace` | ADMIN | 1B | — | `{ session, steps, toolCalls }` | 完整 trace 回放 |
| GET | `/admin/skills` | ADMIN | 1B | — | `SkillRevisionView[]` | skill 版本列表 |
| POST | `/admin/skills` | ADMIN | 1B | `CreateSkillRevisionBody` | `SkillRevisionView` | 上传新版本 |
| POST | `/admin/skills/:name/enable` | ADMIN | 1C | `{ version }` | `{ ok }` | 启用某版本 |
| POST | `/admin/skills/:name/disable` | ADMIN | 1C | — | `{ ok }` | 禁用 |

## B.13 管理端 · 仪表盘（Phase 5 完善数据）

| Method | Path | 权限 | Phase | Body | Resp | 说明 |
|---|---|---|---|---|---|---|
| GET | `/admin/dashboard` | ADMIN | 0(骨架)/5(数据) | — | `DashboardStats` | 仪表盘（Phase 0 返回零值） |

---

## B.14 SSE 事件格式（Mode 2）

`POST /insight/sessions` 和 `GET /insight/sessions/:id/stream` 返回 SSE 流，每个事件：

```
event: step
data: {"type":"step","stepNo":1,"role":"ASSISTANT","content":"我需要先查...","tokens":120}

event: tool_call
data: {"type":"tool_call","stepNo":2,"toolName":"collect","toolArgs":{"sourceCode":"rss-solidot"}}

event: tool_result
data: {"type":"tool_result","stepNo":2,"toolName":"collect","toolResult":{"items":[...],"count":15}}

event: final
data: {"type":"final","sessionId":42,"status":"SUCCESS","reportMarkdown":"...","usedTokens":5800}

event: error
data: {"type":"error","stepNo":5,"content":"budget exceeded","status":"ABORTED"}
```

`Content-Type: text/event-stream`，每事件间空行分隔。
