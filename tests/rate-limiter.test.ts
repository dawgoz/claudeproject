import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../src/utils/rate-limiter.js';

describe('RateLimiter', () => {
  it('tracks request and token limits within the sliding window', () => {
    const limiter = new RateLimiter({ maxRequests: 2, maxTokens: 10, maxConcurrent: 1, windowMs: 1_000 });
    expect(limiter.canProceed(6)).toBe(true);
    expect(limiter.canProceed(11)).toBe(false);
  });

  it('prunes records outside the sliding window', async () => {
    const limiter = new RateLimiter({ maxRequests: 1, maxTokens: 5, maxConcurrent: 1, windowMs: 15 });
    await limiter.waitForRateLimit(5);
    expect(limiter.canProceed()).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(limiter.canProceed()).toBe(true);
  });

  it('releases concurrency slots exactly once', async () => {
    const limiter = new RateLimiter({ maxRequests: 3, maxTokens: 20, maxConcurrent: 1 });
    const release = await limiter.acquire(2);
    release();
    release();
    const nextRelease = await limiter.acquire(2);
    nextRelease();
  });
});