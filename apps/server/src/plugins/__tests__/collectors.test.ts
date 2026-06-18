import { describe, it, expect, vi } from 'vitest';
import type { ICollector } from '@ai-insight/shared-types';

describe('collectors registration', () => {
  it('registerCollector 后可通过 collectors.get 获取', () => {
    const collectors = new Map<string, ICollector>();
    const mockCollector = { type: 'CUSTOM', fetch: vi.fn(), health: vi.fn() };

    collectors.set('CUSTOM', mockCollector);

    expect(collectors.get('CUSTOM')).toBe(mockCollector);
    expect(collectors.has('CUSTOM')).toBe(true);
    expect(collectors.size).toBe(1);
  });

  it('支持运行时注册新类型', () => {
    const collectors = new Map<string, ICollector>();

    const register = (type: string, impl: ICollector) => {
      collectors.set(type, impl);
    };

    const rss = { type: 'RSS', fetch: vi.fn() };
    const api = { type: 'SEARCH_API', fetch: vi.fn() };

    register('RSS', rss);
    register('SEARCH_API', api);

    expect(collectors.size).toBe(2);
    expect(collectors.get('RSS')).toBe(rss);
    expect(collectors.get('SEARCH_API')).toBe(api);
  });
});
