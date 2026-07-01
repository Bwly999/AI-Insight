/**
 * 引擎注册表（datasources 的心脏）— 见 docs/design/skills-融合-cli-通用数据源能力.md §4.3。
 *
 * 统一管理 SearchEngine / ExtractEngine 的构造。
 * 引擎构造接受注入的 EngineConfig（不再直读 process.env），
 * 使 CLI（JSON 注入）与 server（DB/env 注入）共用同一份引擎代码。
 *
 * 加引擎 = 实现接口 + 注册，CLI 主干零改动（命名空间 flag 由 paramsSchema 生成）。
 */
import type { EngineConfig } from "./config.js";
import type { SearchEngine } from "./search/index.js";
import type { ExtractEngine } from "./extract/index.js";
import { DuckDuckGoEngine, ExaEngine, FirecrawlEngine, ArxivEngine } from "./search/index.js";
import { JinaExtractor, FirecrawlExtractor, LocalExtractor } from "./extract/index.js";

// ─── 工厂类型 ──────────────────────────────────────────────────────────────────
export type SearchEngineFactory = (cfg: EngineConfig) => SearchEngine;
export type ExtractEngineFactory = (cfg: EngineConfig) => ExtractEngine;

// ─── 注册表 ────────────────────────────────────────────────────────────────────
const searchFactories = new Map<string, SearchEngineFactory>();
const extractFactories = new Map<string, ExtractEngineFactory>();

/** 注册一个搜索引擎工厂（按 id）。 */
export function registerSearchEngine(id: string, f: SearchEngineFactory): void {
  searchFactories.set(id, f);
}

/** 注册一个提取引擎工厂（按 id）。 */
export function registerExtractEngine(id: string, f: ExtractEngineFactory): void {
  extractFactories.set(id, f);
}

/** 列出已注册的搜索引擎 id。 */
export function listSearchEngineIds(): string[] {
  return Array.from(searchFactories.keys());
}

/** 列出已注册的提取引擎 id。 */
export function listExtractEngineIds(): string[] {
  return Array.from(extractFactories.keys());
}

/** 按 id 构造单个搜索引擎；未注册返回 undefined。 */
export function createSearchEngine(id: string, cfg: EngineConfig): SearchEngine | undefined {
  const f = searchFactories.get(id);
  return f ? f(cfg) : undefined;
}

/** 按 id 构造单个提取引擎；未注册返回 undefined。 */
export function createExtractEngine(id: string, cfg: EngineConfig): ExtractEngine | undefined {
  const f = extractFactories.get(id);
  return f ? f(cfg) : undefined;
}

/**
 * 按 cfg 构造全部已注册搜索引擎。
 * 返回的实例包含未配置的（isConfigured()=false），由调用方按需过滤。
 */
export function createSearchEngines(cfg: EngineConfig): SearchEngine[] {
  return Array.from(searchFactories.values()).map((f) => f(cfg));
}

/**
 * 按 cfg 构造全部已注册提取引擎（fallback 链顺序，与注册顺序一致）。
 * 返回的实例包含未配置的，由调用方按需过滤。
 */
export function createExtractEngines(cfg: EngineConfig): ExtractEngine[] {
  return Array.from(extractFactories.values()).map((f) => f(cfg));
}

// ─── 内置引擎注册（模块加载时自动执行）────────────────────────────────────────
// 搜索：ddg(无 key, needle 代理) / exa(x-api-key) / firecrawl(SDK key) / arxiv(公开 API)
// ddg 用 needle 而非 undici（绕开 Windows UV_HANDLE_CLOSING 崩溃），proxy 必须显式注入
registerSearchEngine("ddg", (cfg) => new DuckDuckGoEngine(cfg));
registerSearchEngine("exa", (cfg) => new ExaEngine(cfg));
registerSearchEngine("firecrawl", (cfg) => new FirecrawlEngine(cfg));
registerSearchEngine("arxiv", () => new ArxivEngine());

// 提取：jina(可自托管) / firecrawl(SDK key) / local(无依赖)
registerExtractEngine("jina", (cfg) => new JinaExtractor(cfg));
registerExtractEngine("firecrawl", (cfg) => new FirecrawlExtractor(cfg));
registerExtractEngine("local", () => new LocalExtractor());
