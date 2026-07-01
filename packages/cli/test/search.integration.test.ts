/**
 * search 命令集成测试 — 端到端验证 argv 路由、引擎选择、输出格式、错误码。
 *
 * mock 策略：拦截 @ai-insight/datasources 的 fanoutSearch / createSearchEngines /
 * listSearchEngineIds，避免真实网络，聚焦命令编排逻辑。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// mock datasources 模块（在 import 命令前定义）
const fanoutSearchMock = vi.fn();
const createSearchEnginesMock = vi.fn();
vi.mock("@ai-insight/datasources", () => ({
  fanoutSearch: (...args: unknown[]) => fanoutSearchMock(...args),
  createSearchEngines: (...args: unknown[]) => createSearchEnginesMock(...args),
  listSearchEngineIds: () => ["ddg", "exa", "firecrawl", "arxiv"],
}));

import { searchCommand } from "../src/commands/search.js";
import type { EngineConfig } from "@ai-insight/datasources";

const CFG: EngineConfig = { exaApiKey: "k", firecrawlApiKey: "k" };

/** 造一个已配置引擎实例（带 name/label/isConfigured）。 */
function engine(name: string, configured = true, paramsSchema?: unknown) {
  return {
    name,
    label: name.toUpperCase(),
    isConfigured: () => configured,
    search: vi.fn(),
    paramsSchema,
  };
}

/** arxiv categories 参数的数组型 schema（模拟 Type.Array，type="array"）。 */
const arxivSchema = {
  type: "object",
  properties: { categories: { type: "array" }, sortBy: { type: "string" }, sortOrder: { type: "string" } },
};

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fanoutSearchMock.mockReset();
  createSearchEnginesMock.mockReset();
  // createSearchEngines 返回全部 4 引擎（exa/firecrawl 已配置，模拟真实）
  createSearchEnginesMock.mockReturnValue([
    engine("ddg"),
    engine("exa"),
    engine("firecrawl"),
    engine("arxiv", true, arxivSchema),
  ]);
  fanoutSearchMock.mockResolvedValue({ items: [], perEngine: {} });
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
});

describe("search 集成: 引擎选择（逗号 vs 空格分隔）", () => {
  it("逗号分隔 --engines ddg,exa 正确解析为两个引擎", async () => {
    await searchCommand(["AI", "--engines", "ddg,exa"], CFG);
    const call = fanoutSearchMock.mock.calls[0][0];
    expect(call.engines).toEqual(["ddg", "exa"]);
    expect(call.query).toBe("AI");
  });

  it("空格分隔 --engines 'ddg exa' 也正确解析（pnpm exec 透传场景）", async () => {
    await searchCommand(["AI", "--engines", "ddg exa"], CFG);
    const call = fanoutSearchMock.mock.calls[0][0];
    expect(call.engines).toEqual(["ddg", "exa"]);
  });

  it("逗号+空格混合 'ddg, exa' 正确解析", async () => {
    await searchCommand(["AI", "--engines", "ddg, exa"], CFG);
    const call = fanoutSearchMock.mock.calls[0][0];
    expect(call.engines).toEqual(["ddg", "exa"]);
  });

  it("不传 --engines 时 engines=undefined（全部已配置）", async () => {
    await searchCommand(["AI"], CFG);
    const call = fanoutSearchMock.mock.calls[0][0];
    expect(call.engines).toBeUndefined();
  });
});

describe("search 集成: 命名空间 flag 透传", () => {
  it("--arxiv.categories 透传到 fanoutSearch 的 params.arxiv", async () => {
    await searchCommand(
      ["LLM", "--engines", "arxiv", "--arxiv.categories", "cs.AI,cs.CL"],
      CFG,
    );
    const call = fanoutSearchMock.mock.calls[0][0];
    expect(call.params.arxiv.categories).toEqual(["cs.AI", "cs.CL"]);
  });

  it("--exa.type=neural 透传到 params.exa.type", async () => {
    await searchCommand(["AI", "--engines", "exa", "--exa.type=neural"], CFG);
    const call = fanoutSearchMock.mock.calls[0][0];
    expect(call.params.exa.type).toBe("neural");
  });
});

describe("search 集成: 参数解析", () => {
  it("--time / --limit 正确解析", async () => {
    await searchCommand(["AI", "--time", "1w", "--limit", "5"], CFG);
    const call = fanoutSearchMock.mock.calls[0][0];
    expect(call.timeRange).toBe("1w");
    expect(call.perEngineLimit).toBe(5);
  });

  it("默认 limit=8", async () => {
    await searchCommand(["AI"], CFG);
    expect(fanoutSearchMock.mock.calls[0][0].perEngineLimit).toBe(8);
  });

  it("--tags 空格分隔也正确", async () => {
    await searchCommand(["AI", "--tags", "news tech"], CFG);
    expect(fanoutSearchMock.mock.calls[0][0].tags).toEqual(["news", "tech"]);
  });
});

describe("search 集成: 输出格式", () => {
  it("默认 json 输出完整结果", async () => {
    fanoutSearchMock.mockResolvedValue({
      items: [{ title: "T1", url: "http://x", sourceName: "ddg" }],
      perEngine: { ddg: 1 },
    });
    const code = await searchCommand(["AI", "--engines", "ddg"], CFG);
    expect(code).toBe(0);
    const out = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(out);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.perEngine).toEqual({ ddg: 1 });
  });

  it("--format table 走表格输出（含命中统计到 stderr）", async () => {
    fanoutSearchMock.mockResolvedValue({
      items: [{ title: "T1", url: "http://x", sourceName: "ddg" }],
      perEngine: { ddg: 1 },
    });
    const code = await searchCommand(["AI", "--format", "table"], CFG);
    expect(code).toBe(0);
    // table 模式 console.log 输出标题行
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain("T1");
  });
});

describe("search 集成: 错误处理与 exit code", () => {
  it("缺少 query 返回 exit 1", async () => {
    const code = await searchCommand(["--engines", "ddg"], CFG);
    expect(code).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("缺少查询词"));
  });

  it("未知引擎 id 返回 exit 1", async () => {
    const code = await searchCommand(["AI", "--engines", "nonexistent"], CFG);
    expect(code).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("未知引擎"));
  });

  it("未启用引擎的命名空间 flag 返回 exit 1", async () => {
    const code = await searchCommand(["AI", "--unknown.param", "x"], CFG);
    expect(code).toBe(1);
  });

  it("--list-engines 列出引擎（exit 0，不调 fanoutSearch）", async () => {
    const code = await searchCommand(["--list-engines"], CFG);
    expect(code).toBe(0);
    expect(fanoutSearchMock).not.toHaveBeenCalled();
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain("ddg");
    expect(logged).toContain("arxiv");
  });

  it("无已配置引擎可用时返回 exit 1", async () => {
    // 全部引擎未配置
    createSearchEnginesMock.mockReturnValue([
      engine("ddg", false),
      engine("exa", false),
    ]);
    const code = await searchCommand(["AI"], CFG);
    expect(code).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("没有已配置的引擎"));
  });
});
