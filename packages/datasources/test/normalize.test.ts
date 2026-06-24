import { describe, it, expect } from "vitest";
import { normalizeUrl, normalizeTitle, dedupeItems } from "../src/normalize.js";
import { timeRangeToMs, timeRangeToStartDate, timeRangeToDuckDf, filterByTimeRange } from "../src/time-range.js";

describe("normalizeUrl", () => {
  it("strips tracking params (utm_*, gclid, fbclid, spm)", () => {
    expect(
      normalizeUrl("https://example.com/a?utm_source=x&keep=1&gclid=zzz&fbclid=q"),
    ).toBe("https://example.com/a?keep=1");
  });

  it("lowercases scheme + host, keeps path case", () => {
    expect(normalizeUrl("HTTPS://Example.COM/Path")).toBe(
      "https://example.com/Path",
    );
  });

  it("strips trailing slash on non-root paths", () => {
    expect(normalizeUrl("https://example.com/a/b/")).toBe(
      "https://example.com/a/b",
    );
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("strips fragment", () => {
    expect(normalizeUrl("https://example.com/a#section")).toBe(
      "https://example.com/a",
    );
  });

  it("sorts query params (order-independent dedup key)", () => {
    expect(normalizeUrl("https://example.com/?b=2&a=1")).toBe(
      normalizeUrl("https://example.com/?a=1&b=2"),
    );
  });

  it("unwraps duckduckgo redirect (uddg)", () => {
    expect(
      normalizeUrl(
        "https://duckduckgo.com/l/?uddg=https%3A%2F%2Freal.com%2Fpage&rut=xx",
      ),
    ).toBe("https://real.com/page");
  });

  it("unwraps google news url param", () => {
    expect(
      normalizeUrl(
        "https://news.google.com/rss/articles?url=https%3A%2F%2Freal.com%2Fx",
      ),
    ).toBe("https://real.com/x");
  });

  it("returns lowercased original for invalid URL", () => {
    expect(normalizeUrl("not a url")).toBe("not a url");
  });
});

describe("normalizeTitle", () => {
  it("collapses whitespace and lowercases", () => {
    expect(normalizeTitle("  Hello   World  ")).toBe("hello world");
  });
});

describe("dedupeItems", () => {
  it("dedupes by normalized url", () => {
    const items = [
      { url: "https://example.com/a?utm_source=x", title: "A" },
      { url: "https://example.com/a", title: "A2" }, // same after normalize
    ];
    expect(dedupeItems(items)).toHaveLength(1);
  });

  it("dedupes by title when urls differ", () => {
    const items = [
      { url: "https://a.com/1", title: "Same Title" },
      { url: "https://b.com/2", title: "Same Title" },
    ];
    expect(dedupeItems(items)).toHaveLength(1);
  });

  it("keeps items with neither url nor title", () => {
    const items = [{ url: "", title: "" }, { url: "", title: "" }];
    expect(dedupeItems(items)).toHaveLength(2);
  });
});

describe("time-range helpers", () => {
  it("timeRangeToMs maps known ranges", () => {
    expect(timeRangeToMs("1d")).toBe(86_400_000);
    expect(timeRangeToMs("all")).toBeNull();
  });

  it("timeRangeToStartDate returns YYYY-MM-DD", () => {
    const d = timeRangeToStartDate("1d");
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("timeRangeToDuckDf maps to d/w/m/y", () => {
    expect(timeRangeToDuckDf("1d")).toBe("d");
    expect(timeRangeToDuckDf("1w")).toBe("w");
    expect(timeRangeToDuckDf("1m")).toBe("m");
    expect(timeRangeToDuckDf("1y")).toBe("y");
    expect(timeRangeToDuckDf("all")).toBeUndefined();
  });

  it("filterByTimeRange keeps recent, drops old, keeps no-date", () => {
    const now = Date.now();
    const items = [
      { publishedAt: new Date(now - 1000).toISOString() }, // recent
      { publishedAt: new Date(now - 40 * 86400000).toISOString() }, // 40d old
      {}, // no date
    ] as never;
    const out = filterByTimeRange(items, "1w");
    expect(out).toHaveLength(2); // recent + no-date, drop old
  });
});
