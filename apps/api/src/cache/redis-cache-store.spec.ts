import { describe, expect, it, vi } from 'vitest';
import { RedisCacheStore, type RedisLike } from './redis-cache-store';

function fakeRedis(overrides: Partial<RedisLike> = {}): RedisLike {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    scan: vi.fn().mockResolvedValue(['0', []]),
    ...overrides,
  };
}

describe('RedisCacheStore', () => {
  it('sets with an EX ttl', async () => {
    const redis = fakeRedis();
    await new RedisCacheStore(redis).set('k', 'v', 30);
    expect(redis.set).toHaveBeenCalledWith('k', 'v', 'EX', 30);
  });

  it('gets a stored value', async () => {
    const redis = fakeRedis({ get: vi.fn().mockResolvedValue('v') });
    expect(await new RedisCacheStore(redis).get('k')).toBe('v');
  });

  it('deletes every key under a prefix across SCAN pages', async () => {
    const scan = vi
      .fn()
      .mockResolvedValueOnce(['42', ['cms:seo:a', 'cms:seo:b']])
      .mockResolvedValueOnce(['0', ['cms:seo:c']]);
    const del = vi.fn().mockResolvedValue(1);
    await new RedisCacheStore(fakeRedis({ scan, del })).delByPrefix('cms:seo:');
    expect(scan).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith('cms:seo:a', 'cms:seo:b');
    expect(del).toHaveBeenCalledWith('cms:seo:c');
  });

  it('does not call del when a page is empty', async () => {
    const del = vi.fn();
    await new RedisCacheStore(fakeRedis({ del })).delByPrefix('cms:seo:');
    expect(del).not.toHaveBeenCalled();
  });
});
