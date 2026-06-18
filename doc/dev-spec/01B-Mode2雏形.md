# Phase 1B · Mode 2 主动洞察雏形

> 依据：`design-doc/16-双模式架构与数据源基座.md` §5
> 前置：Phase 1A 验收通过（附录 C.B 全绿）
> 验收：附录 C.G（G1–G5）
> **关键依赖**：留白 W1（Pi Agent SDK 内网可达性）🔴 —— 本 Phase 开工前必须确认

## 1. 目标与范围

接入 Pi Agent SDK 作为 Mode 2 运行时，实现 4 个受控工具（collect/search/queryArticles/finalize）+ 1 个默认 skill（lens-deep-insight）+ 3 张审计表 + 用户端发起 session（SSE 流）+ 管理端 trace 回放。

这是 Mode 2 的最小可跑闭环：用户给一句意图 → Agent 调采集器拿数据 → 综合产出报告 → 全程可审计可回放。

**不做**（留 1C）：
- extract / vaultRead / vaultWrite / watch-shape 工具
- skill 版本管理 UI（1B 用 DB 直接灌，1C 才做 admin 页）
- 预算守卫的精细化（1B 给硬截断即可）

## 2. 依赖项

### 2.1 新增依赖（W1 确认后）

```bash
# 若 W1=可用：
corepack pnpm --filter @ai-insight/server add @mariozechner/pi-coding-agent
# 若 W1=不可用，跳过，走 AiSdkRuntime 兜底（任务 1B.7）
```

### 2.2 修改既有文件

- `apps/server/src/db/schema.ts` — 加 3 表（A.13/A.14/A.15）
- `packages/shared-types/src/` — 加 insight DTO + skill DTO + enums
- `apps/server/src/routes/index.ts` — 注册用户端 + 管理端 insight 路由

---

## 3. 任务卡

### [ ] 任务 1B.1 新增 3 张审计表（迁移）

> 验收：G4

**文件路径**
- 修改 `apps/server/src/db/schema.ts` — 追加 `insightSessions` / `agentSteps` / `agentToolCalls`（结构见附录 A.13/A.14/A.15）
- `corepack pnpm --filter @ai-insight/server db:gen && db:migrate`

**实现要点**
- 严格按附录 A 的列定义
- FK：`session_id → insight_sessions.id`，`step_id → agent_steps.id`（nullable）
- 索引按附录 A 各表的「索引」行

**验收点**
- G4（trace 落库的前提）

---

### [ ] 任务 1B.2 shared-types 新增 DTO + enum

**接口签名**

```ts
// packages/shared-types/src/dto/insight.ts
export const CreateInsightSessionBody = z.object({
  intent: z.string().min(1).max(2000),
  skillSet: z.array(z.string()).default(['lens-deep-insight']),
  budget: z.object({
    maxSteps: z.number().int().min(1).max(100).default(25),
    maxToolCalls: z.number().int().min(1).max(200).default(40),
    maxTokens: z.number().int().min(1000).max(500000).default(60000),
  }).default({ maxSteps: 25, maxToolCalls: 40, maxTokens: 60000 }),
});

export interface InsightSessionView {
  id: number;
  userId: number;
  intent: string;
  skillSet: string[];
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ABORTED';
  budget: SessionBudget;
  usedTokens: number;
  usedSteps: number;
  usedToolCalls: number;
  reportMarkdown: string | null;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}

export interface AgentStepView { /* 见 A.14 + 序列化 */ }
export interface AgentToolCallView { /* 见 A.15 + 序列化 */ }

// packages/shared-types/src/dto/skill.ts
export interface SkillRevisionView {
  id: number; name: string; version: string;
  frontmatter: SkillFrontmatter; bodyMd: string;
  authorId: number; authorName: string;
  enabled: boolean; createdAt: string; auditNote: string;
}

// packages/shared-types/src/dto/vault.ts（1C 用，1B 先定义）
export interface VaultEntryView {
  id: number; title: string; bodyMd: string; tags: string[];
  sourceSessionId: number | null; pinned: boolean;
  createdAt: string; updatedAt: string;
}
```

**文件路径**
- 新建 `packages/shared-types/src/dto/insight.ts`
- 新建 `packages/shared-types/src/dto/skill.ts`
- 新建 `packages/shared-types/src/dto/vault.ts`
- 修改 `packages/shared-types/src/dto/index.ts` — re-export
- 修改 `packages/shared-types/src/enums.ts` — 加 `InsightStatus` / `AgentStepRole` / `AgentToolName`（见 A.21）

