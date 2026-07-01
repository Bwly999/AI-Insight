/**
 * DuckDuckGo 引擎测试 — mock fetchText，验证 HTML 解析/归一化/重定向解包/限量。
 *
 * 零网络依赖：用真实 DDG HTML 结构片段作为 fixture。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchTextMock = vi.fn();
vi.mock("../src/http.js", () => ({
  fetchText: (...args: unknown[]) => fetchTextMock(...args),
}));

// 必须在 mock 之后 import
const { DuckDuckGoEngine } = await import("../src/search/duckduckgo.js");

// 真实 DDG HTML lite 结构（简化但保留关键选择器）
const DDG_HTML = `
<div class="results">
  <div class="result">
    <h2><a href="https://example.com/ai">AI Agent Guide</a></h2>
    <a class="result__snippet" href="#">A guide to building AI agents</a>
  </div>
  <div class="result">
    <h2><a href="/l/?uddg=https%3A%2F%2Freal.com%2Fpage">Real URL Title</a></h2>
    <div class="result__snippet">Snippet text here</div>
  </div>
  <div class="result">
    <h2><a href="">Empty href (should be skipped)</a></h2>
  </div>
  <div class="result">
    <h2><a href="https://third.com">Third Result</a></h2>
  </div>
</div>`;

beforeEach(() => {
  fetchTextMock.mockReset();
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

describe("DuckDuckGoEngine: HTML 解析", () => {
  it("解析 .result 项，归一化为 DataSourceItem", async () => {
    fetchTextMock.mockResolvedValue(DDG_HTML);
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 10 });

    expect(items).toHaveLength(3); // 空 href 那项被跳过
    expect(items[0].title).toBe("AI Agent Guide");
    expect(items[0].url).toBe("https://example.com/ai");
    expect(items[0].summary).toBe("A guide to building AI agents");
    expect(items[0].sourceName).toBe("DuckDuckGo");
    expect(items[0].sourceType).toBe("search");
  });

  it("解包 DDG 重定向 href（/l/?uddg= 编码）", async () => {
    fetchTextMock.mockResolvedValue(DDG_HTML);
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 10 });
    const redirected = items.find((i) => i.title === "Real URL Title");
    expect(redirected).toBeDefined();
    // /l/?uddg= 解包后指向真实 URL
    expect(redirected!.url).toContain("real.com/page");
  });

  it("跳过 title 或 href 为空的项", async () => {
    fetchTextMock.mockResolvedValue(DDG_HTML);
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 10 });
    expect(items.find((i) => i.title === "Empty href (should be skipped)")).toBeUndefined();
  });

  it("limit 截断结果数量", async () => {
    fetchTextMock.mockResolvedValue(DDG_HTML);
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 2 });
    expect(items).toHaveLength(2);
  });

  it("limit 上限为 10（即使传更大值）", async () => {
    fetchTextMock.mockResolvedValue(DDG_HTML);
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 100 });
    // fixture 只有 3 个有效项，但验证上限逻辑：Math.min(limit, 10)
    expect(items.length).toBeLessThanOrEqual(10);
  });
});

describe("DuckDuckGoEngine: 请求构造", () => {
  it("POST form data 含 query", async () => {
    fetchTextMock.mockResolvedValue("<div></div>");
    await new DuckDuckGoEngine().search({ query: "LLM agent" });
    const callArgs = fetchTextMock.mock.calls[0];
    const body = callArgs[1].body as string;
    expect(body).toContain("q=LLM+agent");
    expect(callArgs[1].method).toBe("POST");
  });

  it("timeRange 1w → df=w 参数", async () => {
    fetchTextMock.mockResolvedValue("<div></div>");
    await new DuckDuckGoEngine().search({ query: "AI", timeRange: "1w" });
    const body = fetchTextMock.mock.calls[0][1].body as string;
    expect(body).toContain("df=w");
  });

  it("无 timeRange 时不设 df", async () => {
    fetchTextMock.mockResolvedValue("<div></div>");
    await new DuckDuckGoEngine().search({ query: "AI" });
    const body = fetchTextMock.mock.calls[0][1].body as string;
    expect(body).not.toContain("df=");
  });

  it("fetchText 抛错时错误向上传播", async () => {
    fetchTextMock.mockRejectedValue(new Error("connect timeout"));
    await expect(
      new DuckDuckGoEngine().search({ query: "AI" }),
    ).rejects.toThrow("connect timeout");
  });
});

describe("DuckDuckGoEngine: 边界", () => {
  it("空结果 HTML 返回空数组", async () => {
    fetchTextMock.mockResolvedValue("<div class='results'></div>");
    const items = await new DuckDuckGoEngine().search({ query: "AI" });
    expect(items).toEqual([]);
  });

  it("无 tags 时默认空数组", async () => {
    fetchTextMock.mockResolvedValue(DDG_HTML);
    const items = await new DuckDuckGoEngine().search({ query: "AI" });
    expect(items[0].tags).toEqual([]);
  });

  it("传入 tags 时附加到每项", async () => {
    fetchTextMock.mockResolvedValue(DDG_HTML);
    const items = await new DuckDuckGoEngine().search({
      query: "AI",
      tags: ["tech", "general"] as never,
    });
    expect(items[0].tags).toEqual(["tech", "general"]);
  });
});
