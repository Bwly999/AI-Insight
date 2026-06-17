# 03 · Monorepo 结构

## 3.1 仓库结构

```
ai-insight/
├── apps/
│   ├── user/              # 用户端 Vue3 SPA（编辑风，复刻原型视觉）
│   ├── admin/             # 管理端 Vue3 SPA（深色控制台风）
│   └── server/            # Fastify 后端
├── packages/
│   ├── shared-types/      # 前后端共享：DTO/枚举/SPI 接口契约（TS 类型 + zod）
│   ├── shared-ui/         # 复用 UI（编辑风设计系统 token/组件）
│   └── shared-config/     # tsconfig / eslint / tailwind / drizzle preset
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

> 现有 `v2-editorial.html` 作为 `apps/user` 视觉基线保留；其设计 token 迁移到 `shared-ui`。

## 3.2 技术栈

### Monorepo 工具
- **pnpm workspaces**：包管理与依赖提升。
- **turborepo**：按依赖拓扑编排 lint / typecheck / build / dev。

### 前端（apps/user、apps/admin）
- Vue 3 `<script setup>` + TypeScript
- Vite（构建与开发服务器）
- Pinia（状态管理）
- Vue Router（路由）
- Tailwind CSS（样式，与原型一致）
- axios（HTTP，请求拦截器注入 Bearer token）

### 后端（apps/server）
- Fastify + TypeScript
- Drizzle ORM (`drizzle-orm/mysql-core`) + `drizzle-kit`（schema 与迁移）
- BullMQ（基于 Redis 的任务队列）
- node-cron / 调度插件（cron 触发）
- `jose`（JWT 解包）
- `undici` / `got`（HTTP 客户端，带自定义代理）
- Vercel AI SDK（LLM 调用）

### 共享（packages）
- **shared-types**：TS 类型 + zod schema，前后端共享 DTO、枚举、SPI 接口契约。
- **shared-ui**：编辑风设计系统（CSS 变量 token、基础组件）。
- **shared-config**：tsconfig / eslint / tailwind / drizzle 配置预设。

### 校验
- zod：端到端类型 + 运行时校验（请求参数、AI 结构化输出）。

## 3.3 包依赖关系

```
shared-config ←── 所有包
shared-types  ←── apps/user, apps/admin, apps/server
shared-ui     ←── apps/user, apps/admin
```

- 前后端通过 `shared-types` 共享类型与接口，避免手写重复类型导致漂移。
- 前端两端通过 `shared-ui` 共享设计系统。

## 3.4 脚本约定

根目录 `package.json` 提供 turbo 编排脚本：

```jsonc
{
  "scripts": {
    "dev":      "turbo run dev",
    "build":    "turbo run build",
    "lint":     "turbo run lint",
    "typecheck":"turbo run typecheck",
    "db:push":  "turbo run db:push --filter=@ai-insight/server",
    "db:gen":   "turbo run db:gen --filter=@ai-insight/server"
  }
}
```

## 3.5 命名约定

- npm scope：`@ai-insight/*`（如 `@ai-insight/server`、`@ai-insight/shared-types`）。
- 包目录名与 scope 后缀一致。
