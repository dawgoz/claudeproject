import { describe, expect, it, vi } from 'vitest';
import { ErrorCodes, ReviewError, withRetry, withTimeout } from '../src/utils/error-handler.js';

describe('error handling utilities', () => {
  it('retries transient failures and returns the successful result', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls += 1;
      if (calls < 3) throw new Error('temporary');
      return 'done';
    }, { attempts: 3, baseDelayMs: 1, jitter: 0 });
    expect(result).toBe('done');
    expect(calls).toBe(3);
  });

  it('stops retrying when the error is not retryable', async () => {
    const operation = vi.fn(async () => { throw new Error('permanent'); });
    await expect(withRetry(operation, { attempts: 4, shouldRetry: () => false })).rejects.toThrow('permanent');
    expect(operation).toHaveBeenCalledOnce();
  });

  it('rejects timed out operations with a typed error', async () => {
    const pending = new Promise<string>(() => undefined);
    await expect(withTimeout(pending, 5)).rejects.toMatchObject({
      code: ErrorCodes.TIMEOUT,
      name: 'ReviewError',
    } satisfies Partial<ReviewError>);
  });
});