**实现要点**
- `SkillFrontmatter` 类型见任务 1B.5
- `SessionBudget` 见附录 A.19.3

**验收点**
- 不直接对应；G4 序列化依赖

---

### [ ] 任务 1B.3 IAgentRuntime SPI 抽象

> 验收：G1（runtime 可跑）

**接口签名**

见附录 A.19.3（`IAgentRuntime` / `AgentTool` / `SessionBudget` / `RunInsightInput` / `RunInsightResult` / `AgentStepEvent`）

**文件路径**
- 新建 `apps/server/src/insight/types.ts` — 上述接口 + `SkillFrontmatter`

```ts
export interface SkillFrontmatter {
  name: string;
  description: string;
  version: string;
  tools: AgentToolName[];      // 白名单
  vaultWrite?: boolean;
  budget?: Partial<SessionBudget>;  // 覆盖默认
  trigger?: { keywords?: string[] };
}
```

**实现要点**
- 纯类型，无逻辑
- `AgentStepEvent` 是 SSE 推给前端的事件结构（附录 B.14）

**验收点**
- G1 的接口契约

---

### [ ] 任务 1B.4 skill_revision 表数据灌入 + skill-loader

> 验收：G1（lens-deep-insight 可加载）

**接口签名**

```ts
// apps/server/src/insight/skill-loader.ts
export async function loadEnabledSkill(name: string): Promise<{ frontmatter: SkillFrontmatter; body: string } | null>;
export async function loadSkills(names: string[]): Promise<{ frontmatter: SkillFrontmatter; body: string }[]>;
```

**文件路径**
- 新建 `apps/server/src/insight/skills/lens-deep-insight.md` — skill 源（见 design-doc/16 §5.4 示例，1B 只做这一个）
- 新建 `apps/server/src/insight/skill-loader.ts`
- 新建 `apps/server/scripts/seed-skills.mjs` — 解析 .md frontmatter（用 gray-matter）+ body，写 skill_revisions

**依赖**

```bash
corepack pnpm --filter @ai-insight/server add gray-matter
corepack pnpm --filter @ai-insight/server add -D @types/gray-matter
```

**实现要点**
- skill 文件格式：YAML frontmatter + markdown body（见 design-doc/16 §5.4）
- `loadEnabledSkill`：查 `skill_revisions WHERE name=? AND enabled=true LIMIT 1`
- 启动时（main.ts）调 `seed-skills.mjs` 把 `insight/skills/*.md` 同步到 DB（enabled=true 覆盖同名旧版）
- lens-deep-insight 的 frontmatter：
  ```yaml
  name: lens-deep-insight
  description: 综合分析 — 关键发现、趋势、行动建议
  version: "1.0.0"
  tools: [collect, search, queryArticles, finalize]
  budget: { maxSteps: 25, maxToolCalls: 40, maxTokens: 60000 }
  trigger: { keywords: [深度, 详尽, 全面] }
  ```

**验收点**
- G1（skill 能被 runtime 加载）

---

### [ ] 任务 1B.5 insight extension（受控工具集雏形）

> 验收：G2 / G5

**接口签名**

```ts
// apps/server/src/insight/extension.ts
export function createInsightTools(ctx: {
  sessionId: number; userId: number;
}): AgentTool[];  // 返回 4 个工具：collect/search/queryArticles/finalize
```

**文件路径**
- 新建 `apps/server/src/insight/tools/collect.ts`
- 新建 `apps/server/src/insight/tools/search.ts`
- 新建 `apps/server/src/insight/tools/query-articles.ts`
- 新建 `apps/server/src/insight/tools/finalize.ts`
- 新建 `apps/server/src/insight/extension.ts` — 聚合 + 记 agent_tool_calls

**实现要点**

`collect({ sourceCode, query? })`：
- 查 sources 表（code=sourceCode, enabled=true），不存在抛「未知源」
- `app.collectors.get(source.type).fetch(...)`（**复用 1A**）
- 写 agent_tool_calls（tool='COLLECT', args, result, ok, duration_ms）
- 返回 items 摘要（前 10 条 + count，避免 token 爆炸）

`search({ query, sourceCode? })`：
- sourceCode 默认选第一个 mode='query' 的 SEARCH_API 源
- 内部调 collect，但传 query
- 同样记 agent_tool_calls

