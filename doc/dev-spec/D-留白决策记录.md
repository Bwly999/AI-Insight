# 附录 D · 留白决策记录

> 合并 `design-doc/14-留白与后续确认.md` 的留白项 + `design-doc/16-双模式架构与数据源基座.md` §10 的 W1–W8。
> 每条标：**默认值**（不阻塞施工）/ **状态** / **决策方** / **影响范围**。
>
> 状态：`🟡 待确认` = 用默认值施工中 / `🟢 已确认` = 使用方拍板 / `🔴 阻塞` = 必须先定才能继续。

---

## D.1 认证类

### D.1.1 JWT 秘钥来源
- **默认值**：环境变量 `JWT_SECRET`；未配置且 `NODE_ENV=development` 时走 dev-fallback（不验签）。
- **状态**：🟡 待确认（生产部署前必须填）。
- **决策方**：使用方运维。
- **影响**：`config.ts` / `plugins/auth.ts`。
- **验收**：不阻塞（Phase 0 A9 用 dev-token 验证）。

### D.1.2 JWT claims 字段路径
- **默认值**：`externalId = payload.id ?? payload.sub`；`name = payload.name ?? payload.username ?? payload.preferred_username ?? externalId`。
- **状态**：🟡 待确认（需对齐外部登录服务的实际 claims）。
- **决策方**：使用方（与登录服务对齐）。
- **影响**：`plugins/auth.ts` 的 `mapClaims()`。
- **验收**：不阻塞（默认值能跑通骨架）。

### D.1.3 externalId ↔ users 映射策略
- **默认值**：首次见到 externalId 自动建 USER 记录（JIT provisioning）。
- **状态**：🟡 待确认（备选：白名单预置，未在名单的拒绝）。
- **决策方**：使用方。
- **影响**：`plugins/auth.ts` 的 upsert 逻辑。
- **验收**：不阻塞。

---

## D.2 基础设施类

### D.2.1 内网 LLM baseURL / 模型名 / apiKey
- **默认值**：`LLM_BASE_URL=http://internal-llm/v1`、`LLM_API_KEY=internal`、`LLM_MODEL=internal-model-name`。
- **状态**：🟡 待确认（Phase 2 C1 验收前必须填真实值）。
- **决策方**：使用方运维。
- **影响**：`config.ts` / `plugins/llm.ts`。
- **验收**：Phase 2 C1 需真实连通。

### D.2.2 出网 HTTP 代理
- **默认值**：未配置（直连，内网可达源可正常采集）。
- **状态**：🟡 待确认（Phase 1A B7 验收前填代理地址）。
- **决策方**：使用方运维。
- **影响**：管理端代理页 / `plugins/http-client.ts`。
- **验收**：Phase 1A B7。

### D.2.3 首批数据源清单
- **默认值**：12 条种子源（见 1A 任务 1A.8，来自 newsnow/Signex 翻译）。
- **状态**：🟡 待确认（使用方可增删改）。
- **决策方**：使用方运营。
- **影响**：`seed/sources-seed.ts`。
- **验收**：不阻塞。

### D.2.4 报告调度目标初版
- **默认值**：日报（每日 08:00，periodHours=24）+ 周报（周一 09:00，periodHours=168）。
- **状态**：🟡 待确认。
- **决策方**：使用方运营。
- **影响**：`report_schedules` 种子数据。
- **验收**：Phase 3 D1。

---

## D.3 实现选择类（不阻塞，建议值）

### D.3.1 处理触发时机
- **默认值**：独立处理 cron（每小时），与报告 cron 解耦。
- **状态**：🟢 已采纳（实现层面决策）。

### D.3.2 时间窗默认值
- **默认值**：日报 periodHours=24，周报 periodHours=168。
- **状态**：🟢 已采纳。

### D.3.3 报告 issueNo 规则
- **默认值**：Mode 1 = `{scheduleCode}.{YYYYMMDD}-{seq}`；Mode 2 = `INS-{sessionId}`。
- **状态**：🟢 已采纳。

---

## D.4 Mode 2 类（W1–W8）

