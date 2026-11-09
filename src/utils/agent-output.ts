import type { SDKAssistantMessageError } from '@anthropic-ai/claude-agent-sdk';
import { ReviewError, ErrorCodes } from './error-handler.js';
import { ReviewReportSchema, type ReviewReport } from '../types/review.js';

export function providerFailure(
  category?: SDKAssistantMessageError,
  status?: number | null,
): ReviewError {
  const statusText = Number.isInteger(status) && status != null && status >= 100 && status <= 599
    ? ` (HTTP ${status})`
    : '';
  if (category === 'authentication_failed' || status === 401) {
    return new ReviewError(ErrorCodes.AUTHENTICATION_FAILED, `The Claude provider rejected authentication${statusText}. Check the API key and provider configuration.`);
  }
  if (category === 'rate_limit' || status === 429) {
    return new ReviewError(ErrorCodes.RATE_LIMITED, `The Claude provider rate-limited the request${statusText}. Retry later or check your provider quota.`);
  }
  const messages: Partial<Record<SDKAssistantMessageError, string>> = {
    billing_error: 'Check the provider account balance and billing.',
    account_on_hold: 'The provider account is on hold.',
    verification_required: 'The provider account requires verification.',
    oauth_org_not_allowed: 'The provider account is not permitted to use this organization.',
    model_not_found: 'Check that ANTHROPIC_MODEL or CLAUDE_MODEL is available through the configured provider.',
    invalid_request: 'The provider rejected the request. Check provider compatibility with the Claude Agent SDK.',
    overloaded: 'The provider is overloaded. Retry later.',
    server_error: 'The provider encountered a server error. Retry later.',
    max_output_tokens: 'The provider output token limit was reached.',
    cloud_credential_error: 'Check the configured cloud provider credentials.',
  };
  const detail = category ? messages[category] : undefined;
  return new ReviewError(
    ErrorCodes.AGENT_FAILURE,
    `The Claude provider returned an API error${statusText}.${detail ? ` ${detail}` : ' Check the provider endpoint and account configuration.'}`,
  );
}

export function parseAgentReport(result: string, structuredOutput?: unknown): ReviewReport {
  if (structuredOutput !== undefined) {
    return validateReport(structuredOutput);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result) as unknown;
  } catch {
    if (/\b(?:agent|agents|subagent|subagents)\b/i.test(result) && /\bbackground\b/i.test(result) && /\b(?:wait|waiting|running|pending)\b/i.test(result)) {
      throw new ReviewError(
        ErrorCodes.AGENT_FAILURE,
        'The review ended before its background agents finished. No report was generated.',
      );
    }
    if (/invalid\s+(?:anthropic\s+)?api\s+key|authentication|unauthorized|\b401\b/i.test(result)) {
      throw new ReviewError(
        ErrorCodes.AUTHENTICATION_FAILED,
        'Claude rejected the configured credentials. Verify ANTHROPIC_API_KEY and the selected provider/model.',
      );
    }

    if (/<(?:!doctype\s+html|html|head|body)\b/i.test(result)) {
      throw new ReviewError(
        ErrorCodes.AGENT_FAILURE,
        'The configured provider returned an HTML page instead of an API response. Check your provider configuration.',
      );
    }

    if (/json.?schema|structured output/i.test(result) && /not supported|unsupported|unavailable/i.test(result)) {
      throw new ReviewError(
        ErrorCodes.AGENT_FAILURE,
        'The configured provider or model does not support JSON Schema structured output required by this review.',
      );
    }

    throw new ReviewError(
      ErrorCodes.AGENT_FAILURE,
      'Claude returned non-JSON output. Verify that the provider and model support JSON Schema structured output.',
    );
  }

  return validateReport(parsed);
}

function validateReport(value: unknown): ReviewReport {
  const validation = ReviewReportSchema.safeParse(value);
  if (!validation.success) {
    throw new ReviewError(
      ErrorCodes.INVALID_REPORT,
      'Claude returned a report that does not match the required review schema.',
    );
  }
  return validation.data;
}