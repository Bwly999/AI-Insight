/**
 * config 命令集成测试 — 端到端验证 set/get/list/path 操作真实临时文件。
 *
 * 用 AIINSIGHT_CONFIG 指向临时目录，避免污染真实 ~/.aiinsight/。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configCommand } from "../src/commands/config.js";

let tmpDir: string;
let cfgPath: string;
const origEnv = process.env.AIINSIGHT_CONFIG;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cli-cfg-it-"));
  cfgPath = join(tmpDir, "config.json");
  process.env.AIINSIGHT_CONFIG = cfgPath;
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  if (origEnv === undefined) delete process.env.AIINSIGHT_CONFIG;
  else process.env.AIINSIGHT_CONFIG = origEnv;
});

/** 捕获 console.log 输出。 */
function captureLog(fn: () => number): { code: number; out: string } {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => lines.push(a.map(String).join(" "));
  let code = 1;
  try {
    code = fn();
  } finally {
    console.log = orig;
  }
  return { code, out: lines.join("\n") };
}

describe("config 集成: set/get 真实文件", () => {
  it("set 写入后文件存在且 get 读回一致", () => {
    let r = captureLog(() => configCommand(["set", "engines.exa.apiKey", "sk-1"]));
    expect(r.code).toBe(0);
    expect(existsSync(cfgPath)).toBe(true);

    r = captureLog(() => configCommand(["get", "engines.exa.apiKey"]));
    expect(r.out).toBe("sk-1");
  });

  it("set 多个 key 后 list 输出完整 JSON", () => {
    captureLog(() => configCommand(["set", "engines.exa.apiKey", "sk-1"]));
    captureLog(() => configCommand(["set", "engines.jina.url", "http://j:3000"]));
    captureLog(() => configCommand(["set", "proxy.url", "http://p:8080"]));

    const r = captureLog(() => configCommand(["list"]));
    const parsed = JSON.parse(r.out);
    expect(parsed.engines.exa.apiKey).toBe("sk-1");
    expect(parsed.engines.jina.url).toBe("http://j:3000");
    expect(parsed.proxy.url).toBe("http://p:8080");
  });

  it("get 未设置的 key 输出 (未设置)", () => {
    const r = captureLog(() => configCommand(["get", "engines.exa.apiKey"]));
    expect(r.out).toContain("未设置");
  });
});

describe("config 集成: path 命令", () => {
  it("path 输出 AIINSIGHT_CONFIG 指向的路径", () => {
    const r = captureLog(() => configCommand(["path"]));
    expect(r.out).toBe(cfgPath);
  });
});

describe("config 集成: 错误处理", () => {
  it("缺少 key 返回 exit 1", () => {
    const errLines: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => errLines.push(a.map(String).join(" "));
    const code = configCommand(["set"]);
    console.error = orig;
    expect(code).toBe(1);
    expect(errLines.join("\n")).toContain("用法");
  });

  it("未知子命令返回 exit 1", () => {
    const errLines: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => errLines.push(a.map(String).join(" "));
    const code = configCommand(["bogus"]);
    console.error = orig;
    expect(code).toBe(1);
    expect(errLines.join("\n")).toContain("未知子命令");
  });
});

describe("config 集成: 文件内容直接验证", () => {
  it("set 后磁盘文件内容正确（点号路径展开为嵌套对象）", () => {
    captureLog(() => configCommand(["set", "engines.firecrawl.apiKey", "sk-fc"]));
    const raw = readFileSync(cfgPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.engines.firecrawl.apiKey).toBe("sk-fc");
  });

  it("set 自动推断类型：boolean / number", () => {
    captureLog(() => configCommand(["set", "engines.arxiv.enabled", "true"]));
    captureLog(() => configCommand(["set", "defaults.limit", "10"]));
    const raw = readFileSync(cfgPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.engines.arxiv.enabled).toBe(true);
    expect(parsed.defaults.limit).toBe(10);
  });
});
