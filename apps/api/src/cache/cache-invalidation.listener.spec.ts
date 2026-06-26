import { describe, expect, it, vi } from 'vitest';
import { HookRegistry } from '../plugins/hook-registry';
import { CacheInvalidationListener } from './cache-invalidation.listener';
import { CACHE_NS } from './cache.keys';
import type { CacheService } from './cache.service';

function setup() {
  const cache = { invalidate: vi.fn().mockResolvedValue(undefined) } as unknown as CacheService;
  const hooks = new HookRegistry();
  new CacheInvalidationListener(hooks, cache).onModuleInit();
  return { cache, hooks };
}

describe('CacheInvalidationListener', () => {
  it('flushes the content posts namespace on a post change', async () => {
    const { cache, hooks } = setup();
    await hooks.emit('content.changed', { type: 'post', id: '1' });
    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_NS.POSTS);
  });

  it('flushes the content pages namespace on a page change', async () => {
    const { cache, hooks } = setup();
    await hooks.emit('content.changed', { type: 'page', id: '1' });
    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_NS.PAGES);
  });

  it('flushes settings, menus and seo on their events', async () => {
    const { cache, hooks } = setup();
    await hooks.emit('settings.theme.changed', {});
    await hooks.emit('menu.changed', {});
    await hooks.emit('seo.changed', {});
    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_NS.SETTINGS);
    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_NS.MENUS);
    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_NS.SEO);
  });
});
