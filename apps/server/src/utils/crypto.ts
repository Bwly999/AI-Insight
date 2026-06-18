/**
 * CryptoUtil —— AES‑256‑GCM 加解密 + 脱敏。
 * 用于 apiKey 等敏感字段的安全存储。
 * 见 dev-spec 1A.2。
 */
import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;  // GCM 推荐 96 位
const TAG_LEN = 16; // GCM 认证标签

export class CryptoUtil {
  private readonly key: Buffer;

  constructor(secret: string) {
    // 用 scrypt 将任意长度 secret 派生为 32 字节密钥
    // salt 固定方便 dev，生产应使用独立 salt 或 KMS
    const salt = Buffer.from('ai-insight-crypto-salt', 'utf8');
    this.key = crypto.scryptSync(secret, salt, 32);
  }

  /** 加密 → base64(iv + tag + ciphertext) */
  encrypt(plain: string): string {
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  /** 解密 base64 密文 */
  decrypt(cipher: string): string {
    const raw = Buffer.from(cipher, 'base64');
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = raw.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final('utf8');
  }

  /** 脱敏：前 4 + **** + 后 4 */
  mask(plain: string): string {
    if (plain.length <= 8) return plain.slice(0, 2) + '****';
    return plain.slice(0, 4) + '****' + plain.slice(-4);
  }
}