`queryArticles({ keywords?, category?, since? })`：
- 查 articles 表（drizzle select）
- 只读，记 agent_tool_calls

`finalize({ reportMarkdown })`：
- 更新 insight_sessions.report_markdown + status=SUCCESS
- 必须调，否则 session 无产出（runtime 检测未调则标 FAILED）

**白名单**：这 4 个是全部工具，**不**注册 bash/exec/fetch/edit（G5）。

每个工具的 `execute` 内部用 try/catch，失败 ok=false + error，写 agent_tool_calls。

**验收点**
- G2（collect 命中真实采集器）
- G5（无危险工具）

---

### [ ] 任务 1B.6 PiAgentRuntime 实现（W1=可用时）

> 验收：G1 / G3

**接口签名**

```ts
// apps/server/src/insight/runtime-pi.ts
export class PiAgentRuntime implements IAgentRuntime {
  constructor(private app: FastifyInstance);
  async run(input: RunInsightInput, onStep: (e: AgentStepEvent) => void): Promise<RunInsightResult>;
}
```

**文件路径**
- 新建 `apps/server/src/insight/runtime-pi.ts`
- 新建 `apps/server/src/plugins/agent-runtime.ts` — decorate('agentRuntime', new PiAgentRuntime(app))
- 修改 `apps/server/src/main.ts` — register agent-runtime

**实现要点**
- 用 `@mariozechner/pi-coding-agent` 的 `createAgent` + `ExtensionAPI`
- 扩展（参考 Pi 官方 rolePersonaExtension 模式）：
  - `pi.registerTool({ name: 'collect', ... })` 注册 4 个工具
  - hooks：`before_agent_start` 注入 skill body 到 systemPrompt；`tool_result` 写 agent_tool_calls；`agent_end` 写 insight_sessions.finished_at
- **不**用 Pi 的 bash/edit/read 等内置工具 —— 扩展只注册我们的 4 个
- model：`app.llm.chat`（W3 若不同模型，从 config 读 `llm.insightModel`）
- budget：从 skill frontmatter 或 input.budget 取；每步前检查，超限抛 `BudgetExceededError` → session status=ABORTED
- onStep：把 Pi 的 step/tool_call/tool_result 事件转成 `AgentStepEvent` 推给调用方

**验收点**
- G1 / G3

---

### [ ] 任务 1B.7 AiSdkRuntime 兜底（W1=不可用时）

> 验收：G1（同上）

**文件路径**
- 新建 `apps/server/src/insight/runtime-aisdk.ts`

**实现要点**
- 用 Vercel AI SDK 的 `streamText` + `tools` 自写循环
- 循环：`streamText({ model, system: skillBody, messages, tools })` → 解析 tool_calls → 执行 → 拼回 messages → 再循环，直到无 tool_call 或预算耗尽
- 工具集同 1B.5 的 4 个
- 暴露同样的 `IAgentRuntime` 接口，对上层透明
- 与 PiAgentRuntime 二选一（main.ts 按 `config.agentRuntime` 选）

**验收点**
- G1（与 1B.6 等价）

> **施工提示**：1B.6 和 1B.7 实现其一即可（按 W1 决策），代码隔离便于后续切换。

---

### [ ] 任务 1B.8 insight-session 编排（预算 + trace + 状态机）

> 验收：G3 / G4

**接口签名**

```ts
// apps/server/src/insight/orchestrator.ts
export async function runInsightSession(args: {
  userId: number; intent: string; skillSet: string[]; budget: SessionBudget;
  onStep: (e: AgentStepEvent) => void;
}): Promise<RunInsightResult>;
```

**文件路径**
- 新建 `apps/server/src/insight/orchestrator.ts`
- 新建 `apps/server/src/insight/budget.ts` — `BudgetGuard` 类

**实现要点**
- 流程：
  1. insert insight_sessions（status=RUNNING）
  2. loadSkills(skillSet)，取 skill 的 tools 白名单 + budget override
  3. createInsightTools({ sessionId, userId })
  4. `app.agentRuntime.run(input, onStep)`，onStep 内：
     - 写 agent_steps（type=step）
     - 写 agent_tool_calls（type=tool_call/tool_result）
     - 累加 usedTokens/usedSteps/usedToolCalls，超限抛 BudgetExceededError
     - 转发给上层 onStep（SSE）
  5. catch BudgetExceededError → status=ABORTED + error
  6. catch 其他 → status=FAILED + error
  7. 正常 → status=SUCCESS（finalize 工具已写 report_markdown）
  8. 更新 insight_sessions（status, finished_at, used_*）
