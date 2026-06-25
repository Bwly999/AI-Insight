import { describe, it, expect } from "vitest";
import { createInsightTools } from "../src/tools.js";
import type { SearchEngine } from "@ai-insight/datasources";
import type { ConversationConfig, DataSourceItem } from "@ai-insight/shared-types";

const CFG: ConversationConfig = {
  timeRange: "1w",
  tagPrefs: ["tech"],
  lens: "deep",
};

function makeItem(n: number): DataSourceItem {
  return {
    id: `search:MockEngine:${n}`,
    sourceType: "search",
    sourceName: "MockEngine",
    sourceId: String(n),
    title: `result ${n}`,
    url: `https://example.com/${n}`,
    summary: `summary ${n}`,
    publishedAt: new Date().toISOString(),
    tags: [],
    fetchedAt: new Date().toISOString(),
  };
}

/** 假搜索引擎：忽略输入，返回 canned items。 */
function mockEngine(items: DataSourceItem[]): SearchEngine {
  return {
    name: "MockEngine",
    isConfigured: () => true,
    search: async () => items,
  };
}

/** 工具 execute 签名是 5 参（toolCallId, params, signal, onUpdate, ctx）；测试只用到前 2。 */
async function callTool(
  tools: ReturnType<typeof createInsightTools>,
  name: string,
  params: Record<string, unknown>,
): Promise<{ content: { text: string }[]; details: Record<string, unknown> }> {
  const tool = tools.find((t) => t.name === name) as unknown as {
    execute: (...args: unknown[]) => Promise<{
      content: { text: string }[];
      details: Record<string, unknown>;
    }>;
  };
  return tool.execute("call-1", params, undefined, undefined, undefined);
}

describe("createInsightTools", () => {
  it("返回 6 个工具，名字正确", () => {
    const tools = createInsightTools({
      config: CFG,
      rssFeeds: [],
      saveReport: async () => {},
    });
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "crawl",
      "extract_content",
      "fetch_rss",
      "list_datasources",
      "save_report",
      "search",
    ]);
  });

  it("search 用注入引擎，触发 onItems(items,'search') 并返回命中数", async () => {
    const items = [makeItem(1), makeItem(2)];
    const collected: { items: DataSourceItem[]; tool: string }[] = [];
    const tools = createInsightTools({
      config: CFG,
      engines: [mockEngine(items)],
      rssFeeds: [],
      saveReport: async () => {},
      onItems: (its, toolName) => collected.push({ items: its, tool: toolName }),
    });
    const res = await callTool(tools, "search", { query: "ai" });
    expect(collected).toHaveLength(1);
    expect(collected[0].tool).toBe("search");
    expect(collected[0].items).toHaveLength(2);
    expect(res.details.found).toBe(2);
    expect(res.content[0].text).toContain("result 1");
    expect(res.content[0].text).toContain("result 2");
  });

  it("save_report 调用 saveReport 回调，透传 title+markdown", async () => {
    let saved: { title: string; markdown: string } | null = null;
    const tools = createInsightTools({
      config: CFG,
      rssFeeds: [],
      saveReport: async (d) => {
        saved = d;
      },
    });
    await callTool(tools, "save_report", { title: "周报", markdown: "# 周报\n正文" });
    expect(saved).toEqual({ title: "周报", markdown: "# 周报\n正文" });
  });

  it("list_datasources 列出引擎/平台/RSS 源", async () => {
    const tools = createInsightTools({
      config: CFG,
      enabledPlatforms: ["hackernews", "weibo"],
      rssFeeds: [
        { feedUrl: "https://feed.example.com", sourceName: "ExampleFeed", tags: ["news"] },
      ],
      saveReport: async () => {},
    });
    const res = await callTool(tools, "list_datasources", {});
    const text = res.content[0].text;
    expect(text).toContain("DuckDuckGo");
    expect(text).toContain("hackernews");
    expect(text).toContain("ExampleFeed");
  });
});
