import { describe, it, expect } from "vitest";
import { parseEngineFlags, describeParams } from "../src/engine-flags.js";
import { arxivParamsSchema } from "@ai-insight/datasources";

const enabledAll = new Set(["arxiv", "exa", "ddg", "firecrawl"]);

describe("engine-flags: 命名空间 flag 解析（约定 b）", () => {
  it("解析 --engine.param=value 形式", () => {
    const { engineParams, rest } = parseEngineFlags(
      ["--arxiv.categories=cs.AI", "--exa.type=neural", "--limit", "5"],
      enabledAll,
      {},
    );
    expect(engineParams.arxiv.categories).toBe("cs.AI");
    expect(engineParams.exa.type).toBe("neural");
    // 非命名空间 flag 原样保留
    expect(rest).toEqual(["--limit", "5"]);
  });

  it("解析 --engine.param value（空格分隔）形式", () => {
    const { engineParams, rest } = parseEngineFlags(
      ["--arxiv.categories", "cs.AI", "--engines", "arxiv"],
      enabledAll,
      {},
    );
    expect(engineParams.arxiv.categories).toBe("cs.AI");
    expect(rest).toEqual(["--engines", "arxiv"]);
  });

  it("逗号分隔值自动转数组", () => {
    const { engineParams } = parseEngineFlags(
      ["--arxiv.categories=cs.AI,cs.CL"],
      enabledAll,
      {},
    );
    expect(engineParams.arxiv.categories).toEqual(["cs.AI", "cs.CL"]);
  });

  it("布尔/数字值自动推断", () => {
    const { engineParams } = parseEngineFlags(
      ["--exa.flag=true", "--exa.num=42"],
      enabledAll,
      {},
    );
    expect(engineParams.exa.flag).toBe(true);
    expect(engineParams.exa.num).toBe(42);
  });

  it("未启用引擎的命名空间 flag 抛错（静态校验）", () => {
    expect(() =>
      parseEngineFlags(["--unknown.param=x"], enabledAll, {}),
    ).toThrow(/未知或未启用的引擎命名空间/);
  });

  it("无命名空间 flag 时 rest 保留全部 argv", () => {
    const { engineParams, rest } = parseEngineFlags(
      ["--engines", "ddg", "--time", "1w", "AI Agent"],
      enabledAll,
      {},
    );
    expect(engineParams).toEqual({});
    expect(rest).toEqual(["--engines", "ddg", "--time", "1w", "AI Agent"]);
  });

  it("值为负数时不被误判为 flag", () => {
    const { engineParams } = parseEngineFlags(
      ["--exa.score", "-5"],
      enabledAll,
      {},
    );
    expect(engineParams.exa.score).toBe(-5);
  });
});

describe("engine-flags: describeParams（从 schema 反射）", () => {
  it("从 arxivParamsSchema 反射出 categories / sortBy / sortOrder", () => {
    const desc = describeParams(arxivParamsSchema);
    const names = desc.map((d) => d.name);
    expect(names).toContain("categories");
    expect(names).toContain("sortBy");
    expect(names).toContain("sortOrder");
  });

  it("无 schema 返回空数组", () => {
    expect(describeParams(undefined)).toEqual([]);
  });
});
