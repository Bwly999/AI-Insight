# 领域文档

工程技能在探索代码库时应如何消费本仓库的领域文档。

## 探索前请先阅读

- 仓库根目录下的 **`CONTEXT.md`**，或
- 仓库根目录下的 **`CONTEXT-MAP.md`**（如存在）——它指向各上下文的 `CONTEXT.md`。阅读与当前主题相关的每份文件。
- **`docs/adr/`**——阅读与你即将处理的区域相关的 ADR。在多上下文仓库中，还需检查 `src/<context>/docs/adr/` 中的上下文级决策记录。

如果这些文件不存在，**继续执行即可**。不要提示缺失，也不要建议预先创建它们。`/domain-modeling` 技能（通过 `/grill-with-docs` 和 `/improve-codebase-architecture` 调用）会在术语或决策实际需要记录时才惰性创建这些文件。

## 文件结构

单一上下文仓库（大多数仓库）：

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

多上下文仓库（根目录存在 `CONTEXT-MAP.md`）：

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← 系统级决策
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← 上下文级决策
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## 使用词汇表中的术语

当你的输出命名一个领域概念时（在问题标题、重构提案、假设、测试名称中），请使用 `CONTEXT.md` 中定义的术语。不要偏离到词汇表明确避免的同义词。

如果你需要的概念不在词汇表中，这是一个信号——要么你在创造项目未使用的语言（重新考虑），要么存在真正的空白（记下来交给 `/domain-modeling`）。

## 标记 ADR 冲突

如果你的输出与现有 ADR 矛盾，请明确提出来，而不是默默覆盖：

> _与 ADR-0007（事件溯源订单）存在矛盾——但值得重新讨论，因为……_
