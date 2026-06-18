/**
 * LLM 连通测试。
 * 见 dev-spec 2.2，验收 C1。
 */
import type { FastifyInstance } from 'fastify';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';

export default async function adminLlmRoutes(app: FastifyInstance): Promise<void> {
  const adminGuard = { preHandler: [app.auth, app.requireAdmin] };

  app.get('/admin/llm/ping', adminGuard, async (_req, reply) => {
    try {
      const textResult = await generateText({
        model: app.llm.chat as any,
        prompt: '你好，请用一句话确认你在线。',
      });

      const objResult = await generateObject({
        model: app.llm.chat as any,
        schema: z.object({ ok: z.boolean() }),
        prompt: '返回 ok=true',
      });

      return reply.send({
        text: textResult.text,
        object: objResult.object,
        model: app.llm.model,
      });
    } catch (err) {
      return reply.send({
        text: null,
        object: null,
        model: app.llm.model,
        error: (err as Error).message,
      });
    }
  });
}
