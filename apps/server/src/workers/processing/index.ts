/**
 * 五阶段编排。
 * 对每条 raw_item 串行执行 a→b→c→d，e 条件触发。
 */
import type { FastifyInstance } from 'fastify';
import type { RawItem } from '../../db/schema';
import { dedupeBatch } from './dedupe';
import { classifyItem } from './classify';
import { summarizeItem } from './summarize';
import { scoreHeat } from './score-heat';
import { generateComment } from './comment';

export interface ProcessedResult {
  rawItemId: number;
  categoryCode: string;
  summary: string;
  heat: number;
  tags: string[];
  critical: boolean;
  trendComment: string | null;
}

export async function processBatch(
  app: FastifyInstance,
  items: RawItem[],
): Promise<ProcessedResult[]> {
  // a: 去重
  const deduped = await dedupeBatch(app, items);
  const results: ProcessedResult[] = [];

  for (const item of deduped) {
    try {
      // b: 分类
      const { categoryCode, tags } = await classifyItem(app, item);

      // c: 摘要
      const summary = await summarizeItem(app, item);

      // d: 热度
      const heat = await scoreHeat(app, item);

      // e: 点评（仅热点）
      const critical = heat >= 70;
      const trendComment = await generateComment(app, item, heat);

      results.push({
        rawItemId: item.id,
        categoryCode,
        summary,
        heat,
        tags,
        critical,
        trendComment,
      });
    } catch (err) {
      app.log.error(
        { rawItemId: item.id, err: (err as Error).message },
        '[processing] 单条处理失败，跳过',
      );
      // 单条失败不阻塞批
      continue;
    }
  }

  return results;
}
