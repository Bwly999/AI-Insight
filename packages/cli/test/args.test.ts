import { describe, it, expect } from "vitest";
import { parseListArg } from "../src/args.js";

describe("parseListArg: 列表 flag 分隔符解析", () => {
  it("逗号分隔", () => {
    expect(parseListArg("ddg,exa")).toEqual(["ddg", "exa"]);
  });

  it("空格分隔（pnpm exec 透传 / 常见误写）", () => {
    expect(parseListArg("ddg exa")).toEqual(["ddg", "exa"]);
  });

  it("逗号 + 空格混合", () => {
    expect(parseListArg("ddg, exa")).toEqual(["ddg", "exa"]);
    expect(parseListArg("ddg , exa")).toEqual(["ddg", "exa"]);
  });

  it("连续分隔符不产生空项", () => {
    expect(parseListArg("ddg,,  exa")).toEqual(["ddg", "exa"]);
    expect(parseListArg("  ddg   exa  ")).toEqual(["ddg", "exa"]);
  });

  it("含点号的 id（如 arxiv 分类）保留", () => {
    expect(parseListArg("cs.AI,cs.CL")).toEqual(["cs.AI", "cs.CL"]);
  });

  it("单项", () => {
    expect(parseListArg("ddg")).toEqual(["ddg"]);
  });

  it("空字符串 / undefined / null → 空数组", () => {
    expect(parseListArg("")).toEqual([]);
    expect(parseListArg(undefined)).toEqual([]);
    expect(parseListArg(null)).toEqual([]);
  });

  it("纯空白 → 空数组", () => {
    expect(parseListArg("   ")).toEqual([]);
    expect(parseListArg(" , , ")).toEqual([]);
  });
});
