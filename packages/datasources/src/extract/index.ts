/**
 * 提取出入口 — extractContent() fallback 链（对齐原 extract.ts 行为）。
 *
 * 见 docs/design/skills-融合-cli-通用数据源能力.md §4.4。
 *
 * fallback 链：jina → firecrawl → local。任一成功即返回。
 * 每个引擎缺 key 或抛错则降级到下一个。
 *
 * 内部用注册表 createExtractEngines()；向后兼容：保留 extractContent(url) 签名。
 */
import { engineConfigFromEnv, type EngineConfig } from "../config.js";
import { createExtractEngines } from "../registry.js";
import type { ExtractEngine, ExtractInput, ExtractResult } from "./types.js";

export type { ExtractEngine, ExtractInput, ExtractResult } from "./types.js";
export { JinaExtractor } from "./jina.js";
export { FirecrawlExtractor } from "./firecrawl.js";
export { LocalExtractor } from "./local.js";

/**
 * 提取正文：按 fallback 链（注册表顺序）逐引擎尝试，任一成功即返回。
 * 每个引擎缺 key（isConfigured()=false）或抛错则降级到下一个。
 *
 * @param url 要提取正文的 URL
 * @param cfg 注入配置；不传则从 process.env 构造（兼容现有 .env.local）
 */
export async function extractContent(
  url: string,
  cfg: EngineConfig = engineConfigFromEnv(),
): Promise<ExtractResult> {
  const engines = createExtractEngines(cfg).filter((e) => e.isConfigured());
  return extractContentWith(url, engines);
}

/**
 * 用指定的引擎链提取正文（供 CLI --engine all 调用）。
 * 引擎按给定顺序逐个尝试。
 */
export async function extractContentWith(
  url: string,
  engines: ExtractEngine[],
  params?: Record<string, unknown>,
): Promise<ExtractResult> {
  if (engines.length === 0) {
    throw new Error("extract: no configured engine available");
  }
  const errors: string[] = [];
  for (const e of engines) {
    try {
      const input: ExtractInput = { url, params };
      return await e.extract(input);
    } catch (err) {
      errors.push(`${e.name}: ${(err as Error).message}`);
    }
  }
  throw new Error(`extract_content 全部失败: ${errors.join(" | ")}`);
}

/** 按 cfg 构造提取引擎链（公开供 CLI 用）。 */
export function buildExtractEngines(cfg: EngineConfig): ExtractEngine[] {
  return createExtractEngines(cfg);
}
