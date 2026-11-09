import 'dotenv/config';
import { resolve } from 'node:path';
import { reviewPullRequest } from './orchestrator.js';
import { ReportGenerator } from './report-generator.js';
import { validateEnvironment } from './cli.js';

const targets = [
  { owner: 'dawgoz', repo: 'claudeproject', number: 1 },
  { owner: 'dawgoz', repo: 'claudeproject', number: 2 },
  { owner: 'dawgoz', repo: 'claudeproject', number: 3 },
];

try {
  validateEnvironment();
  const generator = new ReportGenerator();
  const outputDirectory = resolve(process.env.REPORTS_DIR ?? 'reports');
  let failures = 0;

  for (const target of targets) {
    try {
      const report = await reviewPullRequest(target);
      const files = await generator.generate(report, outputDirectory);
      console.log(`PR #${target.number}: wrote ${files.length} reports.`);
    } catch (error) {
      failures += 1;
      console.error(`PR #${target.number} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures > 0) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}