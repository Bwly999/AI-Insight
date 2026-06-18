# AI Insight · 项目进度

> 最后更新：2026-06-18
> 状态：Phase 1A ✅ · 1B ✅ · 1C ✅ · 2 ✅ · 3 🏗️ · 4 ❌ · 5 ❌

---

## Phase 0 · 架构骨架（已完成）

- [x] Monorepo 结构 + Turborepo
- [x] Fastify 插件体系（db / queue / http-client / llm / collectors / notifiers / auth / scheduler）
- [x] Drizzle 12 张表（users / categories / sources / collect_logs / raw_items / articles / report_schedules / subscriptions / reports / report_items / notification_logs / feedback）
- [x] 管理端路由守卫骨架 + 健康检查
- [x] Admin / User 前端脚手架（Vue + Tailwind + Pinia）
- [x] shared-types / shared-ui / shared-config 三个包

---

## Phase 1A · 数据源基座（✅ 已完成 — 9 commits）

### 后端
- [x] CryptoUtil: AES-256-GCM apiKey 加解密
- [x] Fingerprint: URL 归一化 + sha256 去重
- [x] Field-map: JSON 路径提取 + 字段映射
- [x] **RssCollector**: rss-parser + undici（走代理）
- [x] **SearchApiCollector**: list/query 双模式 + apiKey 解密
- [x] **SearchCrawlCollector**: cheerio HTML 解析
- [x] **WebScraperCollector**: Phase 2 占位
- [x] http-client 升级: ProxyAgent + rebuildHttpAgent()
- [x] Scheduler 重写: cron 包驱动 + collect/process 全局 cron
- [x] Collection Worker: 采集 → 指纹 → 去重 → raw_items
- [x] system_config 表（KV 存 proxy/cron 配置）
- [x] 12 条源种子（RSS / SEARCH_CRAWL / SEARCH_API）
- [x] 管理端路由: sources CRUD + 试采 + collect 触发 + 采集日志
- [x] 管理端路由: proxy 配置 + cron 配置

### 前端
- [x] SourcesView: 列表 + CRUD 弹窗 + type-specific 表单
- [x] CollectLogsView: 筛选 + 状态指示
- [x] ProxyView: 代理配置表单 + 连通测试
- [x] CronView: collect/process 表达式编辑 + 下次运行预览

---

## Phase 1B · Mode 2 雏形（✅ 已完成）

### 共享层
- [x] enums: InsightStatus / AgentStepRole / AgentToolName
- [x] DTO: CreateInsightSessionBody / InsightSessionView / AgentStepView / AgentToolCallView / SkillRevisionView / VaultEntryView
- [x] SPI: IAgentRuntime / AgentStepEvent / SessionBudget

### 后端
- [x] 5 张新表: insight_sessions / agent_steps / agent_tool_calls / skill_revisions / vault_entries
- [x] **AiSdkRuntime**: Vercel AI SDK 自写循环（Pi SDK 兜底）
- [x] **4 个受控工具**: collect / search / queryArticles / finalize
- [x] **BudgetGuard**: token/步数/工具调用次数硬限
- [x] **Orchestrator**: session 生命周期 + trace 持久化
- [x] Skill-loader: DB 读取 enabled skill
- [x] SSE 用户路由: POST /insight/sessions（SSE 流）+ 断线重连
- [x] 管理端路由: session 列表 + trace 回放
- [x] 默认 skill: lens-deep-insight.md

### 前端
- [x] InsightSessionsView: 会话列表
- [x] InsightTraceView: 时间线回放 + 工具调用展示
- [x] InsightView（用户端）: 输入框 + SSE 展示 + 报告渲染

---

## Phase 1C · Mode 2 完善（✅ 已完成）

- [x] **extract 工具**: @mozilla/readability 正文抓取
- [x] **vaultRead / vaultWrite 工具**: 跨 session 沉淀
- [x] extension.ts: 7 工具全部注册 + vaultWrite 需 skill 声明
- [x] BudgetGuard: remaining() / snapshot() / isNearLimit()
- [x] 4 个新 skill: flash-brief / dual-take / timeline-trace / watch-shape
- [x] 管理端 skill routes: CRUD + enable/disable（事务）
- [x] SkillsView: 上传 + 启用/禁用
- [x] InsightAuditView: 统计卡 + 会话表
- [x] to-subscription 路由: 洞察 → Mode 1 订阅

