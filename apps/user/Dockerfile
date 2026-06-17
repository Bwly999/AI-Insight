# syntax=docker/dockerfile:1
# AI Insight 用户端镜像：构建 Vue3 SPA → Nginx 托管 + 反代 /api
# 见 doc/design-doc/08-前端架构.md §8.5、09-基础设施与部署.md §9.1。
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json turbo.json ./
COPY apps/user/package.json ./apps/user/package.json
COPY apps/admin/package.json ./apps/admin/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/shared-ui/package.json ./packages/shared-ui/package.json
COPY packages/shared-config/package.json ./packages/shared-config/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @ai-insight/user...

FROM deps AS build
COPY packages/ ./packages/
COPY apps/user/ ./apps/user/
RUN pnpm --filter @ai-insight/user run build

FROM nginx:1.27-alpine AS runtime
COPY apps/user/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/user/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
