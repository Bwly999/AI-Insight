/**
 * DuckDuckGo 引擎测试 — mock needle，验证 HTML 解析/重定向解包/反爬检测/proxy 透传。
 *
 * 验证：needle 请求构造、浏览器 headers、anomalyDetectionBlock 检测、
 * cheerio 解析、uddg 重定向解包、limit 截断、proxy 透传、timeRange→df、错误处理。
 *
 * 零网络依赖：mock needle 模块 + 真实 DDG HTML 结构片段。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const needleMock = vi.fn();
vi.mock("needle", () => ({
  default: (...args: unknown[]) => needleMock(...args),
}));

// cheerio 不 mock（用真实 cheerio 解析 HTML fixture，验证解析逻辑正确）

const { DuckDuckGoEngine } = await import("../src/search/duckduckgo.js");

// 真实 DDG html 端点结构（简化但保留关键选择器）
const DDG_HTML = `
<div class="results">
  <div class="result">
    <h2><a href="https://example.com/ai">AI Agent Guide</a></h2>
    <a class="result__snippet" href="#">A guide to building AI agents</a>
  </div>
  <div class="result">
    <h2><a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Freal.com%2Fpage">Real URL Title</a></h2>
    <a class="result__snippet" href="#">Snippet text here</a>
  </div>
  <div class="result">
    <h2><a href="">Empty href (should be skipped)</a></h2>
  </div>
  <div class="result">
    <h2><a href="https://third.com">Third Result</a></h2>
  </div>
</div>`;

const ANOMALY_HTML = `<html><body><div class="anomalyDetectionBlock">被反爬拦截</div></body></html>`;

/** 造一个 needle 响应。 */
function needleRes(body: string, statusCode = 200) {
  return { body, statusCode };
}

beforeEach(() => {
  needleMock.mockReset();
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
  it("解析 div.result 项，归一化为 DataSourceItem", async () => {
    needleMock.mockResolvedValue(needleRes(DDG_HTML));
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 10 });

    expect(items).toHaveLength(3); // 空 href 那项被跳过
    expect(items[0].title).toBe("AI Agent Guide");
    expect(items[0].url).toBe("https://example.com/ai");
    expect(items[0].summary).toBe("A guide to building AI agents");
    expect(items[0].sourceName).toBe("DuckDuckGo");
    expect(items[0].sourceType).toBe("search");
  });

  it("解包 DDG 重定向 href（//duckduckgo.com/l/?uddg= 编码）", async () => {
    needleMock.mockResolvedValue(needleRes(DDG_HTML));
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 10 });
    const redirected = items.find((i) => i.title === "Real URL Title");
    expect(redirected).toBeDefined();
    // uddg 解包后指向真实 URL
    expect(redirected!.url).toBe("https://real.com/page");
  });

  it("跳过 title 或 href 为空的项", async () => {
    needleMock.mockResolvedValue(needleRes(DDG_HTML));
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 10 });
    expect(items.find((i) => i.title === "Empty href (should be skipped)")).toBeUndefined();
  });

  it("limit 截断结果数量", async () => {
    needleMock.mockResolvedValue(needleRes(DDG_HTML));
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 2 });
    expect(items).toHaveLength(2);
  });

  it("limit 上限为 10", async () => {
    needleMock.mockResolvedValue(needleRes(DDG_HTML));
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 100 });
    expect(items.length).toBeLessThanOrEqual(10);
  });

  it("空结果 HTML 返回空数组", async () => {
    needleMock.mockResolvedValue(needleRes("<div class='results'></div>"));
    const items = await new DuckDuckGoEngine().search({ query: "AI" });
    expect(items).toEqual([]);
  });

  it("过滤广告（class 含 result--ad 的 result 跳过）", async () => {
    // 真实 DDG 结构：广告 result 有 class "result--ad"，真实结果有 "web-result"
    const htmlWithAds = `
<div class="results">
  <div class="result results_links results_links_deep result--ad">
    <h2><a href="https://duckduckgo.com/y.js?ad_domain=sponsor.com">Sponsor Ad</a></h2>
    <a class="result__snippet" href="#">Ad snippet</a>
  </div>
  <div class="result results_links results_links_deep result--ad result--ad--small">
    <h2><a href="https://duckduckgo.com/y.js?ad_domain=ad2.com">Second Ad</a></h2>
  </div>
  <div class="result results_links results_links_deep web-result">
    <h2><a href="https://real-result.com/page">Real Result</a></h2>
    <a class="result__snippet" href="#">Real snippet</a>
  </div>
</div>`;
    needleMock.mockResolvedValue(needleRes(htmlWithAds));
    const items = await new DuckDuckGoEngine().search({ query: "AI", limit: 10 });
    // 广告被过滤，只保留真实结果
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Real Result");
    expect(items[0].url).toBe("https://real-result.com/page");
  });
});

