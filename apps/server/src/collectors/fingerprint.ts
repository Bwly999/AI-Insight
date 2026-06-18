/**
 * 指纹去重工具 —— 算 fingerprint + dedupeKey。
 * 见 dev-spec 1A.3，验收 B6。
 */
import crypto from 'node:crypto';

export type FingerprintStrategy = 'url' | 'title' | 'source_id';

/** 跟踪参数黑名单（URL 归一化时移除） */
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'from', 'ref', 'source', 'spm', 'fbclid', 'gclid',
]);

/** URL 归一化：去 fragment / 跟踪参 / 端口 / trailing slash */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    // 去 fragment
    u.hash = '';
    // 去跟踪参，剩余参数按 key 字典序排序
    const params = [...u.searchParams.entries()]
      .filter(([k]) => !TRACKING_PARAMS.has(k))
      .sort(([a], [b]) => a.localeCompare(b));
    u.search = params.map(([k, v]) => `${k}=${v}`).join('&');
    // 小写 host + 移除默认端口
    if (u.protocol === 'https:' && u.port === '443') u.port = '';
    if (u.protocol === 'http:' && u.port === '80') u.port = '';
    u.hostname = u.hostname.toLowerCase();
    // 去 trailing slash（保留 path 为 '/' 的情况）
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    return u.toString();
  } catch {
    return raw; // 解析失败原样返回
  }
}

function sha16(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

export function fingerprint(args: {
  url?: string;
  title?: string;
  sourceCode?: string;
  sourceId?: string;
}): { fingerprint: string; dedupeKey: string; strategy: FingerprintStrategy } {
  if (args.url) {
    const norm = normalizeUrl(args.url);
    return {
      fingerprint: sha16(norm),
      dedupeKey: `url:${norm.slice(0, 40)}`,
      strategy: 'url',
    };
  }
  if (args.title) {
    const cleaned = args.title.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    return {
      fingerprint: sha16(cleaned),
      dedupeKey: `title:${cleaned.slice(0, 40)}`,
      strategy: 'title',
    };
  }
  if (args.sourceId || args.sourceCode) {
    const raw = `${args.sourceCode ?? ''}::${args.sourceId ?? ''}`;
    return {
      fingerprint: sha16(raw),
      dedupeKey: `source_id:${raw.slice(0, 40)}`,
      strategy: 'source_id',
    };
  }
  throw new Error('fingerprint: 至少需要 url / title / sourceId 之一');
}
