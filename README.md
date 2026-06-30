# AI-Insight

「AI For 洞察」全栈系统 — 部署于公司内网，用于行业咨询。用户通过对话发起洞察，Agent 据意图调用数据源（搜索 / RSS / 爬虫）采集并综合，产出可分享的报告；支持把一次洞察固化为定时任务。

- 领域语言：[`CONTEXT.md`](./CONTEXT.md)
- 详细设计：[`docs/design/详细设计.md`](./docs/design/详细设计.md)
- 关键决策：[`docs/adr/`](./docs/adr/)
- 用户端原型：[`prototype/user-end-workstation-v2.html`](./prototype/user-end-workstation-v2.html)

## 架构（Monorepo · pnpm + turbo）

```
apps/
  web/        用户端 (Vue3 + Vite + TS + Tailwind v4)
  server/     后端 (Fastify 单进程 · API + Agent + cron)
packages/
  shared-types/   前后端共享 DTO / 枚举
  shared-ui/      Vue 设计系统 (EditorialReport 模板 + 基础组件)
  api-client/     REST + SSE + TokenProvider 封装
  agent/          Pi SDK 封装 + 洞察流编排 (仅 server 依赖)
  datasources/    搜索 / RSS / 爬虫 适配器 (仅 server 依赖)
```

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env.local   # 填入 LLM / 数据源 key

# 3. 初始化数据库
pnpm db:push && pnpm db:seed

# 4. 启动（后端 + 用户端）
pnpm dev
#   后端  http://localhost:4000
#   用户端 http://localhost:5173
```

## 当前范围（MVP 闭环）

✅ 用户端：对话发起洞察 → Agent 调数据源 → 流式回传 → 报告查看
✅ 数据源：搜索(DDG/Exa/Firecrawl) + 爬虫(HN/GitHub/微博/知乎/少数派/腾讯) + 正文提取
✅ 报告：markdown + 独立 HTML 网页版本（EditorialReport）
✅ 管理端：运行监控 / 定时任务 / 数据源 / 设置（含代理连通性测试）
✅ RSS 后台轮询建索引（FTS5）· Schedule 定时触发 · 代理热切换

🚧 范围外（留 stub/最小）：PDF 导出
