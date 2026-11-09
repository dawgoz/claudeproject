export enum ErrorCodes {
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  MISSING_CONFIGURATION = 'MISSING_CONFIGURATION',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  AGENT_FAILURE = 'AGENT_FAILURE',
  INVALID_REPORT = 'INVALID_REPORT',
  REPORT_WRITE = 'REPORT_WRITE',
}

export class ReviewError extends Error {
  constructor(
    public readonly code: ErrorCodes,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ReviewError';
  }
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 250,
    maxDelayMs = 5_000,
    jitter = 0.2,
    shouldRetry = () => true,
  } = options;
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError('attempts must be a positive integer.');
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt === attempts || !shouldRetry(error)) throw error;
      const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const delay = Math.round(ceiling * (1 - jitter + Math.random() * 2 * jitter));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry operation exhausted without a result.');
}

export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message = 'Operation timed out.',
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('timeoutMs must be a positive number.');
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new ReviewError(ErrorCodes.TIMEOUT, message)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}