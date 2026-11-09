import { describe, expect, it, vi } from 'vitest';
import { query } from '@anthropic-ai/claude-agent-sdk';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(async function* () {
    yield { type: 'assistant', error: 'model_not_found' };
    yield {
      type: 'result',
      subtype: 'success',
      is_error: true,
      api_error_status: 404,
      result: 'Sensitive provider response must not be shown.',
    };
  }),
}));

import { reviewPullRequest } from '../src/orchestrator.js';
import { reviewAgents } from '../src/agents/index.js';

describe('reviewPullRequest', () => {
  it('gives each specialist access to the remote PR and repository files', () => {
    for (const agent of Object.values(reviewAgents)) {
      expect(agent.tools).toContain('mcp__github__pull_request_read');
      expect(agent.tools).toContain('mcp__github__get_file_contents');
    }
  });

  it('does not pass a custom Anthropic base URL to the SDK', async () => {
    vi.stubEnv('ANTHROPIC_BASE_URL', 'https://example.invalid');
    try {
      await expect(reviewPullRequest(
        { owner: 'dawgoz', repo: 'sample', number: 1 },
        { GITHUB_PERSONAL_ACCESS_TOKEN: 'test-token' },
      )).rejects.toThrow();
      const call = vi.mocked(query).mock.calls.at(-1);
      expect(call?.[0].options?.env).not.toHaveProperty('ANTHROPIC_BASE_URL');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('handles API errors reported as a successful SDK result without exposing response text', async () => {
    await expect(reviewPullRequest(
      { owner: 'dawgoz', repo: 'sample', number: 1 },
      { GITHUB_PERSONAL_ACCESS_TOKEN: 'test-token' },
    )).rejects.toMatchObject({
      code: 'AGENT_FAILURE',
      message: 'The Claude provider returned an API error (HTTP 404). Check that CLAUDE_MODEL is available through the configured provider.',
    });
  });
});