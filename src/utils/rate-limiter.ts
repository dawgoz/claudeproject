export interface RateLimiterOptions {
  maxRequests: number;
  maxTokens: number;
  maxConcurrent: number;
  windowMs?: number;
}

interface RequestRecord {
  timestamp: number;
  tokens: number;
}

export class RateLimiter {
  private readonly records: RequestRecord[] = [];
  private activeRequests = 0;
  private readonly windowMs: number;

  constructor(private readonly options: RateLimiterOptions) {
    const values = [options.maxRequests, options.maxTokens, options.maxConcurrent];
    if (values.some((value) => !Number.isInteger(value) || value < 1)) {
      throw new RangeError('Rate limits must be positive integers.');
    }
    this.windowMs = options.windowMs ?? 60_000;
    if (!Number.isFinite(this.windowMs) || this.windowMs <= 0) {
      throw new RangeError('windowMs must be a positive number.');
    }
  }

  canProceed(tokens = 1): boolean {
    this.pruneOldRecords();
    if (!Number.isInteger(tokens) || tokens < 1 || tokens > this.options.maxTokens) {
      return false;
    }
    const usedTokens = this.records.reduce((total, record) => total + record.tokens, 0);
    return this.records.length < this.options.maxRequests && usedTokens + tokens <= this.options.maxTokens;
  }

  async acquire(tokens = 1): Promise<() => void> {
    if (!Number.isInteger(tokens) || tokens < 1 || tokens > this.options.maxTokens) {
      throw new RangeError('tokens must fit within the configured token limit.');
    }
    await this.waitForRateLimit(tokens);
    await this.waitForSlot();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeRequests -= 1;
    };
  }

  async waitForSlot(): Promise<void> {
    while (this.activeRequests >= this.options.maxConcurrent) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    this.activeRequests += 1;
  }

  async waitForRateLimit(tokens = 1): Promise<void> {
    if (!Number.isInteger(tokens) || tokens < 1 || tokens > this.options.maxTokens) {
      throw new RangeError('tokens must fit within the configured token limit.');
    }
    while (!this.canProceed(tokens)) {
      this.pruneOldRecords();
      const nextExpiry = this.records[0]?.timestamp ?? Date.now();
      const waitMs = Math.max(1, nextExpiry + this.windowMs - Date.now());
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.records.push({ timestamp: Date.now(), tokens });
  }

  pruneOldRecords(now = Date.now()): void {
    while (this.records.length > 0 && this.records[0]!.timestamp <= now - this.windowMs) {
      this.records.shift();
    }
  }
}