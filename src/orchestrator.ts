import { query, type SDKAssistantMessageError } from '@anthropic-ai/claude-agent-sdk';
import { createMcpServers } from './config/mcp.config.js';
import { reviewAgents } from './agents/index.js';
import { orchestratorPrompt } from './prompts/orchestrator.prompt.js';
import { ReviewError, ErrorCodes } from './utils/error-handler.js';
import { parseAgentReport, providerFailure } from './utils/agent-output.js';
import { finalizeReviewReport } from './utils/report-aggregation.js';
import { toClaudeJsonSchema } from './utils/claude-json-schema.js';
import { ReviewReportSchema, type ReviewReport } from './types/review.js';

const ReviewReportJsonSchema = toClaudeJsonSchema(ReviewReportSchema);

export interface PullRequestTarget {
  owner: string;
  repo: string;
  number: number;
}

export async function reviewPullRequest(
  target: PullRequestTarget,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ReviewReport> {
  const prompt = `Review pull request #${target.number} in ${target.owner}/${target.repo}. Fetch its metadata and changed files using GitHub MCP, then delegate to all three specialists. Return the complete validated report.`;

  try {
    let report: ReviewReport | undefined;
    let providerError: SDKAssistantMessageError | undefined;
    const sdkEnv = { ...process.env };
    delete sdkEnv.ANTHROPIC_BASE_URL;
    for await (const message of query({
      prompt,
      options: {
        model: env.ANTHROPIC_MODEL ?? env.CLAUDE_MODEL ?? 'claude-sonnet-4-5',
        env: sdkEnv,
        cwd: process.cwd(),
        settingSources: ['project'],
        tools: ['Task', 'Read', 'Grep', 'Glob'],
        agents: reviewAgents,
        mcpServers: createMcpServers(env),
        allowedTools: [
          'Task',
          'mcp__github__pull_request_read',
          'mcp__github__get_file_contents',
          'mcp__eslint__lint-files',
        ],
        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJsonSchema,
        },
        systemPrompt: orchestratorPrompt,
        maxTurns: 30,
      },
    })) {
      if (message.type === 'assistant' && message.error) {
        providerError = message.error;
      }
      if (message.type !== 'result') continue;
      if (message.subtype !== 'success') {
        if (providerError) throw providerFailure(providerError);
        throw new ReviewError(
          ErrorCodes.AGENT_FAILURE,
          `The review agent did not complete successfully (${message.subtype}).`,
        );
      }

      if (message.is_error) throw providerFailure(providerError, message.api_error_status);
      report = parseAgentReport(message.result, message.structured_output);
    }

    if (!report) {
      throw new ReviewError(ErrorCodes.AGENT_FAILURE, 'The agent returned no review report.');
    }
    return finalizeReviewReport(report, target);
  } catch (error) {
    if (error instanceof ReviewError) throw error;
    throw new ReviewError(
      ErrorCodes.AGENT_FAILURE,
      `Pull request analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}