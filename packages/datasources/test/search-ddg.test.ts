/**
 * DuckDuckGo 引擎测试 — mock duck-duck-scrape 的 search 函数。
 *
 * 验证：结果映射、timeRange→SearchTimeType 转换、proxy 透传（needleOptions）、
 * limit 截断、空结果、错误处理。
 *
 * 零网络依赖：mock duck-duck-scrape 模块。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const ddgSearchMock = vi.fn();
vi.mock("duck-duck-scrape", () => ({
  search: (...args: unknown[]) => ddgSearchMock(...args),
  SafeSearchType: { OFF: 1, MODERATE: -1, STRICT: -2 },
  SearchTimeType: { ALL: "a", DAY: "d", WEEK: "w", MONTH: "m", YEAR: "y" },
}));

const { DuckDuckGoEngine } = await import("../src/search/duckduckgo.js");

// 模拟 duck-duck-scrape 返回的 SearchResult 结构
const DDG_RESULTS = {
  noResults: false,
  vqd: "vqd-key",
  results: [
    {
      hostname: "example.com",
      url: "https://example.com/ai-agents",
      title: "AI Agents Guide",
      description: "A <b>guide</b> to building agents",
      rawDescription: "A guide to building agents",
      icon: "https://example.com/favicon.ico",
    },
    {
      hostname: "second.com",
      url: "https://second.com/page",
      title: "Second Result",
      description: "Second <b>result</b>",
      rawDescription: "Second result",
      icon: "",
    },
    {
      hostname: "third.com",
      url: "https://third.com",
      title: "Third Result",
      description: "Third",
      rawDescription: "Third",
      icon: "",
    },
  ],
};

beforeEach(() => {
  ddgSearchMock.mockReset();
});

describe("DuckDuckGoEngine: 基础属性", () => {
  it("name=ddg, label=DuckDuckGo", () => {
    const e = new DuckDuckGoEngine();
    expect(e.name).toBe("ddg");
    expect(e.label).toBe("DuckDuckGo");
  });

  it("isConfigured 永远 true（无 key）", () => {
    expect(new DuckDuckGoEngine().isConfigured()).toBe(true);
  });
});

describe("DuckDuckGoEngine: 结果映射", () => {
  it("把 duck-duck-scrape 结果映射为 DataSourceItem", async () => {
    ddgSearchMock.mockResolvedValue(DDG_RESULTS);
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 10 });

    expect(items).toHaveLength(3);
    expect(items[0].title).toBe("AI Agents Guide");
    expect(items[0].url).toBe("https://example.com/ai-agents");
    // rawDescription 优先（不含 <b> 标签干扰）
    expect(items[0].summary).toBe("A guide to building agents");
    expect(items[0].sourceName).toBe("DuckDuckGo");
    expect(items[0].sourceType).toBe("search");
    expect(items[0].sourceId).toBe("https://example.com/ai-agents");
  });

  it("limit 截断结果数量", async () => {
    ddgSearchMock.mockResolvedValue(DDG_RESULTS);
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 2 });
    expect(items).toHaveLength(2);
  });

  it("limit 上限为 10", async () => {
    ddgSearchMock.mockResolvedValue(DDG_RESULTS);
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 100 });
    expect(items.length).toBeLessThanOrEqual(10);
  });

  it("noResults=true 返回空数组", async () => {
    ddgSearchMock.mockResolvedValue({ noResults: true, vqd: "x", results: [] });
    const items = await new DuckDuckGoEngine().search({ query: "AI" });
    expect(items).toEqual([]);
  });

  it("空 results 返回空数组", async () => {
    ddgSearchMock.mockResolvedValue({ noResults: false, vqd: "x", results: [] });
    const items = await new DuckDuckGoEngine().search({ query: "AI" });
    expect(items).toEqual([]);
  });

  it("无 title 时用 url 作 title", async () => {
    ddgSearchMock.mockResolvedValue({
      noResults: false,
      vqd: "x",
      results: [{ url: "https://notitle.com", rawDescription: "d", description: "d", hostname: "h", icon: "" }],
    });
    const items = await new DuckDuckGoEngine().search({ query: "AI" });
    expect(items[0].title).toBe("https://notitle.com");
  });

  it("无 rawDescription 时回退 description", async () => {
    ddgSearchMock.mockResolvedValue({
      noResults: false,
      vqd: "x",
      results: [{ url: "https://x.com", title: "T", description: "fallback <b>desc</b>", rawDescription: "", hostname: "h", icon: "" }],
    });
    const items = await new DuckDuckGoEngine().search({ query: "AI" });
    expect(items[0].summary).toBe("fallback <b>desc</b>");
  });
});

describe("DuckDuckGoEngine: timeRange 转换", () => {
  it("timeRange 1d → SearchTimeType.DAY", async () => {
    ddgSearchMock.mockResolvedValue(DDG_RESULTS);
    await new DuckDuckGoEngine().search({ query: "AI", timeRange: "1d" });
    const searchOpts = ddgSearchMock.mock.calls[0][1];
    expect(searchOpts.time).toBe("d");
  });

  it("timeRange 1w → SearchTimeType.WEEK", async () => {
    ddgSearchMock.mockResolvedValue(DDG_RESULTS);
    await new DuckDuckGoEngine().search({ query: "AI", timeRange: "1w" });
    expect(ddgSearchMock.mock.calls[0][1].time).toBe("w");
  });

  it("timeRange 1m → SearchTimeType.MONTH", async () => {
    ddgSearchMock.mockResolvedValue(DDG_RESULTS);
    await new DuckDuckGoEngine().search({ query: "AI", timeRange: "1m" });
    expect(ddgSearchMock.mock.calls[0][1].time).toBe("m");
  });

  it("无 timeRange 时不传 time", async () => {
    ddgSearchMock.mockResolvedValue(DDG_RESULTS);
    await new DuckDuckGoEngine().search({ query: "AI" });
    expect(ddgSearchMock.mock.calls[0][1].time).toBeUndefined();
  });
});

describe("DuckDuckGoEngine: proxy 透传（绕开 undici 崩溃）", () => {
  it("有 proxyUrl 时构造 needleOptions.proxy", async () => {
    ddgSearchMock.mockResolvedValue(DDG_RESULTS);
    await new DuckDuckGoEngine({ proxyUrl: "http://127.0.0.1:7890" }).search({ query: "AI" });
    // 第三参数是 needleOptions
    const needleOpts = ddgSearchMock.mock.calls[0][2];
    expect(needleOpts.proxy).toBe("http://127.0.0.1:7890");
  });

  it("无 proxyUrl 时 needleOptions 为空对象（不传 proxy）", async () => {
    ddgSearchMock.mockResolvedValue(DDG_RESULTS);
    await new DuckDuckGoEngine({}).search({ query: "AI" });
    const needleOpts = ddgSearchMock.mock.calls[0][2];
    expect(needleOpts.proxy).toBeUndefined();
  });
});

describe("DuckDuckGoEngine: 请求构造", () => {
  it("query 作为第一参数", async () => {
    ddgSearchMock.mockResolvedValue(DDG_RESULTS);
    await new DuckDuckGoEngine().search({ query: "LLM agent" });
    expect(ddgSearchMock.mock.calls[0][0]).toBe("LLM agent");
  });

  it("默认 safeSearch=MODERATE", async () => {
    ddgSearchMock.mockResolvedValue(DDG_RESULTS);
    await new DuckDuckGoEngine().search({ query: "AI" });
    expect(ddgSearchMock.mock.calls[0][1].safeSearch).toBe(-1); // MODERATE
  });
});

describe("DuckDuckGoEngine: 错误处理", () => {
  it("duck-duck-scrape 抛错时向上传播", async () => {
    ddgSearchMock.mockRejectedValue(new Error("DDG anomaly detected"));
    await expect(
      new DuckDuckGoEngine().search({ query: "AI" }),
    ).rejects.toThrow("DDG anomaly detected");
  });
});

describe("DuckDuckGoEngine: tags", () => {
  it("无 tags 时默认空数组", async () => {
    ddgSearchMock.mockResolvedValue(DDG_RESULTS);
    const items = await new DuckDuckGoEngine().search({ query: "AI" });
    expect(items[0].tags).toEqual([]);
  });

  it("传入 tags 时附加到每项", async () => {
    ddgSearchMock.mockResolvedValue(DDG_RESULTS);
    const items = await new DuckDuckGoEngine().search({
      query: "AI",
      tags: ["tech", "general"] as never,
    });
    expect(items[0].tags).toEqual(["tech", "general"]);
  });
});
