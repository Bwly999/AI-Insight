/**
 * crypto 插件：decorate('crypto', CryptoUtil)。
 * 必须在 collectors 插件之前注册。
 * 见 dev-spec 1A.2。
 */
import fp from 'fastify-plugin';
import { CryptoUtil } from '../utils/crypto.js';
import { config } from '../config.js';

export default fp(
  async (app) => {
    const secret = config.cryptoSecret;
    if (!secret || secret === 'dev-insecure-crypto-secret') {
      app.log.warn(
        '[crypto] CRYPTO_SECRET 未配置或使用 dev 默认值，生产环境请务必设置强密钥',
      );
    }
    const crypto = new CryptoUtil(secret);
    app.decorate('crypto', crypto);
    app.log.info('crypto plugin ready (AES-256-GCM)');
  },
  { name: 'crypto' },
);
