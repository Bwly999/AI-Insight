/**
 * 引擎配置（EngineConfig）— 所有引擎的统一配置输入。
 *
 * 设计（见 docs/design/skills-融合-cli-通用数据源能力.md §4.1）：
 * 引擎不再直读 process.env，而是接受注入的 EngineConfig。
 * 这让 CLI（从 JSON 注入）与 server（从 DB/env 注入）共用同一份引擎代码。
 *
 * 加载优先级（CLI 独立跑）：命令行 flag > JSON > env(兼容兜底) > default。
 * server 路径完全不碰 CLI 的 JSON（模型 B：config 不相交）。
 */

/** 引擎配置：数据源 key / 自托管 URL / 代理等。 */
export interface EngineConfig {
  /** Exa 搜索 API key（x-api-key 认证）。 */
  exaApiKey?: string;
  /** Firecrawl API key（搜索 + 提取共用）。 */
  firecrawlApiKey?: string;
  /** Jina 自托管 URL（如 http://my-jina:3000）；留空用官方 r.jina.ai。 */
  jinaUrl?: string;
  /** Jina API key（可选，无 key 也能用，仅提升限流）。 */
  jinaApiKey?: string;
  /** arxiv API 无 key（公开）；保留字段以便未来扩展。 */
  arxivEnabled?: boolean;
  /** 出站代理 URL（undici 全局 dispatcher）。 */
  proxyUrl?: string;
}

/**
 * 从 process.env 构造 EngineConfig —— 兼容现有 .env.local 用户。
 * server 启动时调用此函数把 env 转成 EngineConfig 注入 datasources。
 * CLI 仅在 JSON 未覆盖时作为 env 兜底调用。
 */
export function engineConfigFromEnv(env: NodeJS.ProcessEnv = process.env): EngineConfig {
  return {
    exaApiKey: env.EXA_API_KEY ?? "",
    firecrawlApiKey: env.FIRECRAWL_API_KEY ?? "",
    jinaUrl: env.JINA_URL ?? "", // 自托管；不传则引擎内回退 r.jina.ai
    jinaApiKey: env.JINA_API_KEY ?? "",
    proxyUrl: env.PROXY_URL ?? "",
    arxivEnabled: true,
  };
}

/** 空配置（所有引擎未配置 / isConfigured 返回 false）。用于测试桩。 */
export const EMPTY_ENGINE_CONFIG: EngineConfig = {};
