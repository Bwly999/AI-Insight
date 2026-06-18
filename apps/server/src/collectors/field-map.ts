/**
 * field-map 工具 —— SEARCH_API 采集器的 JSON 路径提取 + 字段映射。
 * 见 dev-spec 1A.4，验收 B3。
 */

/** 按点路径取值（如 'data.list'、'data.items[*]'） */
export function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    if (part === '*') continue; // 通配符在 extractItems 中处理
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** 从 root 中按 resultPath 取出数组 */
export function extractItems(root: unknown, resultPath: string): unknown[] {
  // 末段 [*] 通配 → 取上级数组
  const wildcardMatch = resultPath.match(/^(.*)\[\*\]$/);
  if (wildcardMatch) {
    const parentPath = wildcardMatch[1];
    const parent = getByPath(root, parentPath);
    if (Array.isArray(parent)) return parent;
    return [];
  }
  const val = getByPath(root, resultPath);
  if (Array.isArray(val)) return val;
  if (val != null) return [val];
  return [];
}

/** 按 fieldMap 映射每个 item，title/url 缺失则跳过 */
export function mapFields(
  items: unknown[],
  fieldMap: { title: string; url: string; publishedAt?: string; summary?: string },
): Array<{ title: string; url: string; publishedAt?: unknown; summary?: string }> {
  const result: Array<{ title: string; url: string; publishedAt?: unknown; summary?: string }> = [];
  for (const item of items) {
    const title = getByPath(item, fieldMap.title) as string | undefined;
    const url = getByPath(item, fieldMap.url) as string | undefined;
    if (!title || !url) continue;
    const entry: { title: string; url: string; publishedAt?: unknown; summary?: string } = {
      title,
      url,
    };
    if (fieldMap.publishedAt) {
      entry.publishedAt = getByPath(item, fieldMap.publishedAt);
    }
    if (fieldMap.summary) {
      entry.summary = getByPath(item, fieldMap.summary) as string | undefined;
    }
    result.push(entry);
  }
  return result;
}
