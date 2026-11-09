export var ErrorCodes;
(function (ErrorCodes) {
    ErrorCodes["INVALID_ARGUMENT"] = "INVALID_ARGUMENT";
    ErrorCodes["MISSING_CONFIGURATION"] = "MISSING_CONFIGURATION";
    ErrorCodes["AUTHENTICATION_FAILED"] = "AUTHENTICATION_FAILED";
    ErrorCodes["RATE_LIMITED"] = "RATE_LIMITED";
    ErrorCodes["TIMEOUT"] = "TIMEOUT";
    ErrorCodes["AGENT_FAILURE"] = "AGENT_FAILURE";
    ErrorCodes["INVALID_REPORT"] = "INVALID_REPORT";
    ErrorCodes["REPORT_WRITE"] = "REPORT_WRITE";
})(ErrorCodes || (ErrorCodes = {}));
export class ReviewError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
        this.name = 'ReviewError';
    }
}
export async function withRetry(operation, options = {}) {
    const { attempts = 3, baseDelayMs = 250, maxDelayMs = 5_000, jitter = 0.2, shouldRetry = () => true, } = options;
    if (!Number.isInteger(attempts) || attempts < 1) {
        throw new RangeError('attempts must be a positive integer.');
    }
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await operation(attempt);
        }
        catch (error) {
            if (attempt === attempts || !shouldRetry(error))
                throw error;
            const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
            const delay = Math.round(ceiling * (1 - jitter + Math.random() * 2 * jitter));
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw new Error('Retry operation exhausted without a result.');
}
export async function withTimeout(operation, timeoutMs, message = 'Operation timed out.') {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new RangeError('timeoutMs must be a positive number.');
    }
    let timeout;
    try {
        return await Promise.race([
            operation,
            new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new ReviewError(ErrorCodes.TIMEOUT, message)), timeoutMs);
            }),
        ]);
    }
    finally {
        if (timeout)
            clearTimeout(timeout);
    }
}
