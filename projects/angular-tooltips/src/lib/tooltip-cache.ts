import { inject, DestroyRef, Injectable, InjectionToken, Provider } from '@angular/core';

// ─── HkTooltipCache ──────────────────────────────────────────────────────────
// App-level TTL + LRU cache for async tooltip content. Designed to be called
// from a resource() loader inside projected tooltip templates, so a hovercard
// that was fetched once re-opens instantly for the lifetime of an entry.

/** Configuration for {@link HkTooltipCache}. */
export interface HkTooltipCacheOptions {
  /** Time-to-live per entry, in milliseconds. Default: 30 000. */
  ttl?: number;
  /** Maximum number of entries before least-recently-used eviction. Default: 100. */
  maxEntries?: number;
}

export const HK_TOOLTIP_CACHE_OPTIONS = new InjectionToken<HkTooltipCacheOptions>(
  'HK_TOOLTIP_CACHE_OPTIONS',
);

/**
 * Configure the cache: `provideHkTooltipCache({ ttl: 60_000 })`.
 * Returns plain providers so it works in `bootstrapApplication` as well as
 * in a component's `providers` array (see lifetime scoping on the service).
 */
export function provideHkTooltipCache(options: HkTooltipCacheOptions): Provider[] {
  return [{ provide: HK_TOOLTIP_CACHE_OPTIONS, useValue: options }];
}

interface CacheEntry {
  readonly value: Promise<unknown>;
  readonly expires: number;
}

/**
 * The PROMISE is cached, not the resolved value, so any number of triggers
 * hovering the same key while a request is in flight share a single fetch.
 * Rejected promises are evicted immediately — errors are never cached.
 *
 * Lifetime is scoped by DI, not by manual bookkeeping:
 *  - root-provided (the default): entries live for the app, bounded by TTL;
 *  - listed in a component's `providers`: Angular destroys the service with
 *    the component, and the whole cache is cleared with it.
 */
@Injectable({ providedIn: 'root' })
export class HkTooltipCache {
  readonly #options = inject(HK_TOOLTIP_CACHE_OPTIONS, { optional: true });
  readonly #ttl = this.#options?.ttl ?? 30_000;
  readonly #maxEntries = this.#options?.maxEntries ?? 100;
  readonly #store = new Map<string, CacheEntry>();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.#store.clear());
  }

  /**
   * Return the cached promise for `key`, or run `fetcher` and cache it.
   *
   * When sharing requests through the cache, don't abort the underlying
   * request per-consumer (e.g. with a resource's `abortSignal`) — an abort
   * rejects the shared promise for every consumer and evicts the entry.
   */
  getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttl: number = this.#ttl): Promise<T> {
    const now = Date.now();
    const hit = this.#store.get(key);
    if (hit && hit.expires > now) {
      // LRU touch: re-insert to move the entry to the back of the map.
      this.#store.delete(key);
      this.#store.set(key, hit);
      return hit.value as Promise<T>;
    }

    const value = fetcher();
    const entry: CacheEntry = { value, expires: now + ttl };
    this.#store.delete(key);
    this.#store.set(key, entry);
    value.catch(() => {
      // Guard against a newer entry having replaced this one in the meantime.
      if (this.#store.get(key) === entry) this.#store.delete(key);
    });

    while (this.#store.size > this.#maxEntries) {
      this.#store.delete(this.#store.keys().next().value as string);
    }
    return value;
  }

  /** Drop one entry, e.g. after a mutation. */
  invalidate(key: string): void {
    this.#store.delete(key);
  }

  /** Drop every entry whose key starts with `prefix`, e.g. `"user:"`. */
  invalidatePrefix(prefix: string): void {
    for (const key of this.#store.keys()) {
      if (key.startsWith(prefix)) this.#store.delete(key);
    }
  }

  clear(): void {
    this.#store.clear();
  }
}
