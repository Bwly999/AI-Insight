# 数据源获取

洞察的数据来自采集，不靠记忆。同一套数据源能力有**两张调用面孔**——按你当前所在环境选用：

- **server 环境（有原生工具）**：直接调用 `search` / `extract_content` 工具。时间窗与标签偏好由本轮 Run 配置**自动应用**，你只需给 query，不必传 time/tags。
- **ZCode / 仅 Bash 环境**：用 `aiinsight` CLI（见下文），需显式传 `--time` / `--engines` 等参数。

两套面孔背后是同一个引擎 registry，能力等价；区别只在调用方式与本轮配置是否自动注入。

## 两个能力（契约）

### search — 聚合搜索
扇出多搜索引擎、去重、按时间过滤。适合找特定主题的最新进展、产品、论文。
- 参数：`query`（查询词，建议英文/中英混合提高命中率）、`tags?`（标签偏好，覆盖默认）、`limit?`（每引擎上限，默认 8）。

### extract_content — 正文提取
对某个 URL 深读，拿 markdown 正文。对决定结论的关键来源用，不要只靠搜索摘要片段下判断。
- 参数：`url`。
- fallback 链：`jina → firecrawl → local`，逐个尝试，任一成功即返回。jina 无 key 也能用（走官方 `r.jina.ai`），firecrawl 缺 key 则跳过，local 永远兜底。因此**默认先走 jina**，无需显式指定。

---

## ZCode / Bash-only 环境的 CLI 用法

`aiinsight` CLI **已内置在本 skill 目录**（`scripts/aiinsight.cjs`，自包含单文件，零 `node_modules`），独立于洞察平台，单独可跑，扇出多引擎去重。只需 Node ≥20，无需任何安装或下载。

调用统一形如 `node scripts/aiinsight.cjs <command> ...`（路径相对本 skill 根目录）。

### search
```bash
node scripts/aiinsight.cjs search "<query>" --engines ddg,exa --time 1w --limit 8 --format json
```
- `--engines`：`ddg` / `exa` / `firecrawl` / `arxiv`，多选逗号分隔；不传 = 全部已配置引擎
- `--time`：`1d` / `3d` / `1w` / `1m` / `6m` / `1y` / `all`（时间窗）
- `--limit`：每引擎结果上限
- `--format`：`json`（默认，机器/skill 友好）/ `table`（人读）
- **引擎特有参数**：形如 `--<engine>.<param>`，仅当该引擎在 `--engines` 中才合法。例：`--engines arxiv --arxiv.categories cs.AI,cs.CL`

输出：`{ items: DataSourceItem[], perEngine: Record<string, number> }`。每个 item 含 title / url / summary / publishedAt / tags。

### extract
```bash
node scripts/aiinsight.cjs extract <url> --engine jina        # 指定单一引擎
node scripts/aiinsight.cjs extract <url>                      # 默认 all：jina → firecrawl → local 逐个 fallback
```
输出：`{ url, title?, content, engine }`。

### config
```bash
node scripts/aiinsight.cjs config list                         # 查看当前配置
node scripts/aiinsight.cjs config set engines.exa.apiKey sk-xxx
node scripts/aiinsight.cjs config set engines.jina.url http://my-jina:3000
node scripts/aiinsight.cjs config set proxy.url http://proxy:8080
node scripts/aiinsight.cjs config path                         # 配置文件路径
```
配置文件：`~/.aiinsight/config.json`（可用 `AIINSIGHT_CONFIG` env 覆盖路径）。明文存 key，注意文件权限。加载优先级：命令行 flag > JSON 文件 > env（兼容兜底）> default。

---

## 采集策略（通用，各 Lens 会在此基础上加视角特有策略）
- **多维度拆解**：把主题拆成若干维度分别检索，别指望一次命中。
- **跨源验证**：同一结论至少 2 个相互独立来源 = 强信号；单一来源 = 待验证。
- **权威分级**：专利、标准、官方规格页 > 评测/拆解/用户反馈 > 厂商营销页/软文（后者只能当「立场」非「事实」）。
- **时效分层**：优先近 7 天/30 天标注「最新」；30 天以上只作「历史背景」，绝不把旧闻包装成新发现。
- **深读关键信号**：决定结论的来源用 `extract_content` / `extract` 深读，确认语境未被摘要扭曲。
- **降级**：某引擎不可用就退到其他已配置引擎；全部失败如实告知，不硬凑。
