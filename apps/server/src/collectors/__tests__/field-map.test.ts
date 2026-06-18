import { describe, it, expect } from 'vitest';
import { getByPath, extractItems, mapFields } from '../field-map';

describe('field-map', () => {
  describe('getByPath', () => {
    it('gets nested value by dot path', () => {
      expect(getByPath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
    });

    it('returns undefined for missing path', () => {
      expect(getByPath({ a: 1 }, 'a.b')).toBeUndefined();
    });

    it('returns undefined for null/undefined intermediate', () => {
      expect(getByPath({ a: null }, 'a.b')).toBeUndefined();
    });
  });

  describe('extractItems', () => {
    it('extracts array with [*] wildcard', () => {
      const data = { data: { list: [{ title: 'a' }, { title: 'b' }] } };
      expect(extractItems(data, 'data.list[*]')).toEqual([{ title: 'a' }, { title: 'b' }]);
    });

    it('wraps scalar in array', () => {
      expect(extractItems({ item: { x: 1 } }, 'item')).toEqual([{ x: 1 }]);
    });

    it('returns [] for non-existent path', () => {
      expect(extractItems({}, 'data.list[*]')).toEqual([]);
    });
  });

  describe('mapFields', () => {
    it('maps fields correctly', () => {
      const items = [
        { title: 'a', uri: 'u1', dt: '2024-01-01' },
        { title: 'b', uri: 'u2', dt: '2024-01-02' },
      ];
      const result = mapFields(items, { title: 'title', url: 'uri', publishedAt: 'dt' });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ title: 'a', url: 'u1', publishedAt: '2024-01-01' });
    });

    it('skips items missing title or url', () => {
      const items = [
        { title: 'a', uri: 'u1' },
        { title: '', uri: 'u2' },
        { uri: 'u3' },
      ];
      const result = mapFields(items, { title: 'title', url: 'uri' });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('a');
    });
  });
});