- BudgetGuard：每步调 `guard.consume({ tokens, steps, toolCalls })`，超限抛

**验收点**
- G3（预算截断）
- G4（trace 落库）

---

### [ ] 任务 1B.9 用户端路由 · 发起 session（SSE）

> 验收：G1

**接口签名**

按附录 B.4（`POST /insight/sessions` 返回 SSE 流）

**文件路径**
- 新建 `apps/server/src/routes/insight.ts`
- 修改 `apps/server/src/routes/index.ts`

**实现要点**
- preHandler `[app.auth]`
- 创建 session 记录（status=RUNNING）→ 立即返回 `{ sessionId }` + 转 SSE 流
- SSE：`reply.raw.setHeader('Content-Type', 'text/event-stream')`，orchestrator 的 onStep 回调里 `reply.raw.write('event: step\ndata: ...\n\n')`
- 客户端断开时 abort session（监听 `req.raw.on('close')`）
- `GET /insight/sessions/:id/stream` 用于断线重连（从 DB 读已持久化的 steps 重放 + 若 session 还 RUNNING 续推）
- `GET /insight/sessions/:id` / `GET /insight/sessions`：查 DB 返回

**验收点**
- G1

---

### [ ] 任务 1B.10 管理端路由 · session 列表 + trace

> 验收：G4

**接口签名**

按附录 B.12（`/admin/insight/sessions` + `/trace`）

**文件路径**
- 新建 `apps/server/src/routes/admin/insight.ts`
- 修改 `apps/server/src/routes/index.ts`

**实现要点**
- preHandler `[app.auth, app.requireAdmin]`
- 列表：分页 + 按 userId/status 筛
- trace：联表 insight_sessions + agent_steps + agent_tool_calls，按 step_no 排序

**验收点**
- G4

---

### [ ] 任务 1B.11 管理端前端 · insight 列表 + trace 回放

**文件路径**
- 新建 `apps/admin/src/views/InsightSessionsView.vue` — 列表 + 筛选
- 新建 `apps/admin/src/views/InsightTraceView.vue` — 单 session trace 回放（时间线展示 step + 工具调用 + token/耗时）
- 修改 `apps/admin/src/router/index.ts` — 加路由
- 新建 `apps/admin/src/api/insight.ts`

**实现要点**
- trace 回放：垂直时间线，每个 step 一张卡片（role/content/token），工具调用嵌套显示 args/result
- 用 shared-ui 的 HeatBar 显示预算用量

**验收点**
- G4

---

### [ ] 任务 1B.12 用户端前端 · 发起洞察页

**文件路径**
- 新建 `apps/user/src/views/InsightView.vue` — 输入框 + 发起 + SSE 实时展示 + 最终报告渲染
- 修改 `apps/user/src/router/index.ts` — 加 `/insight` 路由
- 新建 `apps/user/src/api/insight.ts` — 用 EventSource 接 SSE

**实现要点**
- 输入框：用户写意图（如「分析本周 AI 编程工具动态」）
- 发起后：textarea 区实时 append Agent 的思考/工具调用（markdown 渲染）
- 完成后：报告区显示 reportMarkdown（渲染成编辑风排版）
- 预算条：显示 used/max

**验收点**
- G1

---

## 4. 测试要求

| 测试目标 | 类型 |
|---|---|
| BudgetGuard.consume 超限抛错 | 单元 |
| skill-loader 加载 enabled skill | 单元（mock DB） |
| insight extension collect 工具（mock collector） | 单元 |
| SSE 流式（mock runtime） | 集成 |

## 5. 与其他 Phase 的接口

**暴露**：
- `app.agentRuntime` → 1C 扩展更多工具
- insight_sessions/agent_steps/agent_tool_calls → 1C 的 vault 关联 / Phase 5 可观测

**消费**：
- 1A 的 `app.collectors` / `app.crypto` / `app.rebuildHttpAgent`
- 1A 的 sources 表（collect 工具按 code 查）
- Phase 0 的 articles 表（queryArticles 工具）

**Next**：1B 全绿 → 1C（完善工具集 + skill 管理 UI + 预算精细化 + 审计面板）。
