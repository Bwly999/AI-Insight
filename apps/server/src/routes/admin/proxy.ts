/**
 * 管理端 · 代理配置 CRUD。
 * 见 dev-spec 1A.15，API 清单 B.6。
 *
 * 代理存 system_config 表 key='proxy'。
 */
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { systemConfig } from '../../db/schema';
import type { ProxyConfig } from '../../types';
import { ProxyAgent, setGlobalDispatcher, Agent } from 'undici';

export default async function adminProxyRoutes(app: FastifyInstance): Promise<void> {
  const adminGuard = { preHandler: [app.auth, app.requireAdmin] };

  async function getProxy(): Promise<ProxyConfig | null> {
    const [row] = await app.db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, 'proxy'))
      .limit(1);
    if (!row) return null;
    try {
      return JSON.parse(row.value) as ProxyConfig;
    } catch {
      return null;
    }
  }

  async function setProxy(cfg: ProxyConfig): Promise<void> {
    const val = JSON.stringify(cfg);
    const [existing] = await app.db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, 'proxy'))
      .limit(1);
    if (existing?.key) {
      await app.db
        .update(systemConfig)
        .set({ value: val, updatedAt: new Date() })
        .where(eq(systemConfig.key, 'proxy'));
    } else {
      await app.db
        .insert(systemConfig)
        .values({ key: 'proxy', value: val });
    }
  }

  // GET /admin/proxy — 读代理配置
  app.get('/admin/proxy', adminGuard, async (_req, reply) => {
    const proxy = await getProxy();
    // 脱敏密码
    if (proxy?.auth?.token) {
      proxy.auth.token = '****';
    }
    return reply.send(proxy ?? { enabled: false });
  });

  // PUT /admin/proxy — 写代理配置（触发重建）
  app.put('/admin/proxy', adminGuard, async (req, reply) => {
    const body = req.body as ProxyConfig;
    if (!body || typeof body.enabled !== 'boolean') {
      return reply.code(400).send({ error: 'validation', message: 'enabled 必填', statusCode: 400 });
    }
    await setProxy(body);
    app.rebuildHttpAgent(body);
    return reply.send(body);
  });

  // POST /admin/proxy/test — 连通性测试
  app.post('/admin/proxy/test', adminGuard, async (_req, reply) => {
    try {
      const proxy = await getProxy();
      if (proxy?.enabled && proxy.host && proxy.port) {
        const testAgent = new ProxyAgent({ uri: `http://${proxy.host}:${proxy.port}` });
        // 用 test agent 发一个请求到外部
        const resp = await testAgent.request({ method: 'GET', origin: 'https://httpbin.org', path: '/get' });
        await resp.body.resume();
        await testAgent.close();
        return reply.send({ ok: true, detail: '代理连通' });
      }
      return reply.send({ ok: true, detail: '无代理配置，跳过测试' });
    } catch (err) {
      return reply.send({ ok: false, detail: (err as Error).message });
    }
  });
}
