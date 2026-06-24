# 用户端 UI 原型 · 记录

**问题**：用户端（对话式洞察 app）该长什么样？
**原型**：`user-end.html` — 4 个结构/审美都截然不同的变体，同一份 mock 对话（一次「AI 编程工具赛道」洞察运行：工具调用 + 数据源 + 报告卡）。`?variant=a|b|c|d` 切换，底部浮动条 + ←/→ 键循环。

## 变体

| key | 名字 | 方向 |
|---|---|---|
| a | Atelier | 极简雅致 · 暖纸 · 单栏 · Instrument Serif + Hanken Grotesk |
| b | Workstation | 三栏分析台 · 致密 · 证据面板常驻 · IBM Plex |
| c | Console | 暗色情报台（自由设计）· 霓虹发光 · ticker · Unbounded + JetBrains Mono |
| d | Dispatch | 报刊编辑 · 忠实 ref/v2-editorial.html · Fraunces + 朱红/芥末 |

## 裁决（待填）

> 选定：`__`（key）
> 理由：
> 要不要嫁接别的变体的局部（如「B 的证据面板 + D 的报告版式」）：

填好后：删除其余变体与 switcher，把胜出者折进真实 `apps/web`（按 vue-best-practices 重写，**不要直接拿原型上线**）。
