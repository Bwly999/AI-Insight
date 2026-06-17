# AI Insight · The Insight Review

> 你的 AI 周刊 —— 把 AI 洞察包装成一份严肃优雅的纸质周刊。
> 内网私有部署；从数据源/搜索引擎定时采集 → AI 处理成深度中文报告 → 按订阅偏好个性化裁剪推送。

本仓库为 **Phase 0 · 架构骨架**：全链路可启动，无业务逻辑。完整设计见 [`doc/design-doc/`](./doc/design-doc/README.md)。

---

## 仓库结构

```
AI-Insight/
├── apps/
│   ├── server/            # Fastify + TS + Drizzle + BullMQ 后端
│   │   ├── src/
│   │   │   ├── db/schema.ts        # 12 张表（见 06-数据模型）
│   │   │   ├── plugins/            # auth/db/queue/http-client/llm/collectors/notifiers/scheduler
│   │   │   ├── routes/             # /health /auth/me /admin/*（守卫骨架）
│   │   │   └── main.ts
│   │   ├── drizzle.config.ts
│   │   └── Dockerfile
│   ├── user/             # 用户端 Vue3 SPA（编辑风，复刻 v2-editorial.html）
│   └── admin/            # 管理端 Vue3 SPA（深色控制台）
├── packages/
│   ├── shared-types/     # SPI 接口 + DTO + 枚举（前后端单一事实来源）
│   ├── shared-ui/        # 设计 token + 字体 + 工具类（用户端 + 管理端反相）
│   └── shared-config/    # tsconfig 预设
├── doc/design-doc/       # 16 篇设计文档（含 UI/UX）
├── v2-editorial.html     # 用户端视觉基线原型
├── docker-compose.yml    # mysql + redis + server + user + admin
├── pnpm-workspace.yaml
├── turbo.json
└── .env.example
```

## 技术栈

- **Monorepo**：pnpm workspaces + turborepo
- **后端**：Fastify + TypeScript + Drizzle ORM (MySQL) + BullMQ (Redis) + Vercel AI SDK + jose
- **前端**：Vue 3 `<script setup>` + TS + Vite + Pinia + Vue Router + Tailwind + axios
- **SPI**：`ICollector`（采集）/ `INotificationChannel`（推送）/ LLM（AI SDK，非自研）

## 快速开始

### 0. 前置
- Node ≥ 20、pnpm ≥ 9（仓库已声明 `packageManager`，corepack 会自动启用）
- Docker（用于一键编排）或本地 MySQL 8 + Redis 7

### 1. 安装
```bash
pnpm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 至少填 JWT_SECRET（见 doc/design-doc/14-留白与后续确认.md）
```

### 3. 开发模式（本地 MySQL/Redis）
```bash
# 终端 A：后端（tsx watch）
pnpm dev --filter @ai-insight/server

# 终端 B：用户端
pnpm dev --filter @ai-insight/user     # http://localhost:5173

# 终端 C：管理端
pnpm dev --filter @ai-insight/admin    # http://localhost:5174
```

### 4. 数据库迁移
```bash
pnpm db:gen        # 由 schema 生成迁移（drizzle-kit generate）
pnpm db:migrate    # 应用最新迁移到 MySQL（apps/server/scripts/apply-migration.mjs）
```

> `pnpm db:migrate` 直接应用 `drizzle/` 下最新 `*.sql`，自动处理 `statement-breakpoint`
> 标记与 MySQL 8.0.x 的 `explicit_defaults_for_timestamp` 严格模式兼容。
> （`pnpm db:push` 在 MySQL 8.0.28 上因 drizzle-kit #1451 报错，故用 migrate。）

### 5. 一键编排（Docker）
```bash
docker compose up -d --build
# 用户端 http://localhost:8080  管理端 http://localhost:8081  API http://localhost:3000
```

## 验收

Phase 0 验收项 A1–A10 见 [`doc/design-doc/13-验收标准.md`](./doc/design-doc/13-验收标准.md)。

骨架验证（带 dev token，见 `POST /auth/dev-token`）：
```bash
# 健康检查
curl http://localhost:3000/health

# 鉴权骨架（需 .env 配 JWT_SECRET，开发降级模式见 auth.ts）
TOKEN=$(curl -s -X POST http://localhost:3000/auth/dev-token \
  -H 'Content-Type: application/json' \
  -d '{"externalId":"admin@x","name":"Admin","role":"ADMIN"}' | jq -r .token)

curl http://localhost:3000/auth/me      -H "Authorization: Bearer $TOKEN"   # 200
curl http://localhost:3000/admin        -H "Authorization: Bearer $TOKEN"   # 200（ADMIN）
```

## 留白（使用方填）

见 [`doc/design-doc/14-留白与后续确认.md`](./doc/design-doc/14-留白与后续确认.md)：
- JWT 密钥来源 / 声明字段路径（`apps/server/src/plugins/auth.ts` 的 `mapClaims`）
- 内网 LLM baseURL / 模型名（`.env` 的 `LLM_*`）
- HTTP 代理（Phase 1 管理端配置）
- 首批数据源 / 初始 ReportSchedule

## 扩展点（内网接入，不改核心代码）

- **采集器**：`fastify.registerCollector(type, impl)` —— 见 [05-可插拔SPI §5.1](./doc/design-doc/05-可插拔SPI设计.md)
- **推送通道**：`fastify.registerNotifier(channel, impl)` —— 见 [05-可插拔SPI §5.2](./doc/design-doc/05-可插拔SPI设计.md)
- **LLM**：改 `.env` 的 `LLM_BASE_URL` —— 见 [05-可插拔SPI §5.3](./doc/design-doc/05-可插拔SPI设计.md)

## 路线图

| Phase | 目标 | 状态 |
|---|---|---|
| 0 | 架构骨架 | ✅ 本仓库当前 |
| 1 | 采集闭环 | ⏳ |
| 2 | AI 处理 | ⏳ |
| 3 | 报告 + 用户端 | ⏳ |
| 4 | 推送闭环 | ⏳ |
| 5 | 加固 | ⏳ |

详见 [`doc/design-doc/12-分阶段路线图.md`](./doc/design-doc/12-分阶段路线图.md)。
