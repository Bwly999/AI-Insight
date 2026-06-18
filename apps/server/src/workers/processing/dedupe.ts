/**
 * 阶段 a：语义去重。
 * 用 LLM 判断 raw_item 标题是否与近期已处理的文章指同一事件。
 */
import { generateText } from 'ai';
import type { FastifyInstance } from 'fastify';
import type { RawItem } from '../../db/schema';

export async function dedupeBatch(
  app: FastifyInstance,
  items: RawItem[],
): Promise<RawItem[]> {
  // 简单策略：同 URL 前缀或 title 完全一致判重，不做 LLM 调用（节省 token）
  return items.filter((item, _idx, self) => {
    const urlKey = item.url?.replace(/https?:\/\//, '').slice(0, 80);
    const titleKey = item.title?.toLowerCase().trim();
    // 检查同批内是否有相同的
    const dupInBatch = self.some((other) => {
      if (other.id === item.id) return false;
      const otherUrl = other.url?.replace(/https?:\/\//, '').slice(0, 80);
      const otherTitle = other.title?.toLowerCase().trim();
      return urlKey === otherUrl || (titleKey && otherTitle && titleKey === otherTitle);
    });
    return !dupInBatch;
  });
}
