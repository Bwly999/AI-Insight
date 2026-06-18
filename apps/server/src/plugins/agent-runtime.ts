/**
 * agent-runtime 插件：decorate('agentRuntime', IAgentRuntime)。
 * Phase 1B 新增。
 * 见 dev-spec 1B.6/1B.7。
 */
import fp from 'fastify-plugin';
import { AiSdkRuntime } from '../insight/runtime-aisdk';

export default fp(
  async (app) => {
    // 默认用 AiSdkRuntime（Vercel AI SDK 兜底）
    // 当 Pi Agent SDK 可用时切换到 PiAgentRuntime
    const runtime = new AiSdkRuntime(app);
    app.decorate('agentRuntime', runtime);

    app.log.info('agent-runtime plugin ready (AiSdkRuntime fallback)');
  },
  { name: 'agent-runtime' },
);
