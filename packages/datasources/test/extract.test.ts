/**
 * 提取引擎测试 — mock fetchText（jina/local）与 firecrawl SDK，
 * 验证 jina/firecrawl/local 解析逻辑 + extractContent fallback 链。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchTextMock = vi.fn();
vi.mock("../src/http.js", () => ({
  fetchText: (...args: unknown[]) => fetchTextMock(...args),
}));

// mock firecrawl SDK
const scrapeUrlMock = vi.fn();
vi.mock("firecrawl", () => ({
  default: class FakeFirecrawlApp {
    constructor() {}
    scrapeUrl = (...args: unknown[]) => scrapeUrlMock(...args);
  },
}));

const { JinaExtractor, FirecrawlExtractor, LocalExtractor } = await import("../src/extract/index.js");
const { extractContent, extractContentWith, buildExtractEngines } = await import("../src/extract/index.js");

beforeEach(() => {
  fetchTextMock.mockReset();
  scrapeUrlMock.mockReset();
});

describe("JinaExtractor: 自托管 URL + 解析", () => {
  it("isConfigured 永远 true（无 key 也能用）", () => {
    expect(new JinaExtractor({}).isConfigured()).toBe(true);
    expect(new JinaExtractor({ jinaApiKey: "k" }).isConfigured()).toBe(true);
  });

  it("JSON 响应解析为 {title, content, engine}", async () => {
    fetchTextMock.mockResolvedValue(
      JSON.stringify({ data: { title: "T", content: "正文内容" } }),
    );
    const r = await new JinaExtractor({}).extract({ url: "https://x.com" });
    expect(r.title).toBe("T");
    expect(r.content).toBe("正文内容");
    expect(r.engine).toBe("jina");
    expect(r.url).toBe("https://x.com");
  });

  it("自托管 URL 注入（jinaUrl 优先于官方）", async () => {
    fetchTextMock.mockResolvedValue(JSON.stringify({ data: { content: "x" } }));
    await new JinaExtractor({ jinaUrl: "http://my-jina:3000" }).extract({
      url: "https://x.com",
    });
    const calledUrl = fetchTextMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("http://my-jina:3000");
  });

  it("无 jinaUrl 时用官方 r.jina.ai", async () => {
    fetchTextMock.mockResolvedValue(JSON.stringify({ data: { content: "x" } }));
    await new JinaExtractor({}).extract({ url: "https://x.com" });
    const calledUrl = fetchTextMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("r.jina.ai");
  });

  it("有 key 时带 Authorization 头", async () => {
    fetchTextMock.mockResolvedValue(JSON.stringify({ data: { content: "x" } }));
    await new JinaExtractor({ jinaApiKey: "sk-jina" }).extract({ url: "https://x.com" });
    const headers = fetchTextMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer sk-jina");
  });

  it("空 content 抛错（触发 fallback）", async () => {
    fetchTextMock.mockResolvedValue(JSON.stringify({ data: {} }));
    await expect(
      new JinaExtractor({}).extract({ url: "https://x.com" }),
    ).rejects.toThrow("empty content");
  });

  it("非 JSON（纯文本 markdown）也接受", async () => {
    fetchTextMock.mockResolvedValue("# 标题\n纯文本内容");
    const r = await new JinaExtractor({}).extract({ url: "https://x.com" });
    expect(r.content).toContain("纯文本内容");
    expect(r.engine).toBe("jina");
  });
});

describe("FirecrawlExtractor: SDK 调用 + 解析", () => {
  it("无 key 时 isConfigured=false", () => {
    expect(new FirecrawlExtractor({}).isConfigured()).toBe(false);
  });

  it("有 key 时 isConfigured=true", () => {
    expect(new FirecrawlExtractor({ firecrawlApiKey: "k" }).isConfigured()).toBe(true);
  });

  it("无 key 时 extract 抛错", async () => {
    await expect(
      new FirecrawlExtractor({}).extract({ url: "https://x.com" }),
    ).rejects.toThrow("no API key");
  });

  it("成功时返回 markdown", async () => {
    scrapeUrlMock.mockResolvedValue({
      success: true,
      markdown: "# 提取的正文",
      metadata: { title: "标题" },
    });
    const r = await new FirecrawlExtractor({ firecrawlApiKey: "k" }).extract({
      url: "https://x.com",
    });
    expect(r.content).toBe("# 提取的正文");
    expect(r.title).toBe("标题");
    expect(r.engine).toBe("firecrawl");
  });

  it("success=false 抛错", async () => {
    scrapeUrlMock.mockResolvedValue({ success: false, error: "blocked" });
    await expect(
      new FirecrawlExtractor({ firecrawlApiKey: "k" }).extract({ url: "https://x.com" }),
    ).rejects.toThrow("scrape failed");
  });

  it("空 markdown 抛错", async () => {
    scrapeUrlMock.mockResolvedValue({ success: true, markdown: "" });
    await expect(
      new FirecrawlExtractor({ firecrawlApiKey: "k" }).extract({ url: "https://x.com" }),
    ).rejects.toThrow("empty markdown");
  });
});

describe("LocalExtractor: 零依赖降级", () => {
  it("isConfigured 永远 true", () => {
    expect(new LocalExtractor().isConfigured()).toBe(true);
  });

  it("从 HTML 提取文本（去 script/style/nav）", async () => {
    const html = `
      <html><head><title>页面标题</title></head>
      <body>
        <script>var x = 1;</script>
        <style>.a { color: red; }</style>
        <nav>导航栏</nav>
        <p>真正的正文内容</p>
      </body></html>`;
    fetchTextMock.mockResolvedValue(html);
    const r = await new LocalExtractor().extract({ url: "https://x.com" });
    expect(r.title).toBe("页面标题");
    expect(r.content).toContain("真正的正文内容");
    expect(r.content).not.toContain("var x");
    expect(r.content).not.toContain("color: red");
    expect(r.content).not.toContain("导航栏");
    expect(r.engine).toBe("local");
  });
});

describe("extractContent: fallback 链（jina → firecrawl → local）", () => {
  it("jina 成功时直接返回，不调后续", async () => {
    fetchTextMock.mockResolvedValue(JSON.stringify({ data: { content: "jina ok" } }));
    const r = await extractContent("https://x.com", { firecrawlApiKey: "k" });
    expect(r.engine).toBe("jina");
    expect(scrapeUrlMock).not.toHaveBeenCalled();
  });

  it("jina 失败 → firecrawl 成功", async () => {
    fetchTextMock.mockResolvedValue(JSON.stringify({ data: {} })); // jina empty
    scrapeUrlMock.mockResolvedValue({ success: true, markdown: "fc ok" });
    const r = await extractContent("https://x.com", { firecrawlApiKey: "k" });
    expect(r.engine).toBe("firecrawl");
    expect(r.content).toBe("fc ok");
  });

  it("jina + firecrawl 都失败 → local 兜底", async () => {
    fetchTextMock
      .mockResolvedValueOnce(JSON.stringify({ data: {} })) // jina empty
      .mockResolvedValueOnce("<html><body>local 兜底内容</body></html>"); // local fetch
    // firecrawl 未配置（无 key）→ 跳过
    const r = await extractContent("https://x.com", {});
    expect(r.engine).toBe("local");
    expect(r.content).toContain("local 兜底内容");
  });

  it("全部失败时抛聚合错误", async () => {
    fetchTextMock.mockRejectedValue(new Error("network down"));
    // 无 key → firecrawl 跳过；local 也失败（fetchText 被拒）
    await expect(extractContent("https://x.com", {})).rejects.toThrow("全部失败");
  });
});

describe("extractContentWith: 指定引擎链", () => {
  it("按给定顺序尝试，首个成功即返回", async () => {
    const good = new LocalExtractor();
    vi.spyOn(good, "extract").mockResolvedValue({
      url: "u",
      content: "ok",
      engine: "local",
    });
    const r = await extractContentWith("u", [good]);
    expect(r.content).toBe("ok");
  });

  it("空引擎链抛错", async () => {
    await expect(extractContentWith("u", [])).rejects.toThrow("no configured engine");
  });
});

describe("buildExtractEngines: 按 cfg 构造链", () => {
  it("返回注册表全部引擎（jina/firecrawl/local）", () => {
    const chain = buildExtractEngines({});
    const names = chain.map((e) => e.name);
    expect(names).toEqual(["jina", "firecrawl", "local"]);
  });

  it("firecrawl 无 key 时 isConfigured=false（被 fallback 过滤）", () => {
    const chain = buildExtractEngines({});
    const fc = chain.find((e) => e.name === "firecrawl");
    expect(fc!.isConfigured()).toBe(false);
  });
});
