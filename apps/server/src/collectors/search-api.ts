/**
 * SearchApiCollector —— 搜索 API 型采集器。
 * 支持 mode='list'（拉列表）和 mode='query'（关键词搜索）。
 * 见 dev-spec 1A.6，验收 B3。
 */
import { Dispatcher } from 'undici';
import type { ICollector, RawItemInput, SourceConfig, CollectorHealth } from '@ai-insight/shared-types';
import type { CryptoUtil } from '../utils/crypto';
import { extractItems, mapFields } from './field-map';

interface SearchApiListConfig {
  mode: 'list';
  endpoint: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  resultPath: string;
  fieldMap: { title: string; url: string; publishedAt?: string; summary?: string };
  maxResults?: number;
}

interface SearchApiQueryConfig {
  mode: 'query';
  endpoint: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  apiKeyRef: string;
  apiKeyHeader?: string;
  queryField: string;
  queryTemplate?: string;
  resultPath: string;
  fieldMap: { title: string; url: string; publishedAt?: string; summary?: string };
  days?: number;
  maxResults?: number;
}

type SearchApiConfig = SearchApiListConfig | SearchApiQueryConfig;

function isQueryConfig(c: SearchApiConfig): c is SearchApiQueryConfig {
  return c.mode === 'query';
}

export class SearchApiCollector implements ICollector {
  readonly type = 'SEARCH_API';

  constructor(
    private http: Dispatcher,
    private crypto: CryptoUtil,
  ) {}

  async fetch(source: SourceConfig): Promise<RawItemInput[]> {
    const cfg = source.config as unknown as SearchApiConfig;
    if (!cfg.endpoint) throw new Error(`[SearchApiCollector/${source.code}] endpoint 未配置`);

    let url = cfg.endpoint;
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (compatible; AI-Insight/0.1; SearchAPI)',
      ...(cfg.headers ?? {}),
    };

    // mode='query' 处理 apiKey 和 query 参数
    if (isQueryConfig(cfg)) {
      let apiKey = '';
      if (cfg.apiKeyRef && source.config[cfg.apiKeyRef]) {
        const encKey = source.config[cfg.apiKeyRef] as string;
        try {
          apiKey = this.crypto.decrypt(encKey);
        } catch {
          throw new Error(`[SearchApiCollector/${source.code}] apiKey 解密失败`);
        }
      }
      if (apiKey) {
        const headerTemplate = cfg.apiKeyHeader ?? 'Authorization: Bearer ';
        const [hdr, prefix] = headerTemplate.includes(':')
          ? headerTemplate.split(':').map((s) => s.trim())
          : [headerTemplate, ''];
        headers[hdr] = `${prefix}${apiKey}`;
      }
      // 用 queryTemplate 渲染（当前用默认 keyword；后续可由 Agent 传入）
      const queryValue = cfg.queryTemplate
        ? cfg.queryTemplate.replace('{keyword}', 'latest')
        : '';
      if (queryValue) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}${cfg.queryField}=${encodeURIComponent(queryValue)}`;
      }
    } else {
      // mode='list' 直接调
    }

    // 发起 HTTP 请求
    const resp = await this.http.request({
      method: (cfg.method ?? 'GET') as 'GET' | 'POST',
      path: new URL(url).pathname + new URL(url).search,
      origin: new URL(url).origin,
      headers,
    });

    const statusCode = resp.statusCode ?? 0;
    if (statusCode === 401 || statusCode === 403) {
      throw new Error(`[SearchApiCollector/${source.code}] apiKey 无效 (HTTP ${statusCode})`);
    }
    if (statusCode >= 400) {
      throw new Error(`[SearchApiCollector/${source.code}] HTTP ${statusCode}`);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of resp.body) {
      chunks.push(Buffer.from(chunk));
    }
    const bodyStr = Buffer.concat(chunks).toString('utf-8');
    let body: unknown;
    try {
      body = JSON.parse(bodyStr);
    } catch {
      throw new Error(`[SearchApiCollector/${source.code}] 响应非 JSON`);
    }

    const items = extractItems(body, cfg.resultPath);
    const mapped = mapFields(items, cfg.fieldMap);
    const maxResults = cfg.maxResults ?? 50;

    return mapped.slice(0, maxResults).map((item) => {
      let publishedAt: Date | undefined;
      if (item.publishedAt != null) {
        const val = item.publishedAt;
        if (typeof val === 'number') {
          publishedAt = new Date(val > 1e12 ? val : val * 1000);
        } else if (typeof val === 'string') {
          const d = new Date(val);
          if (!isNaN(d.getTime())) publishedAt = d;
        }
      }
      return {
        sourceCode: source.code,
        url: item.url,
        title: item.title,
        rawText: item.summary,
        publishedAt,
      } as RawItemInput;
    });
  }

  async health(source: SourceConfig): Promise<CollectorHealth> {
    try {
      const cfg = source.config as unknown as SearchApiConfig;
      if (!cfg.endpoint) return { ok: false, detail: 'endpoint 未配置' };
      return { ok: true, detail: '接口已配置' };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  }
}
