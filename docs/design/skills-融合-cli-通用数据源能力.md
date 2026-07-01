# Skills × 洞察系统融合方案：CLI 通用数据源能力

> **状态**：设计完成，待实现
> **日期**：2026-06-30
> **背景**：经 8 轮架构 grill 探讨得出的完整方案。目标——让 skills 既能单独使用，又能无缝接入当前洞察系统。
> **相关 ADR**：ADR-0003（agent base）、ADR-0004（datasources pure TS）

---

## 一、设计目标与核心洞察

### 目标
skills（运行期能力包：脚本 + SKILL.md）必须满足：
1. **单独使用**：脱离洞察平台，skill 可被 shell / 人 / 任意 agent CLI 直接调用。
2. **无缝接入系统**：同一份 skill 能力，被洞察 agent 当作工具使用，无需重写接口。

### 核心洞察：CLI 是 skill 与平台的唯一契约
> skill 的本体是「调用 CLI 的文档/提示」。skill 单独跑 = 直接执行 CLI；skill 接入系统 = server 把 CLI 声明的能力映射成进程内 agent tool。

由此推出整个方案的基石：**datasources 引擎注册表是唯一真相源，CLI 和 agent tool 是它的两张脸，各用各的 config，零同步、零漂移。**

---

## 二、决策树（8 个已锁定点）

| # | 决策点 | 锁定结论 | 关键理由 |
|---|--------|----------|----------|
| Q1 | 融合对象 | **运行期能力包**（脚本+SKILL.md，如 ref/union-search-skill），非开发期协作技能（如 grill-me/tdd） | 两类 skills 含义不同，本方案只处理运行期能力包 |
| Q2 | skill 与平台的契约 | **CLI 是唯一执行入口**，平台把 CLI 调用翻译成 tool | 单一执行入口 = skill 作者只写一遍，零漂移 |
| Q3 | CLI 形态 | **能力原语型**（route X），不内置技能编排（route Y）；先只做 search + extract | 编排权统一归 agent；CLI 老实当工具箱 |
| Q4 | 通用性落点 | **路径甲**：datasources 抽引擎注册表，CLI 复用 | 通用性做在 datasources，CLI/tools.ts 都是消费者，避免漂移 |
| Q5 | config 真相源 | **分层（选项 iii）**：CLI 用 JSON，server 用 DB，交集对齐 | CLI 单独跑不依赖 server；server 架构不动 |
| Q6 | key 存储 | **明文进 JSON（选项 α）**；范围：exa/firecrawl key、jina url、proxy | 用户明确选择，CLI 单文件搞定 |
| Q7 | 接入机制 | **模型 B**：CLI 当契约，server 进程内复用注册表 | 零同步（config 不相交）、零浪费（无 fork） |
| Q8 | 命令形状 | **单命令 + `--engines` + 命名空间 flag `--engine.param`（形状 P + 约定 b）** | 1:1 对齐 fanoutSearch；加引擎 CLI 主干零改动 |

---

## 三、架构总图

```
                    ┌─────────────────────────────────────────┐
                    │   packages/datasources （唯一真相源）     │
                    │   ┌─────────────────────────────────┐    │
                    │   │  引擎注册表 (registry.ts)        │    │
                    │   │  - SearchEngine 工厂注册          │    │
                    │   │  - ExtractEngine 工厂注册         │    │
                    │   │  - 每个 engine 声明 paramsSchema  │    │
                    │   │    (TypeBox, 供 CLI 生成 flag)    │    │
                    │   └─────────────────────────────────┘    │
                    └──────────┬──────────────────┬────────────┘
                               │                  │
                    ┌──────────▼──────┐  ┌────────▼─────────────────┐
                    │  两张脸，同源     │  │  packages/agent          │
                    │                  │  │  tools.ts 的 search/     │
              ┌─────▼─────┐    ┌───────▼──────┐  extract 工具也复用  │
              │ CLI 脸     │    │ tool 脸       │  注册表（进程内）    │
              │ (独立跑)   │    │ (接入系统)    │                       │
              │ 读 JSON    │    │ 读 DB/env     │                       │
              │ config     │    │ config        │                       │
              └─────┬─────┘    └───────┬──────┘
                    │                  │
              ┌─────▼─────┐    ┌───────▼──────┐
              │ shell/skill│    │ 洞察 agent    │
              │ 人直接跑   │    │ (headless)    │
              └───────────┘    └──────────────┘

   config 永不相交 → 零同步（Q7 模型 B 的红利）
```

