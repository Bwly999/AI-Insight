/**
 * 采集器 SPI 契约 —— ICollector。
 * 见 doc/design-doc/05-可插拔SPI设计.md §5.1。
 *
 * 所有采集器（RSS / SEARCH_API / SEARCH_CRAWL / WEB_SCRAPER(预留)）
 * 实现同一接口；调度时按 Source.type 查表调用，核心代码无需改动。
 */

/** 采集产出的原始项（尚未去重入库）。 */
export interface RawItemInput {
  sourceCode: string;
  url: string;
  title: string;
  rawText?: string;
  publishedAt?: Date;
  meta?: Record<string, unknown>;
}

/** 源配置（传给采集器的入参）。 */
export interface SourceConfig {
  code: string;
  /** 'RSS' | 'SEARCH_API' | 'SEARCH_CRAWL' | 'WEB_SCRAPER' | 自定义 */
  type: string;
  /** 该源特有参数：feed url / endpoint / 选择器 / api key（已解密）等。 */
  config: Record<string, unknown>;
}

/** 健康检查结果（可选实现）。 */
export interface CollectorHealth {
  ok: boolean;
  detail?: string;
}

/** 采集器接口。 */
export interface ICollector {
  /** 类型标识，与 SourceType 对应。 */
  readonly type: string;
  /** 拉取一批原始项。 */
  fetch(source: SourceConfig): Promise<RawItemInput[]>;
  /** 可选健康检查（管理端通道/源测试用）。 */
  health?(source: SourceConfig): Promise<CollectorHealth>;
}
