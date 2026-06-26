import { Module } from '@nestjs/common';
import { PluginsModule } from '../plugins/plugins.module';
import { CacheInvalidationListener } from './cache-invalidation.listener';
import { CACHE_STORE } from './cache-store';
import { CACHE_OPTIONS, CacheService } from './cache.service';
import { MemoryCacheStore } from './memory-cache-store';
import { RedisCacheStore } from './redis-cache-store';

/**
 * Wires the cache backend (Redis when REDIS_URL is set, else in-process memory)
 * and the invalidation listener. Env is read directly here (not via parseEnv) so
 * unit tests of the cache classes stay default-safe.
 */
@Module({
  imports: [PluginsModule],
  providers: [
    {
      provide: CACHE_STORE,
      useFactory: () => {
        const url = process.env.REDIS_URL;
        if (!url) return new MemoryCacheStore();
        // Lazy require keeps ioredis out of the unit-test import graph.
        const Redis = require('ioredis');
        return new RedisCacheStore(new Redis(url));
      },
    },
    {
      provide: CACHE_OPTIONS,
      useFactory: () => ({
        enabled: process.env.CACHE_ENABLED !== 'false',
        defaultTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 300),
      }),
    },
    CacheService,
    CacheInvalidationListener,
  ],
  exports: [CacheService],
})
export class CacheModule {}
