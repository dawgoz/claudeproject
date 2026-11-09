import { resolve } from 'node:path';
import { ReviewError, ErrorCodes } from './utils/error-handler.js';
import { reviewPullRequest } from './orchestrator.js';
import { ReportGenerator } from './report-generator.js';

export interface CliArguments {
  owner: string;
  repo: string;
  prNumber: number;
  outputDirectory?: string;
}

export function parseArguments(args: string[]): CliArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key?.startsWith('--')) {
      throw new ReviewError(ErrorCodes.INVALID_ARGUMENT, `Unexpected argument: ${key ?? ''}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new ReviewError(ErrorCodes.INVALID_ARGUMENT, `Missing value for ${key}.`);
    }
    if (!['--owner', '--repo', '--pr-number', '--output-dir'].includes(key)) {
      throw new ReviewError(ErrorCodes.INVALID_ARGUMENT, `Unknown option: ${key}`);
    }
    if (values.has(key)) {
      throw new ReviewError(ErrorCodes.INVALID_ARGUMENT, `Duplicate option: ${key}`);
    }
    values.set(key, value);
    index += 1;
  }

  const owner = values.get('--owner');
  const repo = values.get('--repo');
  const prValue = values.get('--pr-number');
  if (!owner || !repo || !prValue) {
    throw new ReviewError(
      ErrorCodes.INVALID_ARGUMENT,
      'Usage: npm run dev -- --owner <owner> --repo <repo> --pr-number <number> [--output-dir <path>]',
    );
  }
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    throw new ReviewError(ErrorCodes.INVALID_ARGUMENT, 'Owner and repository may contain only letters, digits, dots, underscores, and hyphens.');
  }
  const prNumber = Number(prValue);
  if (!Number.isSafeInteger(prNumber) || prNumber < 1) {
    throw new ReviewError(ErrorCodes.INVALID_ARGUMENT, '--pr-number must be a positive integer.');
  }
  const outputDirectory = values.get('--output-dir');
  return { owner, repo, prNumber, ...(outputDirectory ? { outputDirectory } : {}) };
}

export function validateEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  if (!env.ANTHROPIC_API_KEY) {
    throw new ReviewError(ErrorCodes.MISSING_CONFIGURATION, 'Set ANTHROPIC_API_KEY in your environment or .env file.');
  }
  if (!env.GITHUB_PERSONAL_ACCESS_TOKEN && !env.GITHUB_TOKEN) {
    throw new ReviewError(ErrorCodes.MISSING_CONFIGURATION, 'Set GITHUB_PERSONAL_ACCESS_TOKEN in your environment or .env file.');
  }
}

export async function runCli(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const target = parseArguments(args);
  validateEnvironment(env);
  const report = await reviewPullRequest(
    { owner: target.owner, repo: target.repo, number: target.prNumber },
    env,
  );
  const outputDirectory = resolve(target.outputDirectory ?? env.REPORTS_DIR ?? 'reports');
  const files = await new ReportGenerator().generate(report, outputDirectory);
  return files;
}