**自洽性验证**：
- 单独用：skill / 人直接跑 CLI → 读 JSON config → 闭环。
- 接入系统：skill 声明的 CLI 能力 → server 映射成进程内 tool → 读 DB/env config。
- 两条 config 路径**永不相交**，无需任何同步机制。

---

## 四、核心设计：引擎注册表（路径甲重构核心）

### 4.1 关键原则：所有引擎改为接受「注入的 config」

**当前问题**：引擎四处直读 `process.env`（`exa.ts:31`、`firecrawl.ts:12`、`extract.ts:36,66`），导致 config 来源不可控、CLI 无法注入自己的 JSON config。

**重构后**：所有 env 直读消除，统一改为接受注入的 `EngineConfig`。这是让 CLI（JSON 注入）和 server（DB/env 注入）共用一份代码的枢纽。

### 4.2 接口定义

```typescript
// search/types.ts —— 搜索引擎接口（小改：加 label + paramsSchema）
export interface SearchEngine {
  /** 引擎 id，用于 --engines 选项与注册表 key */
  readonly name: string;           // "ddg" | "exa" | "firecrawl" | "arxiv"
  /** 展示名 */
  readonly label: string;          // "DuckDuckGo"
  /** 是否已配置（缺 key 的引擎返回 false，扇出时跳过） */
  isConfigured(): boolean;
  /** 执行搜索，返回归一化 DataSourceItem[] */
  search(input: SearchInput): Promise<DataSourceItem[]>;
  /** 引擎特有参数 schema → CLI 自动生成 --<name>.<param> flag */
  readonly paramsSchema?: TSchema;
}

// extract/types.ts —— 新抽，对齐 SearchEngine（当前 extract.ts 是散函数，需收成接口）
export interface ExtractEngine {
  readonly name: string;           // "jina" | "firecrawl" | "local"
  readonly label: string;
  isConfigured(): boolean;
  extract(input: ExtractInput): Promise<ExtractResult>;
  readonly paramsSchema?: TSchema;
}
```

### 4.3 注册表（datasources 的新心脏）

```typescript
// registry.ts
export interface EngineConfig {
  exaApiKey?: string;
  firecrawlApiKey?: string;
  jinaUrl?: string;        // 自托管 jina（Q6 要求）
  jinaApiKey?: string;
  proxyUrl?: string;
  // 各引擎 enabled 开关、特有配置（按需扩展）
}

type SearchEngineFactory = (cfg: EngineConfig) => SearchEngine;
type ExtractEngineFactory = (cfg: EngineConfig) => ExtractEngine;

const searchFactories = new Map<string, SearchEngineFactory>();
const extractFactories = new Map<string, ExtractEngineFactory>();

export function registerSearchEngine(name: string, f: SearchEngineFactory): void;
export function registerExtractEngine(name: string, f: ExtractEngineFactory): void;

/** 按 cfg 构造全部已配置的搜索引擎 */
export function createSearchEngines(cfg: EngineConfig): SearchEngine[];
/** 按 cfg 构造全部提取引擎（用于 fallback 链） */
export function createExtractEngines(cfg: EngineConfig): ExtractEngine[];
```

### 4.4 文件拆分（extract 三引擎收成接口）

**当前** `extract.ts` 是三个独立函数（`extractWithJina` / `extractWithFirecrawl` / `extractLocal`）+ `extractContent()` 串联 fallback。

**重构后**：
```
extract/
  types.ts          # ExtractEngine 接口
  jina.ts           # JinaExtractor implements ExtractEngine（支持注入自托管 url）
  firecrawl.ts      # FirecrawlExtractor implements ExtractEngine
  local.ts          # LocalExtractor implements ExtractEngine
  index.ts          # extractContent() = fallback 链（遍历注册表）
```

> **重要澄清**：exa **不做提取**。它只在搜索时内联正文片段（`contents.text.maxCharacters: 500`），不是独立 extract 能力。extract 引擎只有 jina / firecrawl / local 三个。

---

## 五、CLI 命令面（新包 `packages/cli`，bin = `aiinsight`）

### 5.1 命令树

