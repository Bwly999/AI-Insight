/**
 * 阶段 b：分类打标。
 * 用 generateObject + zod schema 产出分类和标签。
 */
import { generateObject } from 'ai';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { RawItem } from '../../db/schema';

const ClassifySchema = z.object({
  categoryCode: z.string(),
  tags: z.array(z.string()),
});

export async function classifyItem(
  app: FastifyInstance,
  item: RawItem,
): Promise<{ categoryCode: string; tags: string[] }> {
  const text = (item.title ?? '') + '\n' + (item.rawText ?? '').slice(0, 1000);
  if (!text.trim()) {
    return { categoryCode: 'tech', tags: [] };
  }

  try {
    const result = await generateObject({
      model: app.llm.chat as any,
      schema: ClassifySchema,
      prompt: `对以下内容分类并打标（输出中文标签）：\n${text}`,
    });
    return result.object as { categoryCode: string; tags: string[] };
  } catch {
    // fallback
    return { categoryCode: 'tech', tags: [item.title?.slice(0, 20) ?? 'general'] };
  }
}
