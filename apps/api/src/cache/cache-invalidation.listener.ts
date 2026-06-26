import { Injectable, type OnModuleInit } from '@nestjs/common';
import { HookRegistry } from '../plugins/hook-registry';
import { CACHE_NS } from './cache.keys';
import { CacheService } from './cache.service';

/**
 * Core (un-owned) hook subscriber: maps content/settings/menu/seo change events
 * to a namespace flush. Registered without an `owner`, so the plugin enabled-gate
 * never disables cache invalidation.
 */
@Injectable()
export class CacheInvalidationListener implements OnModuleInit {
  constructor(
    private readonly hooks: HookRegistry,
    private readonly cache: CacheService,
  ) {}

  onModuleInit(): void {
    this.hooks.addAction('content.changed', (p) =>
      this.cache.invalidate(p.type === 'post' ? CACHE_NS.POSTS : CACHE_NS.PAGES),
    );
    this.hooks.addAction('settings.theme.changed', () => this.cache.invalidate(CACHE_NS.SETTINGS));
    this.hooks.addAction('menu.changed', () => this.cache.invalidate(CACHE_NS.MENUS));
    this.hooks.addAction('seo.changed', () => this.cache.invalidate(CACHE_NS.SEO));
  }
}