describe("DuckDuckGoEngine: 反爬检测", () => {
  it("检测 anomalyDetectionBlock 并抛清晰错误", async () => {
    needleMock.mockResolvedValue(needleRes(ANOMALY_HTML, 200));
    await expect(
      new DuckDuckGoEngine().search({ query: "AI" }),
    ).rejects.toThrow("anomaly block");
  });

  it("非 200 状态码抛错（含状态码）", async () => {
    needleMock.mockResolvedValue(needleRes("", 202));
    await expect(
      new DuckDuckGoEngine().search({ query: "AI" }),
    ).rejects.toThrow("HTTP 202");
  });
});

describe("DuckDuckGoEngine: 请求构造（浏览器 headers + proxy）", () => {
  it("POST 到 html 端点，带浏览器 headers", async () => {
    needleMock.mockResolvedValue(needleRes(DDG_HTML));
    await new DuckDuckGoEngine().search({ query: "LLM agent" });

    const [method, url, data, opts] = needleMock.mock.calls[0];
    expect(method).toBe("post");
    expect(url).toBe("https://html.duckduckgo.com/html/");
    expect(data.q).toBe("LLM agent");
    // 浏览器级 headers（反爬关键）
    expect(opts.headers["User-Agent"]).toContain("Chrome/120");
    expect(opts.headers["Accept-Language"]).toBe("zh-CN,zh;q=0.9,en;q=0.8");
    expect(opts.follow).toBe(5);
  });

  it("有 proxyUrl 时 needleOpts.proxy 透传", async () => {
    needleMock.mockResolvedValue(needleRes(DDG_HTML));
    await new DuckDuckGoEngine({ proxyUrl: "http://127.0.0.1:7890" }).search({ query: "AI" });
    const opts = needleMock.mock.calls[0][3];
    expect(opts.proxy).toBe("http://127.0.0.1:7890");
  });

  it("无 proxyUrl 时不设 proxy", async () => {
    needleMock.mockResolvedValue(needleRes(DDG_HTML));
    await new DuckDuckGoEngine({}).search({ query: "AI" });
    const opts = needleMock.mock.calls[0][3];
    expect(opts.proxy).toBeUndefined();
  });

  it("timeRange 1w → df=w 参数", async () => {
    needleMock.mockResolvedValue(needleRes(DDG_HTML));
    await new DuckDuckGoEngine().search({ query: "AI", timeRange: "1w" });
    const data = needleMock.mock.calls[0][2];
    expect(data.df).toBe("w");
  });

  it("无 timeRange 时不设 df", async () => {
    needleMock.mockResolvedValue(needleRes(DDG_HTML));
    await new DuckDuckGoEngine().search({ query: "AI" });
    const data = needleMock.mock.calls[0][2];
    expect(data.df).toBeUndefined();
  });
});

describe("DuckDuckGoEngine: 错误处理", () => {
  it("needle 抛错时向上传播", async () => {
    needleMock.mockRejectedValue(new Error("connect timeout"));
    await expect(
      new DuckDuckGoEngine().search({ query: "AI" }),
    ).rejects.toThrow("connect timeout");
  });

  it("body 为 buffer 时也能解析（toString 兜底）", async () => {
    needleMock.mockResolvedValue({ body: Buffer.from(DDG_HTML), statusCode: 200 });
    const items = await new DuckDuckGoEngine().search({ query: "AI" });
    expect(items).toHaveLength(3);
  });
});

describe("DuckDuckGoEngine: tags", () => {
  it("无 tags 时默认空数组", async () => {
    needleMock.mockResolvedValue(needleRes(DDG_HTML));
    const items = await new DuckDuckGoEngine().search({ query: "AI" });
    expect(items[0].tags).toEqual([]);
  });

  it("传入 tags 时附加到每项", async () => {
    needleMock.mockResolvedValue(needleRes(DDG_HTML));
    const items = await new DuckDuckGoEngine().search({
      query: "AI",
      tags: ["tech", "general"] as never,
    });
    expect(items[0].tags).toEqual(["tech", "general"]);
  });
});