```bash
# search —— 单命令 + --engines 多选，扇出聚合（对齐 fanoutSearch）
aiinsight search "AI Agent" --engines ddg,exa --time 1w --limit 8
aiinsight search "LLM" --engines arxiv --arxiv.categories cs.AI,cs.CL --limit 20
aiinsight search "AI"                            # 默认 --engines all(已配置)

# extract —— 单命令 + --engine 单选(或 all 走 fallback 链)
aiinsight extract https://x.com/article --engine jina
aiinsight extract https://x.com/article          # 默认 all: jina→firecrawl→local

# config —— 命令行设置/读取（明文 JSON，选项 α）
aiinsight config set engines.exa.apiKey sk-xxx
aiinsight config set engines.jina.url http://my-jina:3000
aiinsight config set proxy.url http://proxy:8080
aiinsight config get engines.exa.apiKey
aiinsight config list
aiinsight config path

# 输出格式
aiinsight search "AI" --format json     # 默认，机器/skill 友好
aiinsight search "AI" --format table    # 人读
```

### 5.2 命名空间 flag 的威力

`--arxiv.categories` 仅当 `arxiv ∈ --engines` 才合法。CLI 据各引擎 `paramsSchema`：
1. 自动生成对应的 `--<engine>.<param>` flag
2. 自动生成帮助文本
3. 自动静态校验（`--arxiv.x` 仅当 arxiv 在 `--engines` 中才合法）

**加新引擎 = 实现接口 + 注册，CLI 主干零改动。** 这正是路径甲的终极形态。

### 5.3 输出契约

直接复用现有类型，无决策空间：
- `search` 输出 = `fanoutSearch` 返回值的 JSON 化：`{ items: DataSourceItem[], perEngine: Record<string, number> }`
- `extract` 输出 = `extractContent` 返回值：`{ url, title?, content, engine }`
- `--format json`（默认）/ `--format table`（人读）

---

## 六、配置设计（选项 α，CLI 独立跑时唯一真相源）

### 6.1 文件位置

`~/.aiinsight/config.json`（可用 `AIINSIGHT_CONFIG` env 覆盖路径）

### 6.2 结构（范围：exa/firecrawl key、jina url、proxy，Q6 锁定）

```json
{
  "engines": {
    "exa":       { "apiKey": "sk-xxx", "enabled": true },
    "firecrawl": { "apiKey": "sk-yyy", "enabled": true },
    "arxiv":     { "enabled": true },
    "jina":      { "url": "http://my-jina:3000", "apiKey": "" }
  },
  "proxy":    { "url": "http://proxy:8080" },
  "defaults": { "timeRange": "1w", "engines": ["ddg", "exa"] }
}
```

### 6.3 加载优先级（CLI 独立跑）

```
命令行 flag  >  JSON 文件  >  env（兼容兜底）  >  default
```

- **flag 最高**：`--exa.apiKey` 临时覆盖，便于一次性测试。
- **JSON 次之**：`config set` 写入的必然生效。
- **env 仅兼容**：现有 `.env.local` 用户可继续用（兜底，不主导）。

### 6.4 server 路径完全不碰此文件

模型 B 的核心红利：server 继续用 DB（`settings` 表）+ env，CLI 用 JSON，**永不相交**，无需任何同步机制。

---

## 七、落地步骤（分 4 阶段）

| 阶段 | 包 | 内容 | 依赖 | 价值 |
|------|-----|------|------|------|
| **1. 引擎注册表** | `packages/datasources` | 抽 `ExtractEngine` 接口 + 拆 extract 三引擎；所有引擎改 config 注入（消除 env 直读）；建 `registry.ts` | 无 | 唯一真相源成型 |
| **2. 加 arxiv** | `packages/datasources` | `ArxivEngine implements SearchEngine`（移植 `ref/Signex/.claude/skills/fetch-arxiv/scripts/search.py` 到 TS） | 阶段 1 | 验证注册表扩展性 |
| **3. CLI 包** | `packages/cli`（新） | bin `aiinsight`；search/extract/config 命令；`--engine.param` 由 paramsSchema 生成；JSON config 读写 | 阶段 1 | CLI 闭环（单独用） |
| **4. server 复用**（可选优化） | `apps/server` + `packages/agent` | `tools.ts` 改用注册表（目前是手写 6 工具）；注入 DB/env config | 阶段 1 | 接入系统红利 |

