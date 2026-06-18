/**
 * 阶段 e：综合点评（仅 heat>=70 或 critical 条目）。
 */
import { generateText } from 'ai';
import type { FastifyInstance } from 'fastify';
import type { RawItem } from '../../db/schema';

export async function generateComment(
  app: FastifyInstance,
  item: RawItem,
  heat: number,
): Promise<string | null> {
  if (heat < 70) return null;

  try {
    const result = await generateText({
      model: app.llm.chat as any,
      prompt: `对以下热点内容给出一句话领域点评和趋势分析：\n${item.title}\n${(item.rawText ?? '').slice(0, 500)}`,
    });
    return result.text ?? null;
  } catch {
    return null;
  }
}
