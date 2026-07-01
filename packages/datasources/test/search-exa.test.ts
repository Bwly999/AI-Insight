/**
 * Exa 引擎测试 — mock postJson，验证请求体/响应映射/isConfigured/params 透传。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const postJsonMock = vi.fn();
vi.mock("../src/http.js", () => ({
  postJson: (...args: unknown[]) => postJsonMock(...args),
}));

const { ExaEngine } = await import("../src/search/exa.js");

const EXA_RESPONSE = {
  results: [
    {
      title: "AI Agents Explained",
      url: "https://example.com/agents",
      id: "abc123",
      publishedDate: "2025-06-01T00:00:00Z",
      text: "A deep dive into agents",
      author: "Author Name",
      score: 0.95,
    },
    {
      title: "Second Result",
      url: "https://second.com",
      publishedDate: "2025-05-01T00:00:00Z",
    },
  ],
  requestId: "req-1",
};

beforeEach(() => {
  postJsonMock.mockReset();
});

describe("ExaEngine: isConfigured", () => {
  it("有 key 时 isConfigured=true", () => {
    expect(new ExaEngine({ exaApiKey: "sk-xxx" }).isConfigured()).toBe(true);
  });

  it("无 key 时 isConfigured=false（扇出会跳过）", () => {
    expect(new ExaEngine({}).isConfigured()).toBe(false);
    expect(new ExaEngine({ exaApiKey: "" }).isConfigured()).toBe(false);
  });
});

describe("ExaEngine: 响应映射", () => {
  it("把 Exa results 映射为 DataSourceItem", async () => {
    postJsonMock.mockResolvedValue(EXA_RESPONSE);
    const items = await new ExaEngine({ exaApiKey: "k" }).search({
      query: "AI",
      limit: 5,
    });

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("AI Agents Explained");
    expect(items[0].url).toBe("https://example.com/agents");
    expect(items[0].sourceId).toBe("abc123");
    expect(items[0].summary).toBe("A deep dive into agents");
    expect(items[0].author).toBe("Author Name");
    expect(items[0].publishedAt).toBe("2025-06-01T00:00:00Z");
    expect(items[0].sourceName).toBe("Exa");
    expect(items[0].sourceType).toBe("search");
  });

  it("score 映射为 heat（0-100，round）", async () => {
    postJsonMock.mockResolvedValue(EXA_RESPONSE);
    const items = await new ExaEngine({ exaApiKey: "k" }).search({ query: "AI" });
    expect(items[0].heat).toBe(95); // 0.95 * 100
    expect(items[1].heat).toBeUndefined(); // 第二项无 score
  });

  it("无 id 时用 url 作 sourceId", async () => {
    postJsonMock.mockResolvedValue({
      results: [{ title: "T", url: "https://x.com", score: 0.5 }],
    });
    const items = await new ExaEngine({ exaApiKey: "k" }).search({ query: "AI" });
    expect(items[0].sourceId).toBe("https://x.com");
  });

  it("空 title 时用 url 作 title", async () => {
    postJsonMock.mockResolvedValue({
      results: [{ url: "https://x.com" }],
    });
    const items = await new ExaEngine({ exaApiKey: "k" }).search({ query: "AI" });
    expect(items[0].title).toBe("https://x.com");
  });

  it("空 results 返回空数组", async () => {
    postJsonMock.mockResolvedValue({ results: [] });
    const items = await new ExaEngine({ exaApiKey: "k" }).search({ query: "AI" });
    expect(items).toEqual([]);
  });
});

describe("ExaEngine: 请求构造", () => {
  it("POST 到 api.exa.ai/search，带 x-api-key 头", async () => {
    postJsonMock.mockResolvedValue({ results: [] });
    await new ExaEngine({ exaApiKey: "sk-xxx" }).search({ query: "AI", limit: 7 });

    const [url, body, opts] = postJsonMock.mock.calls[0];
    expect(url).toBe("https://api.exa.ai/search");
    expect(body.numResults).toBe(7);
    expect(body.query).toBe("AI");
    expect(opts.headers["x-api-key"]).toBe("sk-xxx");
  });

  it("limit 上限为 10", async () => {
    postJsonMock.mockResolvedValue({ results: [] });
    await new ExaEngine({ exaApiKey: "k" }).search({ query: "AI", limit: 50 });
    expect(postJsonMock.mock.calls[0][1].numResults).toBe(10);
  });

  it("默认 type=auto", async () => {
    postJsonMock.mockResolvedValue({ results: [] });
    await new ExaEngine({ exaApiKey: "k" }).search({ query: "AI" });
    expect(postJsonMock.mock.calls[0][1].type).toBe("auto");
  });

  it("params.type=neural 覆盖默认", async () => {
    postJsonMock.mockResolvedValue({ results: [] });
    await new ExaEngine({ exaApiKey: "k" }).search({
      query: "AI",
      params: { type: "neural" },
    });
    expect(postJsonMock.mock.calls[0][1].type).toBe("neural");
  });

  it("timeRange 1m → startPublishedDate（ISO 日期）", async () => {
    postJsonMock.mockResolvedValue({ results: [] });
    await new ExaEngine({ exaApiKey: "k" }).search({ query: "AI", timeRange: "1m" });
    const startDate = postJsonMock.mock.calls[0][1].startPublishedDate;
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD
  });

  it("无 timeRange 时不设 startPublishedDate", async () => {
    postJsonMock.mockResolvedValue({ results: [] });
    await new ExaEngine({ exaApiKey: "k" }).search({ query: "AI" });
    expect(postJsonMock.mock.calls[0][1].startPublishedDate).toBeUndefined();
  });
});

describe("ExaEngine: 错误处理", () => {
  it("postJson 抛错时向上传播", async () => {
    postJsonMock.mockRejectedValue(new Error("401 unauthorized"));
    await expect(
      new ExaEngine({ exaApiKey: "bad" }).search({ query: "AI" }),
    ).rejects.toThrow("401 unauthorized");
  });

  it("无 key 时 search 直接返回空（不发请求）", async () => {
    const items = await new ExaEngine({}).search({ query: "AI" });
    expect(items).toEqual([]);
    expect(postJsonMock).not.toHaveBeenCalled();
  });
});