**关键**：
- 阶段 1-3 是 CLI 闭环（"单独用"）。
- **模型 B 下，即使不做阶段 4，"接入系统"也已成立**——因为 server 本来就进程内用 datasources；阶段 4 只是让 agent tool 也享受注册表的工程整洁。
- 阶段 4 可独立于 2、3 进行（只依赖阶段 1）。

### 7.1 阶段间解耦

```
阶段1 ──┬──> 阶段2（加 arxiv）
        ├──> 阶段3（CLI 包）
        └──> 阶段4（server 复用）
阶段2、3、4 互不依赖，可并行。
```

---

## 八、范围边界（明确不做）

| 项目 | 决策 | 理由 |
|------|------|------|
| CLI 内置技能编排（preset） | **不做** | 编排权归 agent；避免双编排引擎打架 |
| CLI ↔ server 配置同步机制 | **不做** | 模型 B 下两 config 不相交，无需同步 |
| 真起子进程跑 CLI（模型 A） | **暂不做** | 核心能力进程内直跑更高效；留作未来 datasources 外新能力的逃生通道 |
| exa 提取能力 | **不做** | exa 只搜索时内联正文片段，非独立 extract |
| RSS / crawl 进入 CLI | **本轮不做** | Q3 锁定本轮只做 search + extract，后续可扩展 |
| config 加密 / 双文件分层（选项 γ） | **不做** | Q6 锁定选项 α（明文 JSON） |
| 开发期协作技能融合（grill-me/tdd 等） | **不做** | Q1 锁定只处理运行期能力包 |

---

## 九、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 明文 key 落盘 | 安全倒退（违背 server "key 不入库"原则） | 已与用户确认接受（Q6 选项 α）；`.gitignore` 排除；建议文件权限 0600 |
| 引擎 paramsSchema 设计不当 | CLI flag 生成混乱 | 阶段 1 先用 ddg/exa/firecrawl（无特有参数）跑通，arxiv（有 `categories`）验证特有参数路径 |
| extract 重构破坏现有 fallback 链 | server extract_content 工具回归 | 阶段 1 保持 `extractContent()` 签名不变（内部改用注册表），回归测试 |
| server env 直读被消除后行为变化 | 启动失败或 key 丢失 | 阶段 1 在 server 入口统一注入 `EngineConfig`（从 `config.ts` 的 env 读取构造），行为等价 |

---

## 十、验证清单（实现完成后）

- [ ] CLI 独立跑：`aiinsight search "AI" --engines ddg,exa` 返回去重 JSON
- [ ] CLI 独立跑：`aiinsight extract <url> --engine jina --jina.url <自托管>` 走自托管
- [ ] CLI config：`config set/get/list/path` 正确读写 `~/.aiinsight/config.json`
- [ ] arxiv：`--engines arxiv --arxiv.categories cs.AI` 正确过滤
- [ ] 注册表扩展：新增一个引擎只需实现接口 + 注册，CLI 主干零改
- [ ] server 无回归：洞察 agent 的 search/extract 工具行为不变
- [ ] config 不相交：server 路径不读 CLI 的 JSON，反之亦然
- [ ] 安全：`config.json` 不被 git 追踪

---

## 附录 A：现状摸底（设计依据）

| 文件 | 现状 | 本方案影响 |
|------|------|-----------|
| `packages/datasources/src/search/*.ts` | ddg/exa/firecrawl 三引擎，`SearchEngine` 接口已存在 | 加 `label` + `paramsSchema`；env 直读改注入 |
| `packages/datasources/src/extract.ts` | 三个散函数 + `extractContent()` fallback 链 | 拆成 `extract/` 目录，收成 `ExtractEngine` 接口 |
| `packages/datasources/src/search/index.ts` | `fanoutSearch` 已实现扇出/去重/时间过滤 | CLI 的 `search` 命令直接复用 |
| `packages/agent/src/tools.ts` | 手写 6 个 customTool（search/crawl/rss/extract/list/saveReport） | 阶段 4 改用注册表（可选） |
| `apps/server/src/runtime-config.ts` | DB `settings` 表 + env，key 不入库（安全边界） | 保持不动；与 CLI JSON 不相交 |
| `apps/server/src/config.ts` | env 加载（LLM/数据源 key/proxy 等） | 阶段 1 改为构造 `EngineConfig` 注入 datasources |
| `ref/Signex/.claude/skills/fetch-arxiv/scripts/search.py` | Python arxiv 搜索，输出接近 DataSourceItem | 阶段 2 移植为 TS `ArxivEngine` |
