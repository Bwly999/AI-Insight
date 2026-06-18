import { describe, it, expect } from 'vitest';
import { CryptoUtil } from '../crypto';

describe('CryptoUtil', () => {
  const crypto = new CryptoUtil('test-secret-32bytes!!');

  it('encrypt → decrypt roundtrip', () => {
    const plain = 'sk-abc123secretapikey';
    const enc = crypto.encrypt(plain);
    expect(enc).not.toBe(plain);
    expect(enc).toMatch(/^[A-Za-z0-9+/=]+$/);
    const dec = crypto.decrypt(enc);
    expect(dec).toBe(plain);
  });

  it('produces different ciphertexts for same plaintext (different IV)', () => {
    const plain = 'same-value';
    const a = crypto.encrypt(plain);
    const b = crypto.encrypt(plain);
    expect(a).not.toBe(b);
  });

  it('mask shows first 4 and last 4', () => {
    expect(crypto.mask('sk-abcdef123456')).toBe('sk-a****3456');
  });

  it('mask handles short strings', () => {
    expect(crypto.mask('abc')).toBe('ab****');
  });
});
