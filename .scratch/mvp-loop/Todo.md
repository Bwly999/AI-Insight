# AI-Insight 用户端 MVP 闭环 — 实现进度

> 目标：可运行 + 实跑一次「AI 编程工具赛道」洞察（对话发起 → Agent 调数据源 → 流式 SSE → 生成并查看 EditorialReport）。
> 每阶段完成即 commit。

## Phase 0 · 仓库骨架 + 工具链
- [ ] pnpm-workspace.yaml + turbo.json + 根 package.json
- [ ] 6 个 package/app 的 package.json + tsconfig
- [ ] 根 .gitignore / .env 加载约定 / 根 README
- [ ] packages/shared-types：DTO/枚举（TimeRange, Lens, DataSourceType, Conversation/Message/InsightRun/Report/DataSourceItem）
- [ ] **commit**

## Phase 1 · 数据源层（packages/datasources）
- [ ] 统一接口：DataSourceItem 归一化 + normalizeUrl + dedupe + 时间范围过滤 + 统一 HTTP 客户端
- [ ] 搜索：DuckDuckGo (cheerio) / Exa (raw fetch) / Firecrawl (SDK)
- [ ] 扇出 + 去重聚合
- [ ] 爬虫：hackernews / github-trending-today / weibo / zhihu / sspai / tencent-hot（移植 newsnow）
- [ ] 正文提取：Jina → Firecrawl → 本地降级
- [ ] 单测：URL 规范化 / 去重 / 时间过滤
- [ ] **commit**

## Phase 2 · 持久化 + 后端骨架（apps/server）
- [ ] Drizzle schema (better-sqlite3 + WAL + FTS5) + 迁移 + seed
- [ ] Fastify：config/env + auth SPI(DevTokenVerifier) + error/proxy 插件
- [ ] REST 路由：auth/conversations/messages/runs/reports/schedules/datasources
- [ ] **commit**

## Phase 3 · Agent + Runner + SSE（packages/agent + apps/server）
- [ ] 注册 DeepSeek OpenAI 兼容 provider + INSIGHT_SYSTEM_PROMPT + DefaultResourceLoader 全空 override
- [ ] 6 customTools：search/fetch_rss/crawl/extract_content/list_datasources/save_report
- [ ] Runner（并发≤3 + 内存队列）+ EventEmitter(runId) → SSE 透传
- [ ] SSE 端点 GET /api/runs/:id/stream + POST /api/runs/:id/abort
- [ ] Spike：headless 跑通一次
- [ ] **commit**

## Phase 4 · 报告渲染（packages/shared-ui + server）
- [ ] EditorialReport.vue + 子组件（基于 ref/v2-editorial.html）
- [ ] 服务端 standalone HTML 渲染（@vue/server-renderer + 内联 CSS）
- [ ] save_report 产出 markdown + standalone HTML
- [ ] **commit**

## Phase 5 · 用户端前端（apps/web）
- [ ] ConversationView 三栏编排 + 子组件（忠实还原 prototype v2）
- [ ] useInsightRun SSE 订阅 → 响应式状态
- [ ] /reports/:id 报告查看页
- [ ] useConversations / useAuth
- [ ] **commit**

## Phase 6 · 联调 + 实跑验收
- [ ] apps/api-client 封装 REST + SSE + TokenProvider
- [ ] 端到端实跑「AI 编程工具赛道」洞察
- [ ] 修复联调问题 + dev 启动脚本
- [ ] **commit**

## 范围外（留 stub/最小）
管理端 · RSS 后台轮询建索引 · Schedule 定时触发 · 代理设置 UI / JWT prod · PDF 导出
