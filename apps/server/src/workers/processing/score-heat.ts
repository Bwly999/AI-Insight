/**
 * 阶段 d：热度评分。
 * 用 LLM 评估 0-100 热度分。
 */
import { generateObject } from 'ai';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { RawItem } from '../../db/schema';

const HeatSchema = z.object({
  heat: z.number().min(0).max(100),
});

export async function scoreHeat(
  app: FastifyInstance,
  item: RawItem,
): Promise<number> {
  try {
    const result = await generateObject({
      model: app.llm.chat as any,
      schema: HeatSchema,
      prompt: `给以下内容的热度评分（0-100），考虑：源权威度、时效、影响范围、社区讨论度：\n${item.title}\n${(item.rawText ?? '').slice(0, 500)}`,
    });
    const obj = result.object as { heat: number };
    return Math.max(0, Math.min(100, obj.heat));
  } catch {
    return 50; // 默认中值
  }
}
