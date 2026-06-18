# 附录 C · 验收矩阵

> 每个验收点配「检查方式」（手动/SQL/脚本/页面操作）+「验证命令」。施工完成每个任务卡后查对应行自测；Phase 完成后跑整组。

---

## C.A — Phase 0 架构骨架（已完成，留作回归）

| 编号 | 检查项 | 检查方式 | 验证命令 / 步骤 |
|---|---|---|---|
| A1 | 仓库结构 | 目录检查 | `ls apps/{user,admin,server} packages/{shared-types,shared-ui,shared-config} pnpm-workspace.yaml turbo.json` 全部存在 |
| A2 | 依赖安装 | 命令 | `corepack pnpm install` 无报错（干净 node_modules） |
| A3 | 构建编排 | 命令 | `corepack pnpm build && corepack pnpm typecheck` 全绿 |
| A4 | 后端启动 | HTTP | `curl http://localhost:3000/health` → 200，body 含 8 插件 true |
| A5 | 数据库 | SQL | `SHOW TABLES` 含 12 表；`SHOW CREATE TABLE raw_items` 见 FK + unique |
| A6 | 前端启动 | HTTP | `curl http://localhost:5175` 和 `:5176` → 200，含 tailwind 样式 |
| A7 | 编排 | docker | `docker-compose up -d` 后 `docker-compose ps` 全 healthy；`curl /api/health` 经 nginx → 200 |
| A8 | 类型共享 | 编译 | server 与前端均能 `import { ICollector } from '@ai-insight/shared-types'` 无类型错 |
| A9 | 认证骨架 | HTTP | 带 dev-token 调 `/auth/me` → 200 + `{id,name,role}`；不带 → 401 |
| A10 | 守卫骨架 | HTTP | USER token 调 `/admin` → 403；ADMIN token → 200 |

---

## C.B — Phase 1A 采集闭环（1A 任务卡）

| 编号 | 检查项 | 检查方式 | 验证命令 / 步骤 |
|---|---|---|---|
| B1 | SPI 注册 | 单元测试 | 测 `registerCollector('RSS', x)` 后 `collectors.get('RSS') === x` |
| B2 | RSS 采集 | 端到端 | 建 RSS 源（feedUrl=`https://www.solidot.org/index.rss`）→ `POST /admin/collect/run` → `SELECT COUNT(*) FROM raw_items WHERE source_id=...` 增加 → `collect_logs` 记 SUCCESS |
| B3 | 搜索 API 型 | 端到端 | 建 SEARCH_API(list) 源（如 wallstreetcn）→ 触发 → 入库成功 |
| B4 | 搜索爬虫型 | 端到端 | 建 SEARCH_CRAWL 源（如 ithome 选择器）→ 触发 → 入库成功 |
| B5 | 全局 cron | 观察 | 设 collect cron=`*/2 * * * *` → 等 2 分钟 → `collect_logs` 自动新增记录 |
| B6 | 去重 | SQL | 同源触发两次 → `SELECT fingerprint, COUNT(*) FROM raw_items WHERE source_id=X GROUP BY fingerprint HAVING COUNT>1` 应空 |
| B7 | 代理 | 抓包/日志 | 配代理 → `collect_logs` 含成功记录 + 代理服务端日志见请求；未配代理不崩 |
| B8 | 重试与日志 | 模拟失败 | 故意配错误 feedUrl → `collect_logs.error` 非空 + status=FAILED；BullMQ 重试 N 次后死信 |
| B9 | 管理端页面 | 页面操作 | admin 数据源/代理/cron 三页 CRUD + 手动触发 + 日志查看均可用 |
| B10 | Playwright 预留 | HTTP/单元 | `collectors.get('WEB_SCRAPER')` 存在；调 fetch 返回占位不抛错；package.json 含 playwright 依赖 |

---

## C.G — Phase 1B Mode 2 雏形（1B 任务卡）

| 编号 | 检查项 | 检查方式 | 验证命令 / 步骤 |
|---|---|---|---|
| G1 | session 启动 + SSE | 端到端 | `POST /insight/sessions` 带 intent → 收到 SSE 流，含 `event:step` 事件 |
| G2 | collect 工具命中采集器 | DB | trace 中 `agent_tool_calls` 有 `tool='COLLECT'` + `ok=true`，且对应 `raw_items` 新增 |
| G3 | 预算截断 | 端到端 | 设 budget `maxSteps=3` → session 跑 3 步后 status=ABORTED，`insight_sessions.error` 含 budget |
| G4 | trace 完整 | SQL | `SELECT COUNT(*) FROM agent_steps WHERE session_id=X` ≥ 1；`agent_tool_calls` 每次调用都有记录；管理端回放页可见 |
| G5 | 无危险工具 | 代码检查 | grep `extension.ts` 不含 `'bash'`/`'exec'`/`'fetch'`/`'edit'` 工具注册；仅 4 个白名单工具 |

---

## C.H — Phase 1C Mode 2 完善（1C 任务卡）

| 编号 | 检查项 | 检查方式 | 验证命令 / 步骤 |
|---|---|---|---|
| H1 | extract 工具 | 端到端 | session 中 Agent 调 extract → `agent_tool_calls` 有 `tool='EXTRACT'` + 返回正文 |
| H2 | vault 读写 | 端到端 | Agent 调 vaultWrite（需 skill frontmatter `vault_write:true`）→ `vault_entries` 新增；vaultRead 能查到 |
| H3 | watch-shape 转订阅 | 端到端 | session 完成后 `POST /insight/sessions/:id/to-subscription` → `subscriptions` 新增 |
| H4 | skill 版本管理 | 页面操作 | admin 上传新 skill 版本 → 启用 → 新 session 用新版本；旧版本保留 |
| H5 | 预算守卫 | 单元测试 | 测 `budget.ts`：模拟 tokens 超限 → 抛 `BudgetExceededError` |
| H6 | 审计面板 | 页面操作 | admin insight 列表：按状态/用户筛；trace 回放显示每步 token/工具调用/耗时 |

