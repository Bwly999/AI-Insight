/**
 * llm 插件：decorate('llm', { chat, model })。
 * 见 doc/design-doc/05-可插拔SPI设计.md §5.3、09-基础设施与部署.md §9.3。
 *
 * 使用 Vercel AI SDK 的 @ai-sdk/openai，baseURL 指内网 OpenAI 兼容地址。
 * 仅 chat（无 embedding）。处理管道用 generateText / generateObject + zod。
 *
 * Phase 0：建立 provider 与 chat 句柄；真实调用 Phase 2 验证（验收 C1）。
 */
import fp from 'fastify-plugin';
import { createOpenAI } from '@ai-sdk/openai';
import { config } from '../config.js';

export default fp(
  async (app) => {
    const provider = createOpenAI({
      baseURL: config.llm.baseUrl,
      apiKey: config.llm.apiKey,
    });

    const chat = provider(config.llm.model);

    app.decorate('llm', { chat, model: config.llm.model });

    app.log.info(
      { baseUrl: config.llm.baseUrl, model: config.llm.model },
      'llm plugin ready (vercel ai sdk → internal)',
    );
  },
  { name: 'llm' },
);
