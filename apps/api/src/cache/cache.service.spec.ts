import { describe, expect, it, vi } from 'vitest';
import type { CacheStore } from './cache-store';
import { CACHE_NS } from './cache.keys';
import { CacheService } from './cache.service';

function fakeStore(overrides: Partial<CacheStore> = {}): CacheStore {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    delByPrefix: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const opts = { enabled: true, defaultTtlSeconds: 300 };

describe('CacheService', () => {
  it('returns the parsed value on a hit without calling the factory', async () => {
    const store = fakeStore({ get: vi.fn().mockResolvedValue(JSON.stringify({ a: 1 })) });
    const factory = vi.fn();
    const svc = new CacheService(store, opts);
    expect(await svc.getOrSet('k', factory)).toEqual({ a: 1 });
    expect(factory).not.toHaveBeenCalled();
  });

  it('runs the factory and stores its JSON on a miss', async () => {
    const store = fakeStore();
    const svc = new CacheService(store, opts);
    const result = await svc.getOrSet('k', async () => ({ a: 2 }), 60);
    expect(result).toEqual({ a: 2 });
    expect(store.set).toHaveBeenCalledWith('k', JSON.stringify({ a: 2 }), 60);
  });

  it('falls through to the factory when the store throws (fault isolation)', async () => {
    const store = fakeStore({ get: vi.fn().mockRejectedValue(new Error('redis down')) });
    const svc = new CacheService(store, opts);
    expect(await svc.getOrSet('k', async () => ({ a: 3 }))).toEqual({ a: 3 });
  });

  it('bypasses the cache entirely when disabled', async () => {
    const store = fakeStore();
    const svc = new CacheService(store, { enabled: false, defaultTtlSeconds: 300 });
    const factory = vi.fn().mockResolvedValue({ a: 4 });
    expect(await svc.getOrSet('k', factory)).toEqual({ a: 4 });
    expect(store.get).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
    expect(factory).toHaveBeenCalledOnce();
  });

  it('invalidate flushes the namespace prefix', async () => {
    const store = fakeStore();
    await new CacheService(store, opts).invalidate(CACHE_NS.SEO);
    expect(store.delByPrefix).toHaveBeenCalledWith('cms:seo:');
  });

  it('invalidate swallows store errors', async () => {
    const store = fakeStore({ delByPrefix: vi.fn().mockRejectedValue(new Error('x')) });
    await expect(new CacheService(store, opts).invalidate(CACHE_NS.SEO)).resolves.toBeUndefined();
  });
});
