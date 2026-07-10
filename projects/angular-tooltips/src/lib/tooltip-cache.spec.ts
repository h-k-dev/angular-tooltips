import { TestBed } from '@angular/core/testing';

import { HkTooltipCache, provideHkTooltipCache } from './tooltip-cache';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('HkTooltipCache', () => {
  it('dedupes concurrent fetches for the same key', async () => {
    const cache = TestBed.inject(HkTooltipCache);
    let calls = 0;
    const fetcher = () => Promise.resolve(`value-${++calls}`);

    const [a, b] = await Promise.all([
      cache.getOrFetch('k', fetcher),
      cache.getOrFetch('k', fetcher),
    ]);

    expect(calls).toBe(1);
    expect(a).toBe('value-1');
    expect(b).toBe('value-1');
  });

  it('refetches after the ttl expires', async () => {
    const cache = TestBed.inject(HkTooltipCache);
    let calls = 0;
    const fetcher = () => Promise.resolve(++calls);

    await cache.getOrFetch('k', fetcher, 5);
    await sleep(20);
    await cache.getOrFetch('k', fetcher, 5);

    expect(calls).toBe(2);
  });

  it('never caches rejected promises', async () => {
    const cache = TestBed.inject(HkTooltipCache);
    let calls = 0;
    const failing = () => {
      calls++;
      return Promise.reject(new Error('boom'));
    };

    await expect(cache.getOrFetch('k', failing)).rejects.toThrow('boom');
    await expect(cache.getOrFetch('k', failing)).rejects.toThrow('boom');
    expect(calls).toBe(2);
  });

  it('invalidate() drops a single key, invalidatePrefix() a family', async () => {
    const cache = TestBed.inject(HkTooltipCache);
    let calls = 0;
    const fetcher = () => Promise.resolve(++calls);

    await cache.getOrFetch('user:1', fetcher);
    await cache.getOrFetch('user:2', fetcher);

    cache.invalidate('user:1');
    await cache.getOrFetch('user:1', fetcher);
    await cache.getOrFetch('user:2', fetcher);
    expect(calls).toBe(3); // user:1 refetched, user:2 still cached

    cache.invalidatePrefix('user:');
    await cache.getOrFetch('user:2', fetcher);
    expect(calls).toBe(4);
  });

  it('evicts least-recently-used entries beyond maxEntries', async () => {
    TestBed.configureTestingModule({
      providers: [provideHkTooltipCache({ maxEntries: 2 })],
    });
    const cache = TestBed.inject(HkTooltipCache);
    let calls = 0;
    const fetcher = () => Promise.resolve(++calls);

    await cache.getOrFetch('a', fetcher);
    await cache.getOrFetch('b', fetcher);
    await cache.getOrFetch('a', fetcher); // touch 'a' → 'b' is now oldest
    await cache.getOrFetch('c', fetcher); // evicts 'b'

    await cache.getOrFetch('a', fetcher);
    expect(calls).toBe(3); // a, b, c — 'a' stayed cached throughout

    await cache.getOrFetch('b', fetcher);
    expect(calls).toBe(4); // 'b' was evicted and refetched
  });
});