---

## C.C — Phase 2 AI 处理（02 任务卡）

| 编号 | 检查项 | 检查方式 | 验证命令 / 步骤 |
|---|---|---|---|
| C1 | LLM 连通 | 单元测试 | 测 `llm.chat`：`generateText` 返回非空 + `generateObject` 返回符合 schema |
| C2 | 五阶段产出 | SQL | 处理一批 raw_items → `SELECT category_code, summary, heat, critical, trend_comment, tags FROM articles WHERE raw_item_id IS NOT NULL` 字段齐全 |
| C3 | 中文输出 | SQL/人工 | `SELECT summary FROM articles LIMIT 5` 均为中文（即使源是英文 RSS） |
| C4 | 语义去重 | 构造测试 | 插两条标题不同但内容 95% 相似的 raw_items → 处理后 `articles` 只多 1 条 |
| C5 | 处理监控 | 页面操作 | admin 处理监控页：任务状态 + token 用量 + 失败重跑入口可用 |
| C6 | 事后纠错 | 页面操作 | admin 改某 article 的 heat/critical → `SELECT heat,critical FROM articles WHERE id=X` 持久化 |

---

## C.D — Phase 3 报告与用户端（03 任务卡）

| 编号 | 检查项 | 检查方式 | 验证命令 / 步骤 |
|---|---|---|---|
| D1 | 调度触发 | 端到端 | 建调度（cron 设近点）→ 到点 → `SELECT * FROM reports WHERE schedule_id=X` 为该 schedule 下所有 active 用户生成（status=READY） |
| D2 | 裁剪正确 | SQL | 用户 A 订阅领域=X → 其 report 的 `body_json` 仅含命中 X 的 articles |
| D3 | 头条 | SQL | `SELECT headline_json FROM reports WHERE user_id=A` = 该用户命中最高 heat（critical 优先） |
| D4 | 深度内容 | SQL/人工 | `body_json` 含 trendComment + 编辑荐语片段 |
| D5 | 用户端视觉 | 页面操作 | 用户端首页对照 `v2-editorial.html`：头版/统计卡/本周精选/供稿榜/档案布局一致 |
| D6 | 订阅设置 | 页面操作 | 用户勾领域+填关键词+选 schedule+设通道 → `PUT /subscriptions` → `SELECT * FROM subscriptions WHERE user_id=A` 生效 |
| D7 | 往期浏览 | 页面操作 | `/archive` 列出历史 reports；`/reports/:id` 显示详情 |
| D8 | 反馈收藏 | 端到端 | 用户标 USEFUL → `SELECT * FROM feedback WHERE user_id=A AND article_id=X` 存在；`/feedback` 可查 |

---

## C.E — Phase 4 推送闭环（04 任务卡）

| 编号 | 检查项 | 检查方式 | 验证命令 / 步骤 |
|---|---|---|---|
| E1 | SPI 注册 | 单元测试 | `registerNotifier('CONSOLE', x)` 后 `notifiers.get('CONSOLE') === x` |
| E2 | Console 推送 | 端到端 | report 生成 → `notification_logs` 新增 status=SUCCESS + 控制台打印 payload |
| E3 | 通道偏好 | SQL | subscription.channels=`['CONSOLE']` → 只调 CONSOLE；`['EMAIL']` 但未注册 → 跳过且记日志 |
| E4 | 内网扩展性 | 单元测试 | 注册 `TestChannel` → delivery 调用它 + `notification_logs` 记录 |
| E5 | 失败重推 | 端到端 | 模拟通道失败 → `notification_logs.status=FAILED`；admin 重推 → status=SUCCESS |
| E6 | 幂等 | SQL | 同 report 同 channel 推两次 → `SELECT COUNT(*) FROM notification_logs WHERE report_id=X AND channel=Y` =1 |
| E7 | 通道管理页 | 页面操作 | admin 通道页：列已注册 + 配置 + 测试按钮返回结果 |

---

## C.F — 横切验收（贯穿各 Phase）

| 编号 | 检查项 | 检查方式 | 验证命令 / 步骤 |
|---|---|---|---|
| F1 | 类型一致 | 编译 | `grep -r "interface SourceView" apps/ packages/` 仅 shared-types 一处定义 |
| F2 | 权限 | HTTP | USER token 调任意 `/admin/*` → 403；匿名调 `/reports` → 401 |
| F3 | 配置隔离 | 代码检查 | grep 源码无明文密钥/密码（仅 env 引用）；DB schema 无 password 列明文 |
| F4 | 可观测 | 页面操作 | admin 仪表盘汇总采集/处理/推送日志 + 队列健康 |
| F5 | 幂等（= E6） | 见 E6 | — |
| F6 | 文档 | 文档检查 | README 含本地启动/docker/迁移/扩展点示例 |
| F7 | 测试 | 命令 | `corepack pnpm test`（Vitest）核心 SPI + worker 测试全绿 |

---

## 验收通过标准

每个 Phase 的验收组**全部 ✓** 才算该 Phase 完成。单条失败：
- 标 `✗` + 失败原因；
- 回到对应任务卡修复；
- 重跑该条 + 受影响的相关条目；
- 全绿后提交 commit，commit message 引用验收组（如 `feat(phase-1a): close B1-B10`）。
