import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_STORE, type CacheStore } from './cache-store';
import { type CacheNamespace, cachePrefix } from './cache.keys';

export interface CacheOptions {
  enabled: boolean;
  defaultTtlSeconds: number;
}

/** DI token carrying the resolved {@link CacheOptions}. */
export const CACHE_OPTIONS = Symbol('CACHE_OPTIONS');

/**
 * Read-through cache over a {@link CacheStore}. The cache is an optimization,
 * never a dependency: any store error is logged and the call falls through to
 * the source, so a Redis outage degrades to (correct, slower) direct reads.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger('CacheService');

  constructor(
    @Inject(CACHE_STORE) private readonly store: CacheStore,
    @Inject(CACHE_OPTIONS) private readonly options: CacheOptions,
  ) {}

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    if (!this.options.enabled) return factory();

    try {
      const cached = await this.store.get(key);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.warn(`Cache read failed for "${key}"; serving from source`, error as Error);
      return factory();
    }

    const value = await factory();
    try {
      await this.store.set(
        key,
        JSON.stringify(value),
        ttlSeconds ?? this.options.defaultTtlSeconds,
      );
    } catch (error) {
      this.logger.warn(`Cache write failed for "${key}"`, error as Error);
    }
    return value;
  }

  async invalidate(ns: CacheNamespace): Promise<void> {
    try {
      await this.store.delByPrefix(cachePrefix(ns));
    } catch (error) {
      this.logger.warn(`Cache invalidation failed for "${ns}"`, error as Error);
    }
  }
}
