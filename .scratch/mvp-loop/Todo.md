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

## 范围外（留 stub/最小，未做）
管理端 · RSS 后台轮询建索引 · Schedule 定时触发 · 代理设置 UI / JWT prod · PDF 导出

## 如何运行
```bash
pnpm install          # corepack 自动用 pnpm@9
# 后端（:3000）
pnpm --filter @ai-insight/server dev
# 用户端（:5173，另一终端）
pnpm --filter @ai-insight/web dev
```
