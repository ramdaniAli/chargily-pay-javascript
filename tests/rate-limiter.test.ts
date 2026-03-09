import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../src/rate-limiter';

describe('RateLimiter', () => {
  it('should allow requests up to the limit immediately', async () => {
    const limiter = new RateLimiter(3);
    const start = Date.now();

    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('should delay requests beyond the limit', async () => {
    const limiter = new RateLimiter(2);

    await limiter.acquire();
    await limiter.acquire();

    const start = Date.now();
    await limiter.acquire();
    const elapsed = Date.now() - start;

    // Should have waited ~500ms (1 token / 2 per second = 500ms)
    expect(elapsed).toBeGreaterThanOrEqual(300);
    expect(elapsed).toBeLessThan(1000);
  });

  it('should refill tokens over time', async () => {
    const limiter = new RateLimiter(5);

    // Use all tokens
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }

    // Wait for refill
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should now have ~2.5 tokens refilled
    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
