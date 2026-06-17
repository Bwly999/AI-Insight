/**
 * http-client 插件：decorate('http', undici Dispatcher)。
 * 见 doc/design-doc/04-后端架构.md §4.2、09-基础设施与部署.md §9.2。
 *
 * 出网仅 RSS/搜索，经管理端配置的自定义代理（不走环境变量）。
 * Phase 0：建立 Dispatcher 单例；代理配置 Phase 1 由管理端写入后动态装配。
 * 未配置代理时走默认（内网可达源），不崩。
 */
import fp from 'fastify-plugin';
import { Agent, setGlobalDispatcher, Dispatcher } from 'undici';
import { config } from '../config.js';

export default fp(
  async (app) => {
    // Phase 0：默认 Agent。Phase 1 起按管理端 proxy 配置重建（ProxyAgent）。
    const agent = new Agent({
      connectTimeout: 15_000,
      headersTimeout: 30_000,
      bodyTimeout: 30_000,
      connections: 64,
    });

    setGlobalDispatcher(agent);

    app.decorate('http', agent as unknown as Dispatcher);

    app.addHook('onClose', async () => {
      await agent.close();
      app.log.info('http client (undici) closed');
    });

    app.log.info({ env: config.nodeEnv }, 'http-client plugin ready (undici)');
  },
  { name: 'http-client' },
);
