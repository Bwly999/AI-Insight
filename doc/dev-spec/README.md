# dev-spec 导读

> 这是执行规格层（`doc/dev-spec/`）的导读。先读本文，再读具体 Phase 文档。

## 这层文档是什么

`dev-spec/` 是给**施工 Agent**（也给人 review）的可执行规格。每份文档对应一个 Phase（或子阶段），内含若干**任务卡**，Agent 照单施工即可，无需再做架构决策。

概念层的「为什么」在 `../design-doc/`，本层只管「做什么、怎么做、做到什么程度算通过」。

## 任务卡的标准结构

每份 Phase 文档的核心是任务卡。一个任务卡长这样：

```markdown
### 任务 1A.3 实现 RSS 采集器

> 验收：B2（见附录 C）

**接口签名 / 数据结构**
\`\`\`ts
export class RssCollector implements ICollector {
  readonly type = 'RSS';
  constructor(private http: Dispatcher) {}
  async fetch(source: SourceConfig): Promise<RawItemInput[]> { ... }
}
\`\`\`

**文件路径**
- 新建 `apps/server/src/collectors/rss.ts`

**实现要点**
- 用 `rss-parser`（已在依赖项列出）解析 feed
- 超时 30s，失败抛 Error（由 worker catch 记 collect_logs）
- URL 缺失的 item 跳过
- publishedAt 解析失败时回退到当前时间

**验收点**
- B2：新建 RSS 源 → 触发 → raw_items 出现新记录，collect_logs 记 SUCCESS
```

四段式：**接口签名 → 文件路径 → 实现要点 → 验收点**。缺一不可。

## 任务卡的勾选

每个任务卡标题前有一个 `[ ]`，施工完成后改成 `[x]`。这样进度可在文档里直接追踪，不需要外部工具。

```markdown
### [x] 任务 1A.3 实现 RSS 采集器   ← 已完成
### [ ] 任务 1A.4 实现 SearchApiCollector  ← 待做
```

## 文档间的引用关系

```
00-约定与前置 ────────────────── 所有 Phase 文档共用
                                   │
A-数据契约（表/DTO/SPI 总表）◄──── 所有 Phase 文档查接口时引用
B-API清单（端点总表）        ◄──── 所有 Phase 文档查路由时引用
C-验收矩阵（验收↔任务↔命令）◄──── 所有 Phase 文档的「验收点」段引用
D-留白决策记录              ◄──── 涉及留白项时引用

01A → 01B → 01C → 02 → 03 → 04 → 05   （线性依赖，前者验收通过才做后者）
```

**附录是字典**：写 Phase 文档时尽量引用附录而不重复定义，保持单一真源。若附录与 Phase 文档冲突，**以附录为准**并回头修 Phase 文档。

## 依赖与前置检查

每份 Phase 文档开头会有：

```
> 依据：design-doc/XX.md §Y
> 前置：Phase {上一阶段} 验收通过（附录 C 的 {组} 项）
> 验收：附录 C 的 {组} 项
```

施工前必须确认前置验收已过，否则可能踩坑（比如 1B 依赖 1A 的真实采集器，1A 没做完 1B 的 collect 工具调不通）。

## 体例约定

- **TS 代码块**：接口签名 / 类型定义 / 关键数据结构。**不写完整实现**（完整实现是施工 Agent 的活）。
- **路径**：相对项目根，如 `apps/server/src/collectors/rss.ts`。
- **`fastify.xxx`**：指 Fastify decorate 出的实例方法，查附录 A 的「Fastify 装饰器总表」。
- **`附录 X.Y`**：指 dev-spec 附录 X 的第 Y 节。
- **`design-doc/XX`**：指 `doc/design-doc/` 下的概念文档。
- **错误处理**：除非任务卡特殊说明，一律遵循 `00-约定与前置.md` 的错误约定。
- **日志**：除非特殊说明，一律遵循 `00-约定与前置.md` 的日志约定。

## 如何用这层文档施工

1. 确认当前要做的 Phase，读对应 `0X-{名称}.md`。
2. 读 `00-约定与前置.md`（首次必读）。
3. 按任务卡顺序施工，每完成一个把 `[ ]` 改 `[x]`。
4. 遇到接口/表/DTO 不确定 → 查附录 A。
5. 遇到路由不确定 → 查附录 B。
6. 一个任务卡完成后，按其「验收点」段的引用去附录 C 找验证命令自测。
7. 全部任务卡完成后，跑附录 C 该 Phase 验收组的全部检查项。
8. 全绿 → 提交 commit，进入下一 Phase。

## 文档版本

- 初版：2026-06-18，覆盖 Phase 1A–5。
- Phase 0 已完成，无 dev-spec（验收见 design-doc/13 A 组）。
