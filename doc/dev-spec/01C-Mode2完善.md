# Phase 1C · Mode 2 主动洞察完善

> 依据：`design-doc/16-双模式架构与数据源基座.md` §5.4/§5.5/§5.6
> 前置：Phase 1B 验收通过（附录 C.G 全绿）
> 验收：附录 C.H（H1–H6）

## 1. 目标与范围

补齐 Mode 2 的完整工具集（extract/vaultRead/vaultWrite/watch-shape）、skill 版本管理 UI、预算守卫精细化、审计面板。完成后 Mode 2 从「能跑」升级到「可用、可运营」。

**不做**：
- Agent 进程隔离（W8，Phase 5）
- Mode 2 限频（W6，Phase 5）

## 2. 依赖项

- 无新增依赖（1B 已装齐）
- 修改：`apps/server/src/insight/extension.ts`（加 3 工具）、`apps/server/src/db/schema.ts`（加 vault_entries 表）

---

## 3. 任务卡

### [ ] 任务 1C.1 vault_entries 表（迁移）

> 验收：H2

**文件路径**
- 修改 `apps/server/src/db/schema.ts` — 追加 `vaultEntries`（结构见附录 A.17）
- `db:gen && db:migrate`

**实现要点**
- W4 默认全局共享（无 user_id 列）；若 W4 改隔离，加 `user_id` 列 + 索引
- tags 用 JSON，查询用 `JSON_CONTAINS`

**验收点**
- H2

---

### [ ] 任务 1C.2 extract 工具（正文补全）

> 验收：H1

**接口签名**

```ts
// apps/server/src/insight/tools/extract.ts
export function createExtractTool(ctx: ToolContext): AgentTool;
// args: { url: string }
// result: { title, content, wordCount }
```

**文件路径**
- 新建 `apps/server/src/insight/tools/extract.ts`
- 修改 `apps/server/src/collectors/web-scraper.ts` — 把 1A 的占位换成真实 readability 实现
- 修改 `apps/server/src/insight/extension.ts` — 注册 extract

**依赖**

```bash
corepack pnpm --filter @ai-insight/server add @mozilla/readability jsdom
# firecrawl 可选（W7）：corepack pnpm add firecrawl
```

**实现要点**
- 调 WebScraperCollector（bodyExtractor 按 W7）抓正文
- maxBytes 上限（默认 1MB），超长截断 + 标注
- 记 agent_tool_calls（tool='EXTRACT'）
- 用 1A 的 `app.http`（走代理）

**验收点**
- H1

---

### [ ] 任务 1C.3 vaultRead / vaultWrite 工具

> 验收：H2

**接口签名**

```ts
// apps/server/src/insight/tools/vault.ts
export function createVaultReadTool(ctx: ToolContext): AgentTool;
export function createVaultWriteTool(ctx: ToolContext): AgentTool;
```

**文件路径**
- 新建 `apps/server/src/insight/tools/vault.ts`
- 修改 `apps/server/src/insight/extension.ts`

**实现要点**

`vaultRead({ query, tags?, limit? })`：
- 查 vault_entries：title/body 的 LIKE 查询 + tags JSON_CONTAINS
- 只读，记 agent_tool_calls（tool='VAULT_READ'）
- 返回前 N 条摘要（title + body 前 500 字）

`vaultWrite({ title, body, tags? })`：
- **权限**：仅当 skill frontmatter `vault_write: true` 时注册此工具（否则不存在）
- insert vault_entries（source_session_id = 当前 session）
- 记 agent_tool_calls（tool='VAULT_WRITE'）

**验收点**
- H2

---

### [ ] 任务 1C.4 watch-shape skill + to-subscription 接口

> 验收：H3

**接口签名**

按附录 B.4（`POST /insight/sessions/:id/to-subscription`）

**文件路径**
- 新建 `apps/server/src/insight/skills/watch-shape.md` — 辅助 skill，引导 Agent 从 intent 提炼 categoryCodes + keywords
- 新建 `apps/server/src/routes/insight.ts` 内加 `to-subscription` handler（修改 1B 已建文件）
- 修改 `apps/server/src/insight/extension.ts` — watch-shape 产出结构化建议

**实现要点**
- watch-shape skill 不调外部工具，纯 LLM 分析 intent → 输出 `{ categoryCodes, keywords, suggestedScheduleId }`
- `to-subscription` 路由：取 session 的 watch-shape 输出（存 session.report_markdown 或新字段）+ 用户确认的 scheduleId → insert subscriptions

**验收点**
- H3

---