---

## Phase 2 · AI 处理（✅ 已完成）

- [x] **5 阶段 pipeline**: dedupe → classify → summarize → score-heat → comment
- [x] **Processing Worker**: BullMQ + LLM 调用
- [x] LLM ping 路由（验收 C1）
- [x] admin articles 路由: 列表 + 纠错
- [x] admin process 路由: 触发/状态/重跑
- [x] ArticlesView: 编辑弹窗（summary/heat/critical/tags）
- [x] ProcessMonitorView: 状态卡 + 触发按钮

---

## Phase 3 · 报告与用户端（🏗️ **进行中**）

### 后端 ✅ 已完成
- [x] **Report Builder**: 裁剪组装（时间窗/category/keywords 过滤/分区）
- [x] **Report Worker**: BullMQ + 幂等
- [x] 用户端路由: reports/current / reports / reports/:id
- [x] 用户端路由: subscriptions GET/PUT / categories / feedback

### 前端 ⏳ 待完成
- [ ] HomeView: 本期报告（编辑风排版）
- [ ] ArchiveView: 往期报告列表
- [ ] ReportDetailView: 报告详情
- [ ] SettingsView: 订阅设置表单
- [ ] FeedbackView: 反馈/收藏

---

## Phase 4 · 推送闭环（🏗️ **进行中**）

### 后端 ✅ 已完成
- [x] **Delivery Service**: 多通道推送 + 幂等 + notification_logs
- [x] **Delivery Worker**: BullMQ 重试
- [x] 管理端路由: channels 列表 / 通知日志 / 重推

### 前端 ❌ 待完成
- [ ] ChannelsView: 通道管理
- [ ] NotificationLogsView: 推送日志列表
- [ ] 管理端 Nav 更新

---

## Phase 5 · 加固（❌ **未开始**）

### 后端 ⏳ 部分完成
- [x] @fastify/rate-limit 已注册（全局 200/分钟）
- [ ] 限流精细化（insight session 每用户每小时 5 次）

### 待完成
- [ ] 配置隔离审计（F3）
- [ ] 错误告警（worker 失败通知管理员）
- [ ] 数据保留策略（raw_items / collect_logs 定期清理）
- [ ] 用户管理路由（列表/改角色）
- [ ] 可观测面板（队列深度 / token 用量 / 成功率）
- [ ] 内网扩展文档
- [ ] Docker Compose 生产配置完善

---

## Git 提交记录（当前 9 Phase commits + 3 初始）

```
8db461d feat: Phase 1C extract vault tools skills skill admin audit
8904f1f feat: Phase 1B.3 skill SSE routes admin insight pages
68f06de feat(server): Phase 1B.2 AiSdkRuntime tools orchestrator budget guard
a992f86 feat: Phase 1B.1 shared-types DTO enums + 5 new schema tables
c09d4a2 feat(admin): Phase 1A.5 admin frontend pages sources proxy cron logs
ff2fa39 feat(server): Phase 1A.4 system_config table source seed admin routes
77a8e78 feat(server): Phase 1A.3 http-client proxy scheduler rewrite + collection worker
0a8e3a2 feat(server): Phase 1A.2 4 real collectors + registration
bcae211 feat(server): Phase 1A.1 crypto util fingerprint field-map + vitest
292d6e8 feat: Phase 2 AI processing pipeline + article admin
```

---

## 快速启动

```bash
# 后端开发
cd apps/server && cp .env.example .env
pnpm --filter @ai-insight/server dev

# 管理前端
pnpm --filter @ai-insight/admin dev

# 用户前端
pnpm --filter @ai-insight/user dev

# 初始化数据
node apps/server/scripts/seed-sources.mjs
node apps/server/scripts/seed-skills.mjs
```

## 测试

```bash
pnpm --filter @ai-insight/server test
# 当前: 25 tests passing (4 suites)
```
