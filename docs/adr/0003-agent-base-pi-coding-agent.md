# Agent 基座用 pi-coding-agent 裁剪，而非 pi-ai 直驱

Pi SDK 分两层：`@earendil-works/pi-ai`（底层 `stream/complete` + 工具 + 流式事件，需调用方自驱 loop）与 `@earendil-works/pi-coding-agent`（上层 session + 多轮 loop + 工具执行 + 事件订阅）。

采用 `pi-coding-agent` 的 `createAgentSession`，并通过 `DefaultResourceLoader` 覆盖（`systemPromptOverride` / `skillsOverride` / `agentsFilesOverride` / `promptsOverride` 全置空）+ `tools` 白名单传空（仅 `customTools`）**禁用全部内置 read/bash 工具与编码假设**，只保留自定义数据源工具；接内网 OpenAI 兼容 provider；`session.subscribe` 事件映射到 SSE。

coding-agent 免费提供多轮 loop、工具执行、session 管理与完整事件流，裁剪后无编码副作用，省去自写 loop。**风险**：需 early-spike 验证 headless 无工作区可行；若 `DefaultResourceLoader` 仍要求 cwd，指向一个空临时目录。
