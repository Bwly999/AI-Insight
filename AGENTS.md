## Agent 技能

### 问题追踪

本仓库的问题以本地 Markdown 文件形式存储在 `.scratch/<feature>/` 目录下。详见 `docs/agents/issue-tracker.md`。

### 分类标签

使用默认标签词汇（`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`）。详见 `docs/agents/triage-labels.md`。

### 领域文档

单一上下文布局。详见 `docs/agents/domain.md`。

### 设计上下文（Design Context）

前端 UI 工作以 `apps/web/` 为主要界面。设计意图有两份单一来源文件，动手改 UI 前先读：

- **`apps/web/PRODUCT.md`** — 战略层：register=product，用户=分析师/研究员，品牌=自信·精准·可追溯，战略方向（V2，2026-07）是"从克制锐利进化到自信张扬"——柠绿信号 + 仪器背景 + 信号发光，可访问性目标 WCAG AA。voice/战略冲突时以此为准。
- **`apps/web/DESIGN.md`** — 视觉层：双声调系统（柠绿 lime 工作台 Inter+Mono / 朱砂 editorial 报告 Fraunces）、仪器背景（mesh+grid）、信号发光（glow 仅限语义点）、仪器级可读性。色板/字体/组件 token 的规范源。视觉冲突时以此为准；与 PRODUCT.md 冲突时 PRODUCT.md 胜。

系统刻意拒绝 2026 AI 默认审美（奶油底、装饰性玻璃拟态、**装饰性**发光、渐变文字、卡片网格、eyebrow 满天飞）；仓库里 `unslop-ignore` 标记的每一处都是刻意决策（含 V2 的"信号发光"——它只标注 live/数据端点/关系节点等语义点，不是装饰氛围光），不要当 AI 语法"清理"掉。token 实际值见 `apps/web/src/style.css`，editorial 色板单一来源在 `packages/shared-ui/src/tokens.ts`。
