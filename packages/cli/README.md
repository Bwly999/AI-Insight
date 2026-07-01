# @ai-insight/cli

`aiinsight` — 通用数据源能力命令行（聚合搜索 + 正文提取）。

这是 [skills × 洞察系统融合方案](../../docs/design/skills-融合-cli-通用数据源能力.md) 的 CLI 落地：`packages/datasources` 引擎注册表是唯一真相源，CLI 与洞察系统的 agent tool 是它的两张脸——**各用各的 config，零同步、零漂移**。

## 设计定位

- **单独使用**：脱离洞察平台，shell / 人 / 任意 agent CLI 直接调用。读本地 JSON config。
- **无缝接入系统**：同一份引擎能力被洞察 agent 当工具使用（进程内复用注册表）。
- **CLI 是 skill 与平台的唯一契约**：skill 的本体是「调用 CLI 的文档/提示」。

## 安装

```bash
# 在 monorepo 根目录
pnpm install

# 直接运行（开发模式）
pnpm --filter @ai-insight/cli exec tsx src/bin.ts <command>

# 或链接为全局 bin
pnpm --filter @ai-insight/cli build
pnpm --filter @ai-insight/cli exec tsx src/bin.ts
```

## 快速开始

```bash
# 1. 配置数据源 key（明文 JSON，见下方「配置」）
aiinsight config set engines.exa.apiKey sk-xxx
aiinsight config set engines.firecrawl.apiKey sk-yyy

# 2. 聚合搜索
aiinsight search "AI Agent" --engines ddg,exa --time 1w --limit 8

# 3. arxiv 学术搜索（无需 key）
aiinsight search "LLM agent" --engines arxiv --arxiv.categories cs.AI,cs.CL

# 4. 正文提取
aiinsight extract https://example.com/article
```

## 命令

### `search` — 聚合搜索

单命令 + `--engines` 多选，扇出聚合（并发调用已配置引擎 → 时间过滤 → 去重）。

```bash
aiinsight search "<query>" [options]
```

| 选项 | 说明 |
|------|------|
| `-e, --engines <id,id>` | 引擎 id（逗号或空格分隔）；默认全部已配置。已知：`ddg, exa, firecrawl, arxiv` |
| `-t, --time <range>` | 时间窗：`1d 3d 1w 1m 6m 1y all` |
| `-l, --limit <n>` | 每引擎取多少条（默认 8） |
| `--tags <t,t>` | 标签过滤（general/news/academic/tech/...） |
| `-f, --format <f>` | 输出：`json`（默认）/ `table`（人读） |
| `--list-engines` | 列出引擎 + 各引擎特有参数 |
| `-h, --help` | 帮助 |

**输出**：`{ items: DataSourceItem[], perEngine: Record<string, number> }`

### `extract` — 正文提取

单命令 + `--engine` 单选（或 `all` 走 fallback 链）。

```bash
aiinsight extract <url> [options]
```

| 选项 | 说明 |
|------|------|
| `--engine <id>` | 提取引擎：`jina / firecrawl / local` 或 `all`（默认，fallback 链 `jina → firecrawl → local`） |
| `-f, --format <f>` | 输出：`json`（默认）/ `text`（纯 markdown） |
| `-h, --help` | 帮助 |

**输出**：`{ url, title?, content, engine }`

### `config` — 读写本地配置

```bash
aiinsight config set <key> <value>   # 设置值（自动创建中间对象）
aiinsight config get <key>           # 读取值
aiinsight config list                # 列出全部配置
aiinsight config path                # 显示配置文件路径
```

## 引擎命名空间 flag（约定 b）

引擎特有参数以 `--<engine>.<param>` 形式传递，**仅当引擎在 `--engines` 中才合法**（静态校验）。数组型参数（schema 声明为数组）的值按逗号或空格自动拆分，标量型参数保持原值。

```bash
aiinsight search "LLM" --engines arxiv --arxiv.categories cs.AI,cs.CL
aiinsight search "AI" --engines exa --exa.type neural
```

查看各引擎参数：

```bash
aiinsight search --list-engines
# ddg        DuckDuckGo
# exa        Exa  params: --exa.type
# firecrawl  Firecrawl  (未配置)
# arxiv      arXiv  params: --arxiv.categories, --arxiv.sortBy, --arxiv.sortOrder
```

**加新引擎**：在 `packages/datasources` 实现接口 + 注册，CLI 主干零改动（flag 由 `paramsSchema` 自动生成）。

## 配置

明文 JSON 存储（选项 α），文件位置 `~/.aiinsight/config.json`（`AIINSIGHT_CONFIG` env 可覆盖路径）。

**加载优先级**（CLI 独立跑）：`命令行 flag > JSON 文件 > env（兼容兜底）> default`

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

常用 key：

| key | 说明 |
|-----|------|
| `engines.exa.apiKey` | Exa 搜索 key |
| `engines.firecrawl.apiKey` | Firecrawl key（搜索 + 提取共用） |
| `engines.jina.url` | 自托管 Jina Reader URL（留空用官方 `r.jina.ai`） |
| `engines.jina.apiKey` | Jina key（可选，无 key 也能用） |
| `proxy.url` | 出站代理 |

> **安全**：config 含明文 API key，文件默认在家目录（不进仓库）。若用 `AIINSIGHT_CONFIG` 指向仓库内，已被 `.gitignore` 排除（`aiinsight.config.json` / `.aiinsight/`）。

### 与洞察系统的关系（config 不相交）

CLI 的 JSON config 只在「单独跑」时被读。洞察系统走进程内路径，读 server 的 DB（`settings` 表）+ env——**两条 config 路径永不相交，无需同步**（模型 B）。详见 [设计文档 §6](../../docs/design/skills-融合-cli-通用数据源能力.md)。

## 引擎清单

### 搜索引擎

| id | 名称 | key | 特有参数 |
|----|------|-----|---------|
| `ddg` | DuckDuckGo | 无 | — |
| `exa` | Exa | `EXA_API_KEY` | `--exa.type` (keyword/neural/auto) |
| `firecrawl` | Firecrawl | `FIRECRAWL_API_KEY` | — |
| `arxiv` | arXiv | 无（公开 API） | `--arxiv.categories` / `--arxiv.sortBy` / `--arxiv.sortOrder` |

### 提取引擎

| id | 名称 | key | 说明 |
|----|------|-----|------|
| `jina` | Jina Reader | 可选 / 可自托管 | 无 key 也能用；支持自托管 URL |
| `firecrawl` | Firecrawl | `FIRECRAWL_API_KEY` | scrapeUrl → markdown |
| `local` | Local fallback | 无 | 零依赖降级，精度较低 |

## 开发

```bash
pnpm --filter @ai-insight/cli typecheck   # 类型检查
pnpm --filter @ai-insight/cli test        # 单元测试
pnpm --filter @ai-insight/cli dev         # 运行（tsx 直跑）
```

### 程序化使用

```typescript
import { searchCommand, readConfig, toEngineConfig } from "@ai-insight/cli";

const cfg = toEngineConfig(readConfig());
const code = await searchCommand(["AI", "--engines", "ddg"], cfg);
```

## 相关文档

- [融合方案设计](../../docs/design/skills-融合-cli-通用数据源能力.md)
- [领域语言](../../CONTEXT.md)
- 数据源实现：[`@ai-insight/datasources`](../datasources)
