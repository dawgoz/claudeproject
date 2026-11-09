import { describe, expect, it } from 'vitest';
import { createMcpServers } from '../src/config/mcp.config.js';

describe('MCP configuration', () => {
  it('requires a GitHub token without including secret values in errors', () => {
    expect(() => createMcpServers({})).toThrow('GITHUB_PERSONAL_ACCESS_TOKEN');
    expect(() => createMcpServers({ GITHUB_TOKEN: 'test-token' })).not.toThrow();
  });

  it('uses the hosted GitHub endpoint with read-only repository and PR toolsets', () => {
    const servers = createMcpServers({ GITHUB_PERSONAL_ACCESS_TOKEN: 'test-token' });
    expect(servers.github).toMatchObject({
      type: 'http',
      url: 'https://api.githubcopilot.com/mcp/',
      headers: {
        Authorization: 'Bearer test-token',
        'X-MCP-Toolsets': 'repos,pull_requests',
        'X-MCP-Readonly': 'true',
      },
    });
  });

  it('starts the ESLint MCP server through the platform-appropriate npx command', () => {
    const servers = createMcpServers({ GITHUB_PERSONAL_ACCESS_TOKEN: 'test-token' });
    expect(servers.eslint).toMatchObject({
      command: process.platform === 'win32' ? 'cmd' : 'npx',
      args: process.platform === 'win32'
        ? ['/c', 'npx', '-y', '@eslint/mcp']
        : ['-y', '@eslint/mcp'],
    });
  });
});