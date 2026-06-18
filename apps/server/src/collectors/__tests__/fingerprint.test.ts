import { describe, it, expect } from 'vitest';
import { fingerprint, normalizeUrl } from '../fingerprint';

describe('fingerprint', () => {
  describe('normalizeUrl', () => {
    it('removes fragment and sorts query params', () => {
      expect(normalizeUrl('https://a.com/x?b=2&a=1#top')).toBe('https://a.com/x?a=1&b=2');
    });

    it('removes tracking params', () => {
      expect(normalizeUrl('https://a.com/?utm_source=x&utm_medium=social')).toBe('https://a.com/');
    });

    it('removes default ports', () => {
      expect(normalizeUrl('https://a.com:443/path')).toBe('https://a.com/path');
      expect(normalizeUrl('http://a.com:80/path')).toBe('http://a.com/path');
    });

    it('lowercases host', () => {
      expect(normalizeUrl('HTTPS://Example.COM/Path')).toBe('https://example.com/Path');
    });

    it('removes trailing slash', () => {
      expect(normalizeUrl('https://a.com/path/')).toBe('https://a.com/path');
    });

    it('preserves path of just /', () => {
      expect(normalizeUrl('https://a.com/')).toBe('https://a.com/');
    });

    it('returns raw string on invalid URL', () => {
      expect(normalizeUrl('not-a-url')).toBe('not-a-url');
    });
  });

  describe('fingerprint', () => {
    it('produces same fingerprint for same URL with tracking params', () => {
      const a = fingerprint({ url: 'https://a.com/x' });
      const b = fingerprint({ url: 'https://a.com/x?utm_source=y' });
      expect(a.fingerprint).toBe(b.fingerprint);
      expect(a.strategy).toBe('url');
    });

    it('uses title strategy when no URL', () => {
      const result = fingerprint({ title: 'Hello World!' });
      expect(result.strategy).toBe('title');
      expect(result.fingerprint).toHaveLength(16);
    });

    it('uses source_id strategy when only sourceCode given', () => {
      const result = fingerprint({ sourceCode: 'rss-solidot' });
      expect(result.strategy).toBe('source_id');
      expect(result.fingerprint).toHaveLength(16);
      expect(result.dedupeKey).toContain('rss-solidot');
    });

    it('throws when no args provided', () => {
      expect(() => fingerprint({})).toThrow('fingerprint');
    });
  });
});
