/**
 * 阶段 c：中文摘要。
 * 用 LLM 产出 100-200 字中文摘要。
 */
import { generateText } from 'ai';
import type { FastifyInstance } from 'fastify';
import type { RawItem } from '../../db/schema';

export async function summarizeItem(
  app: FastifyInstance,
  item: RawItem,
): Promise<string> {
  const text = (item.title ?? '') + '\n' + (item.rawText ?? '').slice(0, 2000);
  if (!text.trim()) return (item.title ?? '').slice(0, 200);

  try {
    const result = await generateText({
      model: app.llm.chat as any,
      prompt: `无论原文什么语言，用中文输出 100-200 字摘要：\n${text}`,
    });
    return result.text ?? text.slice(0, 200);
  } catch {
    return text.slice(0, 200);
  }
}