### W1 Pi Agent SDK 版本与内网可达性 🔴
- **默认值**：`@mariozechner/pi-coding-agent@latest`。
- **状态**：🔴 **关键**——Phase 1B 开工前必须确认内网能否装。
- **决策方**：使用方运维。
- **影响**：`apps/server/package.json` / `insight/runtime-pi.ts`。
- **兜底**：若不可得，启用 `AiSdkRuntime`（Vercel AI SDK 自写循环），dev-spec 1B 给了双实现任务卡。
- **验收**：Phase 1B G1 依赖此决策。

### W2 Mode 2 默认预算基线
- **默认值**：`{ maxSteps: 25, maxToolCalls: 40, maxTokens: 60000 }`。
- **状态**：🟡 待确认（按内网模型定价调）。
- **决策方**：使用方（成本敏感度）。
- **影响**：`insight/budget.ts` 默认值 / skill frontmatter 可覆盖。

### W3 LLM 模型（Mode 2）
- **默认值**：复用 `fastify.llm.chat`。
- **状态**：🟡 待确认（Mode 2 对推理要求更高，可能需更强模型）。
- **决策方**：使用方。
- **影响**：`config.ts` 可加 `LLM_MODEL_INSIGHT` 环境变量。
- **验收**：若用不同模型，1B 任务卡标出分支。

### W4 vault 多用户共享 vs 隔离
- **默认值**：全局共享（参考 Signex）。
- **状态**：🟡 待确认。
- **决策方**：使用方（<50 人单团队，共享通常合理）。
- **影响**：`vault_entries` 表无 `user_id` 列（当前设计）；若改隔离需加列。

### W5 Skill 创建/启用权限
- **默认值**：仅 ADMIN。
- **状态**：🟡 待确认。
- **决策方**：使用方。
- **影响**：`/admin/skills` 路由权限。

### W6 Mode 2 计费/限频
- **默认值**：Phase 5 加 `@fastify/rate-limit`（如每用户每小时 5 次 session）。
- **状态**：🟡 待确认（内网是否需要）。
- **决策方**：使用方。

### W7 WEB_SCRAPER 正文补全引擎
- **默认值**：`readability`（免费本地）优先，`firecrawl` 可选。
- **状态**：🟡 待确认（是否有 firecrawl key）。
- **决策方**：使用方。
- **影响**：`collectors/web-scraper.ts` / `WebScraperConfig.bodyExtractor`。

### W8 Agent 进程隔离
- **默认值**：Phase 5 起独立容器（与主服务隔离）。
- **状态**：🟡 待确认（内网编排限制）。
- **决策方**：使用方运维。
- **影响**：Phase 5 docker-compose / k8s 配置。

---

## D.5 待使用方最终确认清单（合并版）

> 生产部署前必须逐项拍板：

- [ ] **D.1.1** JWT 秘钥来源
- [ ] **D.1.2** JWT claims 字段路径
- [ ] **D.1.3** externalId 映射策略（JIT or 白名单）
- [ ] **D.2.1** 内网 LLM baseURL / 模型名 / apiKey
- [ ] **D.2.2** 出网 HTTP 代理 host/port/auth
- [ ] **D.2.3** 首批数据源清单（在默认 12 条基础上增删）
- [ ] **D.2.4** 报告调度目标初版
- [ ] **W1** Pi Agent SDK 内网可达性 🔴
- [ ] **W2** Mode 2 预算基线
- [ ] **W3** Mode 2 LLM 模型
- [ ] **W4** vault 共享 vs 隔离
- [ ] **W5** Skill 权限
- [ ] **W6** Mode 2 限频
- [ ] **W7** WEB_SCRAPER 引擎
- [ ] **W8** Agent 进程隔离

---

## D.6 演进项（v2+，当前不做）

| 项 | 说明 | 触发条件 |
|---|---|---|
| 反馈数据回流推荐 | 用 feedback 调整裁剪权重 | 用户量上来后 |
| 全文检索 | tsvector / Elasticsearch | 用户反馈检索需求 |
| 多租户 | 加 orgId 贯穿各表 | 出现跨部门隔离需求 |
| SSR / SEO | 内网无需求，保持 SPA | 若上公网 |
| Embedding 向量去重 | pgvector / MySQL 向量 | 内网 LLM 提供 embedding |
