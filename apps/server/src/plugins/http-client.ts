/**
 * http-client 插件：decorate('http', undici Dispatcher) + proxy 重载。
 * 见 doc/design-doc/04-后端架构.md §4.2、09-基础设施与部署.md §9.2。
 * dev-spec 1A.10，验收 B7。
 */
import fp from 'fastify-plugin';
import { Agent, ProxyAgent, setGlobalDispatcher, Dispatcher } from 'undici';
import { config } from '../config.js';
import type { ProxyConfig } from '../types.js';

export default fp(
  async (app) => {
    function buildAgent(proxy?: ProxyConfig): Dispatcher {
      if (proxy?.enabled && proxy.host && proxy.port) {
        const uri = `http://${proxy.host}:${proxy.port}`;
        const opts: Record<string, string> = { uri };
        if (proxy.auth?.scheme === 'basic' && proxy.auth.token) {
          opts.token = `Basic ${proxy.auth.token}`;
        } else if (proxy.auth?.scheme === 'bearer' && proxy.auth.token) {
          opts.token = `Bearer ${proxy.auth.token}`;
        }
        app.log.info({ proxy: uri }, '[http-client] using proxy agent');
        return new ProxyAgent(opts);
      }
      return new Agent({
        connectTimeout: 15_000,
        headersTimeout: 30_000,
        bodyTimeout: 30_000,
        connections: 64,
      });
    }

    // 初始 agent
    let agent = buildAgent();
    setGlobalDispatcher(agent);
    app.decorate('http', agent);

    // rebuildHttpAgent: 运行时重建（管理端改代理时调）
    const rebuildHttpAgent = (proxy?: ProxyConfig) => {
      const old = agent;
      agent = buildAgent(proxy);
      setGlobalDispatcher(agent);
      app.http = agent;
      // 关闭旧 agent（异步）
      old.close().catch((err: Error) =>
        app.log.warn({ err: err.message }, '[http-client] 关闭旧 agent 失败'),
      );
      app.log.info('[http-client] agent 已重建');
    };
    app.decorate('rebuildHttpAgent', rebuildHttpAgent);

    app.addHook('onClose', async () => {
      await agent.close();
      app.log.info('http client (undici) closed');
    });

    app.log.info({ env: config.nodeEnv }, 'http-client plugin ready (undici + proxy support)');
  },
  { name: 'http-client' },
);
