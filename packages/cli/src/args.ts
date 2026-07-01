/**
 * argv 公共工具。
 *
 * parseListArg：把列表型 flag 值解析为字符串数组。
 *
 * 支持的分隔形式（兼容各种 shell / pnpm exec 透传分词）：
 *   "ddg,exa"      → ["ddg", "exa"]      （逗号分隔，文档主推）
 *   "ddg exa"      → ["ddg", "exa"]      （空格分隔，常见误写/透传）
 *   "ddg, exa"     → ["ddg", "exa"]      （逗号+空格混合）
 *   "cs.AI,cs.CL"  → ["cs.AI", "cs.CL"]  （含点号的 id 保留）
 *   "" / undefined → []
 */
export function parseListArg(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/) // 逗号或空格（含连续）都当分隔符
    .map((s) => s.trim())
    .filter(Boolean);
}
