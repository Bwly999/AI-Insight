/**
 * 提取引擎统一接口 — 见 docs/design/skills-融合-cli-通用数据源能力.md §4.2。
 *
 * 对齐 SearchEngine 形状：name / label / isConfigured / paramsSchema。
 * 当前 extract.ts 是三个散函数，本接口将其收成统一抽象，
 * 使 CLI（--engine）与 server（fallback 链）共用同一份引擎代码。
 */
import type { TSchema } from "@sinclair/typebox";

/** 提取结果（与原 extract.ts 的 ExtractResult 保持一致，向后兼容）。 */
export interface ExtractResult {
  url: string;
  title?: string;
  content: string; // markdown
  engine: string; // 引擎 id（如 "jina"）
}

/** 提取引擎输入。 */
export interface ExtractInput {
  /** 要提取正文的 URL。 */
  url: string;
  /** 引擎特有参数（由 CLI 从 --<engine>.<param> flag 解析注入；引擎自行解释）。 */
  params?: Record<string, unknown>;
}

/**
 * 提取引擎统一接口。
 *
 * `paramsSchema`：引擎特有参数的 TypeBox schema。
 * CLI 据此自动生成 `--<engine>.<param>` flag。无特有参数的引擎留空。
 */
export interface ExtractEngine {
  /** 引擎 id（用于 --engine 选项与注册表 key，如 "jina"）。 */
  readonly name: string;
  /** 展示名（如 "Jina Reader"）。 */
  readonly label: string;
  /** 是否已配置（local 永远 true；jina 无 key 也 true；firecrawl 缺 key 返回 false）。 */
  isConfigured(): boolean;
  /** 提取正文，返回 { url, title?, content, engine }。 */
  extract(input: ExtractInput): Promise<ExtractResult>;
  /** 引擎特有参数 schema（CLI 据此生成命名空间 flag）。 */
  readonly paramsSchema?: TSchema;
}
