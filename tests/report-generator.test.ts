import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ReportGenerator } from '../src/report-generator.js';
import type { ReviewReport } from '../src/types/review.js';

const outputDirectories: string[] = [];

const report: ReviewReport = {
  schemaVersion: '1.0.0',
  repository: {
    owner: 'dawgoz',
    name: 'sample',
    pullRequest: 2,
    title: 'Escape <script> content',
    url: 'https://github.com/dawgoz/sample/pull/2',
    state: 'open',
    headSha: 'abc123',
  },
  generatedAt: '2026-11-07T12:00:00.000Z',
  overallScore: 80,
  summary: 'Review completed.',
  analyzers: (['code-quality', 'test-coverage', 'refactoring'] as const).map((analyzer) => ({
    analyzer,
    summary: 'Reviewed changed code.',
    score: 80,
    findings: [],
    filesReviewed: ['src/index.ts'],
    testGaps: [],
    refactoringOpportunities: [],
  })),
  findings: [{
    title: '<script>alert(1)</script>',
    description: 'Description with <tag>.',
    severity: 'high',
    category: 'security',
    filePath: 'src/index.ts',
    line: 5,
    recommendation: 'Escape output.',
    codeExample: 'const safe = "<value>";',
  }],
  recommendations: ['Add an output encoding test.'],
};

afterEach(async () => {
  await Promise.all(outputDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('ReportGenerator', () => {
  it('writes valid JSON, Markdown, and escaped HTML reports', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devflow-reports-'));
    outputDirectories.push(directory);
    const files = await new ReportGenerator().generate(report, directory);
    expect(files).toHaveLength(3);
    const json = JSON.parse(await readFile(files[0]!, 'utf8')) as ReviewReport;
    expect(json).toEqual(report);
    expect(await readFile(files[1]!, 'utf8')).toContain('## Findings');
    const html = await readFile(files[2]!, 'utf8');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('does not render non-HTTPS repository URLs as links', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devflow-reports-'));
    outputDirectories.push(directory);
    const unsafeReport = {
      ...report,
      repository: { ...report.repository, url: 'javascript:alert(1)' },
    };
    const files = await new ReportGenerator().generate(unsafeReport, directory);
    const html = await readFile(files[2]!, 'utf8');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('Pull request link unavailable');
  });
});