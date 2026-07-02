/**
 * deriveBlocksFromMessages 单元测试 —— C 方案核心：从 session.messages 单一真相源派生有序块。
 *
 * 覆盖 grill 中确认的关键边界：
 *  - 思考→工具→思考→工具→回复 的多段交替（Pi 工具调用会打断 assistant message）
 *  - ToolResultMessage 按 toolCallId 回填 found / ok
 *  - durations Map 缺失 → 工具块不带耗时（优雅降级）
 *  - 空 TextContent 跳过
 *  - ask 作为普通 toolCall 派生（不再有 clarification 旁路）
 */
import { describe, it, expect } from "vitest";
import { deriveBlocksFromMessages, type MessageLike } from "../src/runner/executor.js";

describe("deriveBlocksFromMessages", () => {
  it("完整 AgentLoop：思考→搜索→思考→RSS→回复，按序派生并回填 found/ok/duration", () => {
    const messages: MessageLike[] = [
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "用户想了解折叠屏折痕。" },
          { type: "toolCall", id: "tc1", name: "search", arguments: { query: "foldable crease" } },
        ],
      },
      {
        role: "toolResult",
        toolCallId: "tc1",
        toolName: "search",
        details: { found: 12 },
        isError: false,
      },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "搜到12条，补RSS。" },
          { type: "toolCall", id: "tc2", name: "fetch_rss", arguments: { keywords: ["LLM"] } },
        ],
      },
      {
        role: "toolResult",
        toolCallId: "tc2",
        toolName: "fetch_rss",
        details: { found: 8 },
        isError: false,
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "## 报告\n结论…" }],
      },
    ];
    const durations = new Map([
      ["tc1", 1800],
      ["tc2", 1200],
    ]);

    const blocks = deriveBlocksFromMessages(messages, durations);

    expect(blocks).toEqual([
      { kind: "thinking", text: "用户想了解折叠屏折痕。" },
      { kind: "tool", toolCallId: "tc1", toolName: "search", args: { query: "foldable crease" }, found: 12, ok: true, durationMs: 1800 },
      { kind: "thinking", text: "搜到12条，补RSS。" },
      { kind: "tool", toolCallId: "tc2", toolName: "fetch_rss", args: { keywords: ["LLM"] }, found: 8, ok: true, durationMs: 1200 },
      { kind: "text", text: "## 报告\n结论…" },
    ]);
  });

  it("durations 缺失：工具块不带 durationMs（优雅降级，结构仍完整）", () => {
    const messages: MessageLike[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "tc1", name: "search", arguments: {} }],
      },
      { role: "toolResult", toolCallId: "tc1", toolName: "search", details: { found: 3 }, isError: false },
    ];
    const blocks = deriveBlocksFromMessages(messages, new Map());
    expect(blocks).toEqual([
      { kind: "tool", toolCallId: "tc1", toolName: "search", args: {}, found: 3, ok: true },
    ]);
  });

  it("工具失败：isError=true → ok=false", () => {
    const messages: MessageLike[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "tc1", name: "crawl", arguments: { url: "x" } }],
      },
      { role: "toolResult", toolCallId: "tc1", toolName: "crawl", isError: true },
    ];
    const blocks = deriveBlocksFromMessages(messages, new Map());
    expect(blocks[0]).toMatchObject({ kind: "tool", ok: false });
    expect(blocks[0]).not.toHaveProperty("found");
  });

  it("跳过空 TextContent（模型有时产空文本块）", () => {
    const messages: MessageLike[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "" },
          { type: "text", text: "实际内容" },
        ],
      },
    ];
    const blocks = deriveBlocksFromMessages(messages, new Map());
    expect(blocks).toEqual([{ kind: "text", text: "实际内容" }]);
  });

  it("ask 作为普通 toolCall 派生（question/options 在 arguments，不产 clarification）", () => {
    const messages: MessageLike[] = [
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "tc1",
            name: "ask",
            arguments: { question: "要哪个视角？", options: ["deep", "flash"] },
          },
        ],
      },
      {
        role: "toolResult",
        toolCallId: "tc1",
        toolName: "ask",
        isError: false,
      },
    ];
    const blocks = deriveBlocksFromMessages(messages, new Map());
    expect(blocks).toEqual([
      {
        kind: "tool",
        toolCallId: "tc1",
        toolName: "ask",
        args: { question: "要哪个视角？", options: ["deep", "flash"] },
        ok: true,
      },
    ]);
  });

  it("未知 content 类型被忽略（不报错、不产块）", () => {
    const messages: MessageLike[] = [
      {
        role: "assistant",
        content: [
          { type: "image", url: "x" }, // 未知类型
          { type: "text", text: "有效" },
        ],
      },
    ];
    const blocks = deriveBlocksFromMessages(messages, new Map());
    expect(blocks).toEqual([{ kind: "text", text: "有效" }]);
  });

  it("空 messages → 空块数组（persistBlocks 会兜底落 summary）", () => {
    expect(deriveBlocksFromMessages([], new Map())).toEqual([]);
  });

  it("ToolResultMessage 找不到对应 toolCall（孤儿结果）→ 忽略，不报错", () => {
    const messages: MessageLike[] = [
      { role: "toolResult", toolCallId: "orphan", toolName: "search", details: { found: 5 }, isError: false },
    ];
    expect(deriveBlocksFromMessages(messages, new Map())).toEqual([]);
  });
});