### [ ] 任务 1C.5 默认 skill 集补齐（lens-flash-brief / lens-dual-take / lens-timeline-trace）

**文件路径**
- 新建 `apps/server/src/insight/skills/lens-flash-brief.md` — 3-5 条要点速览
- 新建 `apps/server/src/insight/skills/lens-dual-take.md` — 正反论证
- 新建 `apps/server/src/insight/skills/lens-timeline-trace.md` — 时间线梳理
- 修改 `apps/server/scripts/seed-skills.mjs` — 覆盖这 4 个

**实现要点**
- 参考 Signex 的 4 个 lens 改写为中文 prompt
- 每个 lens 的 tools 白名单按需（flash-brief 只需 collect+finalize；dual-take 加 queryArticles）
- budget 各异（flash-brief 更省）

**验收点**
- 无直接对应；提升 Mode 2 可用性

---

### [ ] 任务 1C.6 skill 版本管理 admin 页

> 验收：H4

**接口签名**

按附录 B.12（`/admin/skills` + enable/disable）

**文件路径**
- 新建 `apps/server/src/routes/admin/skills.ts`
- 修改 `apps/server/src/routes/index.ts`
- 新建 `apps/admin/src/views/SkillsView.vue`
- 修改 `apps/admin/src/router/index.ts`
- 新建 `apps/admin/src/api/skills.ts`

**实现要点**

后端：
- `POST /admin/skills`：接收 `CreateSkillRevisionBody`（frontmatter + bodyMd + auditNote），解析 frontmatter 校验，insert skill_revisions（默认 enabled=false）
- `POST /admin/skills/:name/enable`：事务 —— 同 name 的其他版本 enabled=false，指定版本 enabled=true
- `auditNote` 强制非空（W5 安全）

前端：
- 列表：name/version/enabled/author/createdAt
- 上传：textarea 编辑 frontmatter + body，预览解析结果
- 启用/禁用按钮

**验收点**
- H4

---

### [ ] 任务 1C.7 预算守卫精细化

> 验收：H5

**接口签名**

```ts
// apps/server/src/insight/budget.ts（扩展 1B.8）
export class BudgetGuard {
  constructor(budget: SessionBudget);
  consume({ tokens?, steps?, toolCalls? }: { tokens?: number; steps?: number; toolCalls?: number }): void;
  // 超限抛 BudgetExceededError { field: 'tokens'|'steps'|'toolCalls', used, max }
  remaining(): { tokens: number; steps: number; toolCalls: number };
  snapshot(): { used: SessionBudgetUsage; max: SessionBudget };
}
```

**文件路径**
- 修改 `apps/server/src/insight/budget.ts`

**实现要点**
- 1B 的 BudgetGuard 已基础实现，1C 补：
  - `remaining()` 给前端展示
  - 接近上限（>80%）时通过 onStep 推 `event:warn` 事件（前端显示「预算即将耗尽」）
  - 每个工具调用前预估 token（按 args 长度粗估），超限直接拒绝调用（返回 tool result 而非抛错，让 Agent 知道要走 finalize）

**验收点**
- H5

---

### [ ] 任务 1C.8 审计面板（admin）

> 验收：H6

**文件路径**
- 新建 `apps/admin/src/views/InsightAuditView.vue` — 汇总视图
- 修改 `apps/admin/src/router/index.ts`

**实现要点**
- 顶部统计卡：总 session 数 / 成功率 / 平均 token / 平均耗时 / 各工具调用频次
- 表格：近期 session（status/used_tokens/used_steps/工具调用数）
- 点进单 session → 复用 1B.11 的 trace 回放
- 工具调用频次：`SELECT tool, COUNT(*) FROM agent_tool_calls GROUP BY tool`

**验收点**
- H6

---

## 4. 测试要求

| 测试目标 | 类型 |
|---|---|
| BudgetGuard.remaining/snapshot | 单元 |
| vaultWrite 权限（skill 无 vault_write 时工具不存在） | 单元 |
| extract 工具（mock readability） | 单元 |
| skill enable 事务（同 name 仅一版 enabled） | 集成 |

## 5. 与其他 Phase 的接口

**暴露**：
- 完整工具集（7 个）+ 5 个默认 skill → Phase 2 的处理管道可读 vault 做参考
- skill_revisions 表 → Phase 5 可观测面板可统计 skill 使用频次

**消费**：
- 1B 的 runtime / orchestrator / extension
- 1A 的 WebScraperCollector（extract 复用）

**Next**：1C 全绿 → Mode 2 完整可用。可并行 Phase 2（AI 处理，Mode 1 主线）。
