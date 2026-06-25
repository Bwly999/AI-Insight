# AI-Insight 用户端 MVP 闭环 — 实现进度

> 目标：可运行 + 实跑一次「AI 编程工具赛道」洞察（对话发起 → Agent 调数据源 → 流式 SSE → 生成并查看 EditorialReport）。

## ✅ 全部完成（7 阶段，端到端验收通过）

### Phase 0 · 仓库骨架 + 工具链 ✅
- [x] pnpm@9(corepack) workspace + turbo + 6 packages
- [x] shared-types：领域 DTO/枚举
- commit: `chore: monorepo 骨架`

### Phase 1 · 数据源层 ✅
- [x] 核心: normalizeUrl/dedupeItems(移植 union-search) + 时间范围 + 统一 HTTP(undici 全局代理)
- [x] 搜索: DuckDuckGo(cheerio) / Exa(raw fetch) / Firecrawl(SDK) + 扇出聚合
- [x] 爬虫: hackernews/github-trending-today/weibo/zhihu/sspai/tencent-hot（移植 newsnow）
- [x] 提取链: Jina→Firecrawl→本地降级
- [x] 单测 20 个全绿；HN live smoke 验证实抓通过
- commit: `feat(datasources)`

### Phase 2 · 持久化 + 后端骨架 ✅
- [x] Drizzle schema + better-sqlite3(WAL+FTS5) + 运行时幂等 seed(9 数据源)
- [x] Fastify + CORS + auth SPI(DevTokenVerifier) + 统一错误
- [x] REST 路由全量（auth/conversations/messages/runs SSE/reports/datasources/schedules）
- commit: `feat(server)`

### Phase 3 · Agent + Runner + SSE ✅（ADR-0003 spike 通过）
- [x] DeepSeek OpenAI 兼容 provider 注册 + DefaultResourceLoader 全 no* + noTools:builtin
- [x] 6 customTools(defineTool+TypeBox) + 事件桥接(Pi AgentEvent→DTO, .delta 字段)
- [x] Runner 并发≤3 + EventEmitter(runId) → SSE 透传
- [x] spike 验证: DeepSeek deepseek-v4-flash 实跑，546 text_delta + 31 thinking_delta
- commit: `feat(agent+runner)`

### Phase 4 · 报告渲染 ✅
- [x] EditorialReport 模板（报头/drop-cap 导语/正文/供稿行）+ 设计 tokens 单一来源
- [x] 服务端 standalone HTML（@vue/server-renderer renderToString + 内联 CSS + 字体）
- commit: `feat(report)`

### Phase 5 · 用户端前端 ✅
- [x] Vite6 + Tailwind v4 + Vue Router + Pinia；/api 走 vite proxy
- [x] api-client: REST + SSE(EventSource) + TokenProvider
- [x] useInsightRun（SSE→响应式: text/thinking/toolCalls/report/elapsed, 自动重连+abort）
- [x] ConversationView 三栏工作台（忠实还原 prototype v2）+ composer(时间窗/标签/Lens)
- [x] ReportsView + ReportView（editorial/markdown 切换 + 下载 HTML）
- commit: `feat(web)`

### Phase 6 · 联调 + 实跑验收 ✅
- [x] 端到端实跑「AI 编程工具赛道」洞察：120s 完成，生成报告
- [x] 报告含真实当周数据（2026.06.17-06.24，GitHub Stars/开发者数引用）
- [x] standalone HTML editorial 版式 OK；vite dev → api proxy OK
- [x] Playwright 视觉验证：三栏工作台渲染正确
- commit: `feat: 端到端联调 + 实跑验收通过`

## 原范围外 stub — 已于 Phase A–D 补齐
管理端 ✅(D) · RSS 后台轮询建索引 ✅(C) · Schedule 定时触发 ✅(B) · 代理设置 UI / JWT prod ✅(D) · PDF 导出（v1 显式不做，见 CONTEXT.md）

## 分阶段闭环（补齐至设计文档完整愿景，每阶段验收通过才进下一阶段）

### Phase A · 验收 + 调试现有 MVP ✅
- [x] 基线：typecheck/build/test 全绿（33 测试：datasources 20 + agent 4 + server 9）
- [x] 修 durationMs 计时（event-bridge 闭包级 Map；18 个 tool_call_end 全 >0）
- [x] 会话软删（conversations.deleted_at + repo.softDeleteConversation + 路由 204/404）
- [x] tokens 持久化（executor 读 session.getSessionStats()；实跑 186066）
- [x] run_items 持久化（新表 + repo.recordRunItems/listRunItems；实跑 39 条，toolName 正确）
- [x] 清理 runner/conversations 过期 "Phase 3" 注释 + defaultExecutor
- [x] 加 vitest：server(repo+runner)/agent(tools) 测试 + resetDbForTest + :memory: 修复
- [x] 实跑验收：DeepSeek 端到端 → run_completed + report_created（"AI Coding Tools Weekly Deep Dive 2026.06.18-25"）

