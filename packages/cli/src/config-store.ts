/**
 * CLI 本地配置存储（见 docs/design §6）。
 *
 * 选项 α：明文 JSON 存 key（exa/firecrawl key、jina url、proxy）。
 * 文件位置：~/.aiinsight/config.json（AIINSIGHT_CONFIG env 可覆盖）。
 *
 * 加载优先级（独立跑）：flag > JSON > env(兼容) > default。
 * server 路径完全不碰此文件（模型 B：config 不相交）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { engineConfigFromEnv, type EngineConfig } from "@ai-insight/datasources";

/** CLI config.json 的完整结构。 */
export interface CliConfig {
  engines: {
    exa?: { apiKey?: string; enabled?: boolean };
    firecrawl?: { apiKey?: string; enabled?: boolean };
    jina?: { url?: string; apiKey?: string };
    arxiv?: { enabled?: boolean };
  };
  proxy?: { url?: string };
  defaults?: {
    timeRange?: string;
    engines?: string[];
  };
}

const DEFAULT_CONFIG: CliConfig = {
  engines: {},
  proxy: {},
  defaults: {},
};

/** 解析 config.json 路径（AIINSIGHT_CONFIG 覆盖 ~/.aiinsight/config.json）。 */
export function configPath(): string {
  const override = process.env.AIINSIGHT_CONFIG;
  if (override) return resolve(override);
  return join(homedir(), ".aiinsight", "config.json");
}

/** 读取 config.json；不存在返回默认空配置。 */
export function readConfig(): CliConfig {
  const path = configPath();
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<CliConfig>;
    return {
      engines: { ...DEFAULT_CONFIG.engines, ...parsed.engines },
      proxy: { ...DEFAULT_CONFIG.proxy, ...parsed.proxy },
      defaults: { ...DEFAULT_CONFIG.defaults, ...parsed.defaults },
    };
  } catch (e) {
    throw new Error(`config: 解析失败 ${path}: ${(e as Error).message}`);
  }
}

/** 写入 config.json（自动建目录）。 */
export function writeConfig(cfg: CliConfig): void {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
}

/**
 * 点号路径取值：get("engines.exa.apiKey")。
 * 用于 `config get <key>`。
 */
export function getConfigValue(cfg: CliConfig, dotted: string): unknown {
  const parts = dotted.split(".");
  let cur: unknown = cfg;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

/**
 * 点号路径设值：set("engines.exa.apiKey", "sk-xxx")。
 * 用于 `config set <key> <value>`。返回新 config（不可变更新）。
 */
export function setConfigValue(cfg: CliConfig, dotted: string, value: string): CliConfig {
  const parts = dotted.split(".");
  // 简单标量推断：true/false → boolean；纯数字 → number
  let typed: unknown = value;
  if (value === "true") typed = true;
  else if (value === "false") typed = false;
  else if (/^\d+$/.test(value)) typed = Number(value);

  // 深克隆后写入
  const next = JSON.parse(JSON.stringify(cfg)) as CliConfig;
  let cur: Record<string, unknown> = next as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = typed;
  return next;
}

/**
 * 把 CliConfig 转成 EngineConfig（datasources 引擎构造用）。
 * 加载优先级：JSON 值存在 → 用 JSON；否则回退 env（兼容兜底）。
 */
export function toEngineConfig(cfg: CliConfig): EngineConfig {
  const env = engineConfigFromEnv();
  return {
    exaApiKey: cfg.engines.exa?.apiKey ?? env.exaApiKey,
    firecrawlApiKey: cfg.engines.firecrawl?.apiKey ?? env.firecrawlApiKey,
    jinaUrl: cfg.engines.jina?.url ?? env.jinaUrl,
    jinaApiKey: cfg.engines.jina?.apiKey ?? env.jinaApiKey,
    proxyUrl: cfg.proxy?.url ?? env.proxyUrl,
    arxivEnabled: cfg.engines.arxiv?.enabled ?? env.arxivEnabled,
  };
}
