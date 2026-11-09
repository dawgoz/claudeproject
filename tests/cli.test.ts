import { describe, expect, it } from 'vitest';
import { parseArguments, validateEnvironment } from '../src/cli.js';

describe('CLI input validation', () => {
  it('parses a valid pull request target', () => {
    expect(parseArguments(['--owner', 'dawgoz', '--repo', 'sample-repo', '--pr-number', '17'])).toEqual({
      owner: 'dawgoz',
      repo: 'sample-repo',
      prNumber: 17,
    });
  });

  it('rejects missing, duplicate, malformed, and unknown arguments', () => {
    expect(() => parseArguments([])).toThrow('Usage:');
    expect(() => parseArguments(['--owner', 'dawgoz', '--owner', 'other', '--repo', 'sample', '--pr-number', '1'])).toThrow('Duplicate');
    expect(() => parseArguments(['--owner', 'dawgoz', '--repo', 'sample', '--pr-number', '0'])).toThrow('positive integer');
    expect(() => parseArguments(['--other', 'value'])).toThrow('Unknown option');
  });

  it('requires API credentials without exposing secret values', () => {
    expect(() => validateEnvironment({})).toThrow('ANTHROPIC_API_KEY');
    expect(() => validateEnvironment({ ANTHROPIC_API_KEY: 'test' })).toThrow('GITHUB_PERSONAL_ACCESS_TOKEN');
  });
});