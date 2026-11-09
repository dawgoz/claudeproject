import { describe, expect, it } from 'vitest';
import { parseAgentReport, providerFailure } from '../src/utils/agent-output.js';
import { toClaudeJsonSchema } from '../src/utils/claude-json-schema.js';
import { ErrorCodes } from '../src/utils/error-handler.js';
import { z } from 'zod';

const validReport = {
  schemaVersion: '1.0.0',
  repository: {
    owner: 'dawgoz',
    name: 'sample',
    pullRequest: 1,
    title: 'Update feature',
    url: 'https://github.com/dawgoz/sample/pull/1',
    state: 'open',
    headSha: 'abc123',
  },
  generatedAt: '2026-11-07T12:00:00.000Z',
  overallScore: 80,
  summary: 'Review complete.',
  analyzers: (['code-quality', 'test-coverage', 'refactoring'] as const).map((analyzer) => ({
    analyzer,
    summary: 'Reviewed the change.',
    score: 80,
    findings: [],
    filesReviewed: [],
    testGaps: [],
    refactoringOpportunities: [],
  })),
  findings: [],
  recommendations: [],
};

describe('parseAgentReport', () => {
  it('classifies SDK API errors using their typed category and HTTP status', () => {
    expect(providerFailure('authentication_failed', 401)).toMatchObject({ code: ErrorCodes.AUTHENTICATION_FAILED, message: expect.stringContaining('HTTP 401') });
    expect(providerFailure('rate_limit', 429)).toMatchObject({ code: ErrorCodes.RATE_LIMITED, message: expect.stringContaining('rate-limited') });
    expect(providerFailure('model_not_found', 404).message).toContain('CLAUDE_MODEL');
    expect(providerFailure(undefined, 403).message).toContain('HTTP 403');
    expect(providerFailure(undefined, 12345).message).not.toContain('12345');
  });

  it('omits Zod’s unsupported JSON Schema dialect marker', () => {
    const schema = toClaudeJsonSchema(z.object({ ok: z.boolean() }));
    expect(schema).not.toHaveProperty('$schema');
    expect(schema).toMatchObject({ type: 'object', properties: { ok: { type: 'boolean' } } });
  });

  it('accepts structured output and JSON text', () => {
    expect(parseAgentReport('', validReport)).toEqual(validReport);
    expect(parseAgentReport(JSON.stringify(validReport))).toEqual(validReport);
  });

  it('identifies provider authentication failures without exposing response text', () => {
    expect(() => parseAgentReport('Invalid API key')).toThrowError(
      expect.objectContaining({
        code: ErrorCodes.AUTHENTICATION_FAILED,
        message: expect.stringContaining('ANTHROPIC_API_KEY'),
      }),
    );
  });

  it('identifies an incomplete review with background agents', () => {
    expect(() => parseAgentReport('The three agents are running in the background. I need to wait for their results.')).toThrow(
      'The review ended before its background agents finished. No report was generated.',
    );
  });

  it('classifies HTML endpoint and unsupported structured-output responses without exposing bodies', () => {
    expect(() => parseAgentReport('<html><body>internal gateway details</body></html>')).toThrow(
      'Check your provider configuration.',
    );
    expect(() => parseAgentReport('JSON Schema structured output is not supported')).toThrow(
      'does not support JSON Schema structured output',
    );
    expect(() => parseAgentReport('Temporary provider issue')).toThrow(
      'Verify that the provider and model support JSON Schema structured output',
    );
  });
});