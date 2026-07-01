/**
 * extract 命令集成测试 — 端到端验证 URL 路由、引擎链选择、输出格式、错误码。
 *
 * mock 策略：拦截 @ai-insight/datasources 的 extractContentWith / buildExtractEngines /
 * listExtractEngineIds，避免真实网络。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const extractContentWithMock = vi.fn();
const buildExtractEnginesMock = vi.fn();
vi.mock("@ai-insight/datasources", () => ({
  extractContentWith: (...args: unknown[]) => extractContentWithMock(...args),
  buildExtractEngines: (...args: unknown[]) => buildExtractEnginesMock(...args),
  listExtractEngineIds: () => ["jina", "firecrawl", "local"],
}));

import { extractCommand } from "../src/commands/extract.js";
import type { EngineConfig } from "@ai-insight/datasources";

const CFG: EngineConfig = { firecrawlApiKey: "k" };

function extEngine(name: string, configured = true) {
  return {
    name,
    label: name,
    isConfigured: () => configured,
    extract: vi.fn(),
    paramsSchema: undefined,
  };
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  extractContentWithMock.mockReset();
  buildExtractEnginesMock.mockReset();
  buildExtractEnginesMock.mockReturnValue([
    extEngine("jina"),
    extEngine("firecrawl"),
    extEngine("local"),
  ]);
  extractContentWithMock.mockResolvedValue({
    url: "http://x",
    title: "T",
    content: "正文",
    engine: "jina",
  });
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
});

describe("extract 集成: 引擎链选择", () => {
  it("默认 --engine all 走全部已配置引擎（fallback 链）", async () => {
    await extractCommand(["http://x.com"], CFG);
    // extractContentWith 第二参数是引擎链数组
    const chain = extractContentWithMock.mock.calls[0][1];
    expect(chain.map((e: { name: string }) => e.name)).toEqual(["jina", "firecrawl", "local"]);
    expect(extractContentWithMock.mock.calls[0][0]).toBe("http://x.com");
  });

  it("--engine jina 只用 jina", async () => {
    await extractCommand(["http://x.com", "--engine", "jina"], CFG);
    const chain = extractContentWithMock.mock.calls[0][1];
    expect(chain).toHaveLength(1);
    expect(chain[0].name).toBe("jina");
  });

  it("--engine local 只用 local", async () => {
    await extractCommand(["http://x.com", "--engine", "local"], CFG);
    const chain = extractContentWithMock.mock.calls[0][1];
    expect(chain).toHaveLength(1);
    expect(chain[0].name).toBe("local");
  });
});

describe("extract 集成: 输出格式", () => {
  it("默认 json 输出", async () => {
    const code = await extractCommand(["http://x.com"], CFG);
    expect(code).toBe(0);
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.engine).toBe("jina");
    expect(parsed.content).toBe("正文");
  });

  it("--format text 输出纯 markdown", async () => {
    const code = await extractCommand(["http://x.com", "--format", "text"], CFG);
    expect(code).toBe(0);
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toContain("# T");
    expect(logged).toContain("正文");
  });
});

describe("extract 集成: 错误处理", () => {
  it("缺少 URL 返回 exit 1", async () => {
    const code = await extractCommand(["--engine", "jina"], CFG);
    expect(code).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("缺少 URL"));
  });

  it("未知引擎返回 exit 1", async () => {
    const code = await extractCommand(["http://x.com", "--engine", "nonexistent"], CFG);
    expect(code).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("未知引擎"));
  });

  it("所有引擎未配置时返回 exit 1", async () => {
    buildExtractEnginesMock.mockReturnValue([
      extEngine("jina", false),
      extEngine("firecrawl", false),
      extEngine("local", false),
    ]);
    const code = await extractCommand(["http://x.com"], CFG);
    expect(code).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("没有已配置"));
  });

  it("extractContentWith 抛错时命令非零退出（向上抛）", async () => {
    extractContentWithMock.mockRejectedValue(new Error("全部失败"));
    await expect(extractCommand(["http://x.com"], CFG)).rejects.toThrow("全部失败");
  });
});