### Phase B · Schedules 全栈 ✅
- [x] jobs/scheduler.ts（node-cron 每分扫到期 → 新建会话+user msg+run → enqueue → 更新 lastRunAt/nextRunAt）
- [x] routes/schedules.ts 校验 cron + 算 nextRunAt + 通知 change-listener
- [x] repo listEnabledSchedules/updateScheduleRunTimes/toScheduleDto/getSchedule
- [x] api-client schedule 端点 + web SchedulesView + /schedules 路由 + 侧栏入口
- [x] **调试修复**：session-factory 单例缓存 → 每 run 独立 session（修并发「already processing」+ 工具错绑 bug，影响核心流程）
- [x] 验收：cron */1 触发，3 次 schedule-fired run 全 completed + 各自报告；并发手动 run 亦 completed；enabled=false 停触发；DELETE 204

### Phase C · RSS 后台轮询 + FTS5 索引 ✅
- [x] db initSchema 加 FTS5 external-content 同步触发器（INSERT/UPDATE/DELETE）
- [x] jobs/rss-poller.ts（*/30 拉 enabled feed → upsert data_source_items，90 天保留，setRssPollCron）
- [x] repo upsertDataSourceItems/searchDataSourceItemsFts(MATCH 参数绑定+引号防注入)/deleteStaleItems
- [x] main.ts 启动 poller；datasources 路由 create/enable 即时 pollOneFeed
- [x] agent rssTool 改调 ctx.searchRssIndex；executor 注入（FTS 优先+即时 fetch 回退写回索引）
- [x] FTS 往返测试（upsert→命中/更新→重匹配/删除→不命中）
- [x] 验收：HN feed 即时首拉 20 条入索引，FTS MATCH "AI" 命中 5 条；禁用后缓存仍服务；DELETE 204

### Phase D · Admin 管理端 ✅
- [x] routes/admin.ts（[authenticate,requireAdmin]；/admin/runs、/admin/schedules、/admin/settings GET+PUT）
- [x] runtime-config.ts（getProviderConfig/getProxyUrl/getRssPollCron 读 settings 表+env 兜底）+ repo settings/listAllRuns + auth.ts ProdTokenVerifier(jose HS256)
- [x] executor ExecutorDeps.provider→getProvider 惰性读（每 run 独立 session，热切换自然生效）
- [x] main 注册 admin 路由 + 启动应用 DB settings；app.ts CORS 加 5174；加 jose 依赖
- [x] 新建 apps/admin（vite 5174，admin 角色登录）+ AdminRunsView/AdminSettingsView；api-client 加 listAllRuns/listAllSchedules/getSettings/updateSettings
- [x] auth.test.ts（jose 签发/篡改/错 secret/错 issuer 全覆盖，6 测试）
- [x] 验收：admin 200 / user 403；13 runs；PUT rssCadence 持久化+重排；admin app 起服务+proxy /api；ProdTokenVerifier 拒篡改

## 如何运行
```bash
pnpm install          # corepack 自动用 pnpm@9
# 后端（:3000）
pnpm --filter @ai-insight/server dev
# 用户端（:5173，另一终端）
pnpm --filter @ai-insight/web dev
# 管理端（:5174，第三终端；5174 被占则 vite 自动换端口）
pnpm --filter @ai-insight/admin dev
# 验收：pnpm -r typecheck && pnpm -r test && pnpm build（8 包 typecheck / 40 测试 / 8 build 任务全绿）
```

## 整体验收（Phase A–D 全部完成）
- **A 验收+调试**：durationMs 计时（18 tool_call_end 全>0）、会话软删（204/404）、tokens 持久化（实跑 186066）、run_items（39 条）、过期注释清理、server/agent 测试（vitest）。端到端实跑 DeepSeek → run_completed + report_created。
- **B Schedules 全栈**：jobs/scheduler（node-cron 每 fire 新建会话+run+enqueue+更新 lastRunAt/nextRunAt）、cron 校验、web SchedulesView。**调试修复**：session-factory 单例缓存→每 run 独立 session（修并发「already processing」+ 工具错绑 bug，3 次 schedule-fired run 全 completed）。
- **C RSS 轮询+FTS5**：external-content 同步触发器、jobs/rss-poller（*/30 + 90 天保留 + 即时首拉）、FTS5 MATCH 参数绑定防注入、rssTool 走 ctx.searchRssIndex（FTS 优先+即时 fetch 回退写回）。HN feed 20 条入索引，FTS MATCH 命中。
- **D Admin 管理端**：admin 路由（requireAdmin 403 普通用户）、runtime-config（settings 表热切换：proxy 即时/llm 下次 run/rss 重排）、ProdTokenVerifier（jose HS256 真验签）、apps/admin（AdminRunsView/AdminSettingsView）。apiKey env-only。
- **全量绿**：typecheck 8 包、test 40 个（datasources 20 + agent 4 + server 16）、build 8 任务。
- 管理端/定时/轮询/代理 UI/JWT prod 均已补齐；PDF 导出为 v1 显式不做（CONTEXT.md）。
