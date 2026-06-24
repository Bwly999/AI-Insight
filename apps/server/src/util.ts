/**
 * 通用工具。
 */
import { randomBytes } from "node:crypto";

/** 带前缀的短随机 id（如 conv_xxxx）。 */
export function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

/** 从 prompt 提取标题（取前 24 字）。 */
export function deriveTitle(prompt: string): string {
  const t = prompt.trim().replace(/\s+/g, " ");
  return t.length > 24 ? `${t.slice(0, 24)}…` : t || "新洞察";
}
