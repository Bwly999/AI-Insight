import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readConfig,
  writeConfig,
  getConfigValue,
  setConfigValue,
  toEngineConfig,
} from "../src/config-store.js";

let tmpDir: string;
const origEnv = process.env.AIINSIGHT_CONFIG;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "cli-cfg-"));
  process.env.AIINSIGHT_CONFIG = join(tmpDir, "config.json");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  if (origEnv === undefined) delete process.env.AIINSIGHT_CONFIG;
  else process.env.AIINSIGHT_CONFIG = origEnv;
});

describe("config-store: 读写 + 默认值", () => {
  it("文件不存在时返回默认空配置", () => {
    const cfg = readConfig();
    expect(cfg.engines).toEqual({});
    expect(cfg.proxy).toEqual({});
  });

  it("writeConfig 写入后 readConfig 读回一致", () => {
    const cfg = {
      engines: { exa: { apiKey: "sk-xxx", enabled: true } },
      proxy: { url: "http://p:8080" },
    };
    writeConfig(cfg);
    expect(existsSync(join(tmpDir, "config.json"))).toBe(true);
    const back = readConfig();
    expect(back.engines.exa?.apiKey).toBe("sk-xxx");
    expect(back.proxy?.url).toBe("http://p:8080");
  });

  it("自动创建不存在的父目录", () => {
    const nested = join(tmpDir, "nested", "deep", "config.json");
    process.env.AIINSIGHT_CONFIG = nested;
    writeConfig({ engines: {}, proxy: {}, defaults: {} });
    expect(existsSync(nested)).toBe(true);
  });
});

describe("config-store: 点号路径 get/set", () => {
  it("get 按点号路径取值", () => {
    const cfg = {
      engines: { exa: { apiKey: "sk-1" } },
      proxy: { url: "http://x" },
    };
    expect(getConfigValue(cfg, "engines.exa.apiKey")).toBe("sk-1");
    expect(getConfigValue(cfg, "proxy.url")).toBe("http://x");
    expect(getConfigValue(cfg, "engines.exa.enabled")).toBeUndefined();
    expect(getConfigValue(cfg, "nonexistent.path")).toBeUndefined();
  });

  it("set 自动创建中间对象（不可变更新）", () => {
    const cfg = { engines: {}, proxy: {}, defaults: {} };
    const next = setConfigValue(cfg, "engines.exa.apiKey", "sk-new");
    expect(next.engines.exa?.apiKey).toBe("sk-new");
    // 原对象未被修改
    expect(cfg.engines.exa).toBeUndefined();
  });

  it("set 自动推断类型：boolean / number", () => {
    const cfg = { engines: {}, proxy: {}, defaults: {} };
    const next1 = setConfigValue(cfg, "engines.arxiv.enabled", "true");
    expect(next1.engines.arxiv?.enabled).toBe(true);
    const next2 = setConfigValue(cfg, "defaults.limit", "8");
    expect(next2.defaults?.limit).toBe(8);
  });
});

describe("config-store: toEngineConfig (JSON > env 兜底)", () => {
  it("JSON 优先于 env", () => {
    process.env.EXA_API_KEY = "env-key";
    process.env.JINA_URL = "";
    const cfg = {
      engines: { exa: { apiKey: "json-key" } },
      proxy: { url: "" },
    };
    const ec = toEngineConfig(cfg);
    expect(ec.exaApiKey).toBe("json-key"); // JSON 覆盖 env
  });

  it("JSON 未设置时回退 env", () => {
    process.env.EXA_API_KEY = "env-key";
    process.env.FIRECRAWL_API_KEY = "";
    const cfg = { engines: {}, proxy: {} };
    const ec = toEngineConfig(cfg);
    expect(ec.exaApiKey).toBe("env-key"); // env 兜底
  });

  it("jina url 注入", () => {
    const cfg = {
      engines: { jina: { url: "http://my-jina:3000" } },
      proxy: {},
    };
    const ec = toEngineConfig(cfg);
    expect(ec.jinaUrl).toBe("http://my-jina:3000");
  });
});
