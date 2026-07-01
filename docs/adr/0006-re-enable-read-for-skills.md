# 窄化 ADR-0003：为 skill 渐进披露重开 read 工具并沙箱化

ADR-0003 裁剪 pi-coding-agent 时把全部内置工具（含 `read`）禁掉，只留自定义数据源工具，确保无编码副作用。现在要把 `ai-insight` skill（4 种 Lens 的调研策略 / 输出框架 / 质量准则）接入 server 端 agent，需要 pi 的 skill 渐进披露机制：loader 把 skill **元数据**进 system prompt，模型用 `read` 按需打开 `SKILL.md` 与 `references/*.md`（pi 官方文档 `docs/skills.md` "How Skills Work" 明确此机制）。

`buildSystemPrompt` 有一道闸门 `customPromptHasRead = !selectedTools || selectedTools.includes("read")`——不含 `read` 则 skill 元数据不进 prompt。ADR-0003 的 `noTools:"builtin"` 把 read 也禁了，故 skill 机制无法工作。

**决策**：窄化（非推翻）ADR-0003 的"禁全部内置"为"**禁 bash/edit/write，保留 read**"。`read` 只读、无副作用，不构成执行/写入通道；其价值是让 4 种 Lens 方法论从 system prompt 常驻（重复、易漂移）下沉到 skill 文件按需加载（单一事实源，client/server 共用）。

**沙箱化**：read 不裸启用，而是用 pi 的 `createReadToolDefinition(cwd, { operations })` 注入自定义 `ReadOperations`——`readFile` / `access` 在 filesystem 级校验路径必须落在 `skillDir` 子树内（`relative(root, abs)` 不以 `..` 开头、非绝对），越界抛 `Permission denied`。read 工具以 customTool 形式注入（`noTools:"builtin"` 不变），工具名 `"read"` 使闸门通过。

**防全局泄漏**：loader 保持 `noSkills:true` + `additionalSkillPaths:[skillDir]`。pi 源码（`resource-loader.js` reload 分支）证明 `noSkills:true` 时 `loadSkills({includeDefaults:false})` 只加载显式 path，不扫 `cwd` / `agentDir` / `~/.agents/skills/`——开发机上的全局 skill（vue-best-practices / playwright-cli / find-docs 等）不会进 server prompt。

**风险**：模型理论上仍可对 read 传任意绝对路径，但 `operations.readFile` 会拒；且无 bash/edit/write，无法执行或外泄。生产部署的 skill 目录路径用 `AIINSIGHT_SKILL_DIR` env 覆盖；把 skill 打包进 agent 构建产物是后续 follow-up。
