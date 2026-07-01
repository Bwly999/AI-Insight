/**
 * fanoutSearch 集成测试 — 用 stub 引擎验证扇出编排逻辑。
 *
 * 不 mock http 层，直接造符合 SearchEngine 接口的对象，
 * 精准控制每个引擎的成功/失败/返回内容。
 */
import { describe, it, expect, vi } from "vitest";
import { fanoutSearch } from "../src/search/index.js";
import type { SearchEngine, SearchInput } from "../src/search/duckduckgo.js";
import type { DataSourceItem } from "@ai-insight/shared-types";

/** 造一个 stub 引擎。searchFn 控制返回内容；name/isConfigured 可配。 */
function stubEngine(
  name: string,
  searchFn: (input: SearchInput) => DataSourceItem[] | Promise<DataSourceItem[]>,
  configured = true,
): SearchEngine {
  // 包一层 async：确保抛错变成 rejected promise（allSettled 才能捕获），
  // 模拟真实引擎的 async 行为。
  return {
    name,
    label: name.toUpperCase(),
    isConfigured: () => configured,
    search: vi.fn(async (input: SearchInput) => searchFn(input)),
    paramsSchema: undefined,
  };
}

function item(url: string, title: string, sourceName: string, publishedAt?: string): DataSourceItem {
  return {
    id: `search:${sourceName}:${url}`,
    sourceType: "search",
    sourceName,
    sourceId: url,
    title,
    url,
    publishedAt,
    tags: [],
    fetchedAt: new Date().toISOString(),
  };
}

describe("fanoutSearch: 引擎筛选", () => {
  it("只调用 isConfigured=true 的引擎", async () => {
    const ok = stubEngine("a", () => [item("http://a", "A", "a")]);
    const notCfg = stubEngine("b", () => [item("http://b", "B", "b")], false);
    const r = await fanoutSearch({ query: "x" }, [ok, notCfg]);
    expect(ok.search).toHaveBeenCalled();
    expect(notCfg.search).not.toHaveBeenCalled();
    expect(r.perEngine).toEqual({ a: 1 });
  });

  it("opts.engines 过滤：只跑选中的引擎", async () => {
    const a = stubEngine("a", () => [item("http://a", "A", "a")]);
    const b = stubEngine("b", () => [item("http://b", "B", "b")]);
    const r = await fanoutSearch({ query: "x", engines: ["b"] }, [a, b]);
    expect(a.search).not.toHaveBeenCalled();
    expect(b.search).toHaveBeenCalled();
    expect(r.perEngine).toEqual({ b: 1 });
  });
});

describe("fanoutSearch: 并发 + 失败降级", () => {
  it("单引擎失败不阻断其他（allSettled）", async () => {
    const ok = stubEngine("ok", () => [item("http://ok", "OK", "ok")]);
    const bad = stubEngine("bad", () => {
      throw new Error("connect timeout");
    });
    const r = await fanoutSearch({ query: "x" }, [ok, bad]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].title).toBe("OK");
    expect(r.perEngine).toEqual({ ok: 1, bad: 0 });
  });

  it("所有引擎失败时返回空 items + perEngine 全 0", async () => {
    const a = stubEngine("a", () => {
      throw new Error("fail");
    });
    const b = stubEngine("b", () => {
      throw new Error("fail");
    });
    const r = await fanoutSearch({ query: "x" }, [a, b]);
    expect(r.items).toEqual([]);
    expect(r.perEngine).toEqual({ a: 0, b: 0 });
  });
});

describe("fanoutSearch: 合并 + 去重", () => {
  it("多引擎结果合并为扁平数组", async () => {
    const a = stubEngine("a", () => [item("http://a1", "A1", "a"), item("http://a2", "A2", "a")]);
    const b = stubEngine("b", () => [item("http://b1", "B1", "b")]);
    const r = await fanoutSearch({ query: "x" }, [a, b]);
    expect(r.items).toHaveLength(3);
  });

  it("跨引擎按 URL 去重（保留首个）", async () => {
    const a = stubEngine("a", () => [item("http://dup.com", "来自 A", "a")]);
    const b = stubEngine("b", () => [item("http://dup.com", "来自 B", "b")]);
    const r = await fanoutSearch({ query: "x" }, [a, b]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].title).toBe("来自 A"); // 保留首个
  });

  it("perEngine 统计各引擎命中数（去重前）", async () => {
    const a = stubEngine("a", () => [item("http://a1", "A1", "a"), item("http://dup", "A2", "a")]);
    const b = stubEngine("b", () => [item("http://dup", "B1", "b")]);
    const r = await fanoutSearch({ query: "x" }, [a, b]);
    // perEngine 是各引擎返回数（a=2, b=1），items 是去重后（2）
    expect(r.perEngine).toEqual({ a: 2, b: 1 });
    expect(r.items).toHaveLength(2);
  });
});

describe("fanoutSearch: 时间过滤", () => {
  it("timeRange 过滤掉早于时间窗的项（按 publishedAt）", async () => {
    const old = item("http://old", "旧", "a", "2020-01-01T00:00:00Z");
    const recent = item("http://new", "新", "a", new Date().toISOString());
    const a = stubEngine("a", () => [old, recent]);
    const r = await fanoutSearch({ query: "x", timeRange: "1w" }, [a]);
    expect(r.items.find((i) => i.title === "新")).toBeDefined();
    expect(r.items.find((i) => i.title === "旧")).toBeUndefined();
  });

  it("无 publishedAt 的项保留（无法判断时间）", async () => {
    const noDate = item("http://nodate", "无日期", "a");
    const a = stubEngine("a", () => [noDate]);
    const r = await fanoutSearch({ query: "x", timeRange: "1w" }, [a]);
    expect(r.items).toHaveLength(1);
  });
});

describe("fanoutSearch: params 透传", () => {
  it("opts.params[engineName] 透传到对应引擎的 input.params", async () => {
    const a = stubEngine("a", (input) => {
      expect(input.params).toEqual({ foo: "bar" });
      return [];
    });
    await fanoutSearch(
      { query: "x", params: { a: { foo: "bar" } } },
      [a],
    );
    expect(a.search).toHaveBeenCalled();
  });

  it("引擎未在 params 中时 input.params 为 undefined", async () => {
    const a = stubEngine("a", (input) => {
      expect(input.params).toBeUndefined();
      return [];
    });
    await fanoutSearch({ query: "x", params: { other: { x: 1 } } }, [a]);
  });
});

describe("fanoutSearch: 输入透传", () => {
  it("query / limit / tags 透传到引擎", async () => {
    const a = stubEngine("a", (input) => {
      expect(input.query).toBe("LLM");
      expect(input.limit).toBe(5);
      expect(input.tags).toEqual(["tech"]);
      return [];
    });
    await fanoutSearch(
      { query: "LLM", perEngineLimit: 5, tags: ["tech"] as never },
      [a],
    );
  });

  it("默认 perEngineLimit=8", async () => {
    const a = stubEngine("a", (input) => {
      expect(input.limit).toBe(8);
      return [];
    });
    await fanoutSearch({ query: "x" }, [a]);
  });
});
