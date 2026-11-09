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
      expect(agent.tools).toContain('Skill');
      expect(agent.tools).toContain('mcp__github__pull_request_read');
      expect(agent.tools).toContain('mcp__github__get_file_contents');
    }
  });

  it('configures Task for invoking registered specialists', async () => {
    await expect(reviewPullRequest(
      { owner: 'dawgoz', repo: 'sample', number: 1 },
      { GITHUB_PERSONAL_ACCESS_TOKEN: 'test-token' },
    )).rejects.toThrow();
    const options = vi.mocked(query).mock.calls.at(-1)?.[0].options;
    expect(options?.tools).toContain('Task');
    expect(options?.allowedTools).toContain('Task');
    expect(options?.systemPrompt).toContain('use the Task tool');
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

  it('uses ANTHROPIC_MODEL when provided, with CLAUDE_MODEL kept as a fallback', async () => {
    await expect(reviewPullRequest(
      { owner: 'dawgoz', repo: 'sample', number: 1 },
      {
        ANTHROPIC_MODEL: 'configured-model',
        CLAUDE_MODEL: 'legacy-model',
        GITHUB_PERSONAL_ACCESS_TOKEN: 'test-token',
      },
    )).rejects.toThrow();
    expect(vi.mocked(query).mock.calls.at(-1)?.[0].options?.model).toBe('configured-model');
  });

  it('handles API errors reported as a successful SDK result without exposing response text', async () => {
    await expect(reviewPullRequest(
      { owner: 'dawgoz', repo: 'sample', number: 1 },
      { GITHUB_PERSONAL_ACCESS_TOKEN: 'test-token' },
    )).rejects.toMatchObject({
      code: 'AGENT_FAILURE',
      message: 'The Claude provider returned an API error (HTTP 404). Check that ANTHROPIC_MODEL or CLAUDE_MODEL is available through the configured provider.',
    });
  });
});