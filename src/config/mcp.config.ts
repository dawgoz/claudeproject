import type { McpServerConfig } from '@anthropic-ai/claude-agent-sdk';
import { ReviewError, ErrorCodes } from '../utils/error-handler.js';

export function createMcpServers(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, McpServerConfig> {
  const githubToken = env.GITHUB_PERSONAL_ACCESS_TOKEN ?? env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new ReviewError(
      ErrorCodes.MISSING_CONFIGURATION,
      'Set GITHUB_PERSONAL_ACCESS_TOKEN to enable the GitHub MCP server.',
    );
  }

  return {
    github: {
      type: 'http',
      url: 'https://api.githubcopilot.com/mcp/',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        'X-MCP-Toolsets': 'repos,pull_requests',
        'X-MCP-Readonly': 'true',
      },
    },
    eslint: {
      command: process.platform === 'win32' ? 'cmd' : 'npx',
      args:
        process.platform === 'win32'
          ? ['/c', 'npx', '-y', '@eslint/mcp']
          : ['-y', '@eslint/mcp'],
    },
  };
}