/**
 * A simple token-bucket rate limiter for controlling request throughput.
 * Queues requests when the limit is reached and processes them as tokens become available.
 */
export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;
  private queue: Array<() => void> = [];

  /**
   * @param maxRequestsPerSecond - Maximum requests allowed per second (default: 5).
   */
  constructor(maxRequestsPerSecond: number = 5) {
    this.maxTokens = maxRequestsPerSecond;
    this.tokens = maxRequestsPerSecond;
    this.refillRate = maxRequestsPerSecond;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  /**
   * Acquires a token, waiting if necessary until one becomes available.
   * Call this before making an API request.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      const waitMs = ((1 - this.tokens) / this.refillRate) * 1000;
      setTimeout(() => this.processQueue(), waitMs);
    });
  }

  private processQueue(): void {
    this.refill();
    while (this.queue.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      const next = this.queue.shift();
      next?.();
    }
  }
}
