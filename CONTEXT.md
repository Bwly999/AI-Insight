# AI-Insight 领域语言

本项目是部署于公司内网、用于行业咨询的 "AI For 洞察" 全栈系统。用户通过对话发起洞察，Agent 据意图调用数据源采集数据并综合，产出可导出的报告；并支持将一次洞察固化为定时任务重复执行。

## 语言

**Insight（洞察）**:
用户的情报意图，驱动一次洞察运行。由一段 prompt 与运行配置（数据源时间范围、标签偏好、可选 Lens 等）组成。
_Avoid_: 任务（运行层用 Insight Run）、监控（暗含 Signex 的持续 Watch；本项目为单次或定时重复，非持续盯盘）。

**Insight Run（洞察运行）**:
Insight 的一次执行，可手动触发或由 Schedule 定时触发。流式产出过程事件，最终生成一份 Report。状态：queued / running / completed / failed / interrupted。
_Avoid_: job、任务执行（口语可用，文档统一 Run）。

**Report（报告）**:
Insight Run 的核心交付产物，是一等公民：有 ID、有状态、可复访、可分享。有两种形态：**markdown 报告**（在 app 内渲染）与 **HTML 报告**（独立自包含「网页版本」，editorial 版式，可下载/分享）。一个 Conversation 是 Report 的「生产现场」，但 Report 独立于对话持久存在。v1 暂不做 PDF 导出。
_Avoid_: 结果、回答（回答是 Conversation 层概念；Report 是持久化产物）。

**Conversation（会话）**:
ChatGPT 式的对话线程，承载发起 Insight 的上下文。一条用户消息可触发一次 Insight Run。
_Avoid_: 聊天（口语可，文档统一 Conversation）。

**DataSource（数据源）**:
Agent 可调用的数据来源，分三类：搜索（多引擎聚合去重）、RSS（RSSHub + 公开订阅）、爬虫（各平台热点）。带标签（通用 / 新闻 / 学术…）以便 Agent 针对性调用，可启用 / 停用。Agent 调用数据源时即调用其对应的工具（搜索 / fetch_rss / 爬虫 / 正文提取）。
_Avoid_: 探针、源（统一 DataSource）。

**Schedule（定时任务）**:
把一个 Insight 配置为定时重复执行。到点自动创建一次 Insight Run 并产出 Report，可通知用户。
_Avoid_: cron、计划任务（口语可，文档统一 Schedule）。

**Lens（分析视角）** _(可选)_:
报告的分析风格维度，如 deep（综合）/ dual（正反研判）/ flash（速览）/ timeline（脉络）。作为 Insight 的可选参数；未指定时默认 deep。
_Avoid_: 视角（统一 Lens）。

## 显式不做（v1 范围外）

- **持续盯盘 / 记忆演进**：不做 Signex 那种 Watch 的持续监控与 memory.md 认知演进。本项目的「定时」是「同一 prompt 定时重跑」，每次 Run 独立。
- **Vault（沉淀库）**：不做跨 Insight 的知识沉淀库。
