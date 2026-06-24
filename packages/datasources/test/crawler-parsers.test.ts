/**
 * 爬虫解析器单元测试 — 用固定 HTML fixture 验证选择器逻辑（不依赖网络）。
 * 确认从 newsnow 移植的解析器结构正确。
 */
import { describe, it, expect } from "vitest";
import { GitHubTrendingCrawler, parseStars } from "../src/crawler/github.js";
import { TencentCrawler, type TencentRes } from "../src/crawler/tencent.js";
import { scoreToHeat } from "../src/crawler/hackernews.js";

// 用 tsx-private fetch 的替代：重写类的 fetch 调用前，直接给 cheerio 一个固定 HTML。
// 由于 crawler 内部调 fetchText，这里通过 monkey-patch global.fetch 注入。
function stubFetch(html: string, status = 200) {
  global.fetch = (async () =>
    new Response(html, {
      status,
      headers: { "content-type": "text/html" },
    })) as never;
}

describe("heat & star helpers", () => {
  it("scoreToHeat is monotonic and bounded [0,100]", () => {
    expect(scoreToHeat(0)).toBe(0);
    expect(scoreToHeat(10)).toBeLessThan(scoreToHeat(100));
    expect(scoreToHeat(100)).toBeLessThan(scoreToHeat(512));
    expect(scoreToHeat(512)).toBe(Math.round(Math.log10(513) * 33)); // ≈ 89
    expect(scoreToHeat(1_000_000)).toBe(100); // capped
  });

  it("parseStars handles commas and k/m suffixes", () => {
    expect(parseStars("1,234")).toBe(1234);
    expect(parseStars("5.6k")).toBe(5600);
    expect(parseStars("1.2m")).toBe(1_200_000);
    expect(parseStars("")).toBe(0);
  });
});

describe("GitHubTrendingCrawler parser", () => {
  it("parses trending article rows", async () => {
    // 复刻 GitHub trending 的关键结构
    const html = `
      <html><body><main><div class="Box"><div data-hpc>
        <article class="Box-row">
          <h2><a href="/org/repo1">org/repo1</a></h2>
          <p>A great repo</p>
          <a href="/org/repo1/stargazers">1,234</a>
        </article>
        <article class="Box-row">
          <h2><a href="/org/repo2">org/repo2</a></h2>
          <p>Another repo</p>
          <a href="/org/repo2/stargazers">5.6k</a>
        </article>
      </div></div></main></body></html>`;
    stubFetch(html);
    const items = await new GitHubTrendingCrawler().fetch();
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("org/repo1");
    expect(items[0].url).toBe("https://github.com/org/repo1");
    expect(items[0].summary).toBe("A great repo");
    expect(items[0].hotText).toBe("✰ 1,234");
    expect(items[1].hotText).toBe("✰ 5.6k");
  });
});

describe("TencentCrawler parser", () => {
  it("parses articleList from getTagInfo response", async () => {
    const res: TencentRes = {
      data: {
        tabs: [
          {
            articleList: [
              { id: 1, title: "新闻一", desc: "摘要一", link_info: { url: "https://news.qq.com/a/1" } },
              { id: 2, title: "新闻二", desc: "摘要二", link_info: { url: "https://news.qq.com/a/2" } },
            ],
          },
        ],
      },
    };
    stubFetch(JSON.stringify(res));
    const items = await new TencentCrawler().fetch();
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("新闻一");
    expect(items[0].url).toBe("https://news.qq.com/a/1");
    expect(items[1].summary).toBe("摘要二");
  });
});
