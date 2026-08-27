/**
 * Rate limiter with adaptive backoff for external API calls.
 */

interface RateLimitConfig {
  maxRequestsPerWindow: number;
  windowMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

interface RateLimitState {
  requests: number[];
  currentBackoff: number;
  lastError: number | null;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequestsPerWindow: 60,
  windowMs: 60 * 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 30 * 1000,
};

class AdaptiveRateLimiter {
  private config: RateLimitConfig;
  private state: RateLimitState;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      requests: [],
      currentBackoff: 0,
      lastError: null,
    };
  }

  /**
   * Check if a request can be made, cleaning expired entries.
   */
  canRequest(): boolean {
    this.cleanExpiredRequests();

    if (this.state.currentBackoff > 0) {
      const backoffRemaining = this.state.lastError
        ? this.state.lastError + this.state.currentBackoff - Date.now()
        : 0;
      if (backoffRemaining > 0) {
        return false;
      }
      this.state.currentBackoff = 0;
    }

    return this.state.requests.length < this.config.maxRequestsPerWindow;
  }

  /**
   * Record a successful request.
   */
  recordRequest(): void {
    this.state.requests.push(Date.now());
    // Reset backoff on success
    if (this.state.currentBackoff > 0) {
      this.state.currentBackoff = Math.max(0, this.state.currentBackoff / 2);
    }
  }

  /**
   * Record a rate limit error and increase backoff.
   */
  recordError(): void {
    this.state.lastError = Date.now();
    this.state.currentBackoff = Math.min(
      this.config.maxBackoffMs,
      Math.max(1000, this.state.currentBackoff * this.config.backoffMultiplier),
    );
  }

  /**
   * Get time until next request is allowed.
   */
  getWaitTime(): number {
    this.cleanExpiredRequests();

    if (this.state.currentBackoff > 0 && this.state.lastError) {
      const backoffRemaining = this.state.lastError + this.state.currentBackoff - Date.now();
      if (backoffRemaining > 0) return backoffRemaining;
    }

    if (this.state.requests.length >= this.config.maxRequestsPerWindow) {
      const oldestRequest = this.state.requests[0];
      return oldestRequest + this.config.windowMs - Date.now();
    }

    return 0;
  }

  /**
   * Execute a function with rate limiting.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const waitTime = this.getWaitTime();
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    try {
      const result = await fn();
      this.recordRequest();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
        this.recordError();
      }
      throw error;
    }
  }

  private cleanExpiredRequests(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.state.requests = this.state.requests.filter((ts) => ts > cutoff);
  }
}

// Singleton rate limiters for different services
export const geminiRateLimiter = new AdaptiveRateLimiter({
  maxRequestsPerWindow: 60,
  windowMs: 60 * 1000,
});

export const pineconeRateLimiter = new AdaptiveRateLimiter({
  maxRequestsPerWindow: 100,
  windowMs: 60 * 1000,
});

export { AdaptiveRateLimiter };
export type { RateLimitConfig };
