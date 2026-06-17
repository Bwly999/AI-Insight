# syntax=docker/dockerfile:1
# AI Insight 后端镜像（多阶段：install → build → runtime）
# 上下文为仓库根（见 docker-compose.yml 的 context: .）
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# ---- 依赖层（利用 pnpm 缓存） ----
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json turbo.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/shared-config/package.json ./packages/shared-config/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @ai-insight/server... --filter @ai-insight/shared-types

# ---- 源码 + 构建 ----
FROM deps AS build
COPY packages/ ./packages/
COPY apps/server/ ./apps/server/
RUN pnpm --filter @ai-insight/server... run build

# ---- 运行时 ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /repo/packages ./packages
COPY --from=build /repo/apps/server/dist ./apps/server/dist
COPY --from=build /repo/apps/server/drizzle.config.ts ./apps/server/drizzle.config.ts
COPY --from=build /repo/apps/server/package.json ./apps/server/package.json
COPY --from=build /repo/apps/server/drizzle ./apps/server/drizzle
WORKDIR /app/apps/server
EXPOSE 3000
# 启动前尝试应用迁移（迁移目录随构建带入）
CMD ["sh", "-c", "node dist/main.js"]
