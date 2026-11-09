import { describe, expect, it } from 'vitest';
import { ReviewReportSchema } from '../src/types/review.js';
import { finalizeReviewReport } from '../src/utils/report-aggregation.js';

const analyzer = (name: 'code-quality' | 'test-coverage' | 'refactoring') => ({
  analyzer: name,
  summary: 'Reviewed the changed files.',
  score: 82,
  findings: [],
  filesReviewed: ['src/index.ts'],
  testGaps: [],
  refactoringOpportunities: [],
});

const validReport = {
  schemaVersion: '1.0.0',
  repository: {
    owner: 'dawgoz',
    name: 'sample',
    pullRequest: 12,
    title: 'Add feature',
    url: 'https://github.com/dawgoz/sample/pull/12',
    state: 'open',
    headSha: 'abc123',
  },
  generatedAt: '2026-11-07T12:00:00.000Z',
  overallScore: 82,
  summary: 'The change is in good shape.',
  analyzers: [analyzer('code-quality'), analyzer('test-coverage'), analyzer('refactoring')],
  findings: [],
  recommendations: ['Add a focused regression test.'],
};

describe('ReviewReportSchema', () => {
  it('accepts a populated report with all three analyzer results', () => {
    expect(ReviewReportSchema.parse(validReport)).toEqual(validReport);
  });

  it('rejects missing analyzers and invalid scores', () => {
    expect(ReviewReportSchema.safeParse({ ...validReport, analyzers: [] }).success).toBe(false);
    expect(ReviewReportSchema.safeParse({ ...validReport, overallScore: 101 }).success).toBe(false);
  });

  it('rejects invalid finding locations and timestamps', () => {
    const invalidFinding = {
      title: 'Missing guard',
      description: 'A required value is not checked.',
      severity: 'high',
      category: 'correctness',
      line: 0,
      recommendation: 'Validate the value before use.',
    };
    expect(ReviewReportSchema.safeParse({ ...validReport, findings: [invalidFinding] }).success).toBe(false);
    expect(ReviewReportSchema.safeParse({ ...validReport, generatedAt: 'yesterday' }).success).toBe(false);
  });

  it('derives the overall score and findings from the three analyzer results', () => {
    const report = {
      ...validReport,
      overallScore: 0,
      findings: [],
      analyzers: [
        { ...analyzer('code-quality'), score: 80, findings: [{ title: 'Validate input', description: 'Input is unchecked.', severity: 'high' as const, category: 'correctness', filePath: 'src/index.ts', line: 4, recommendation: 'Validate before use.' }] },
        { ...analyzer('test-coverage'), score: 70 },
        { ...analyzer('refactoring'), score: 90 },
      ],
      recommendations: [],
    };
    const finalized = finalizeReviewReport(report, { owner: 'dawgoz', repo: 'sample', number: 12 });
    expect(finalized.overallScore).toBe(80);
    expect(finalized.findings).toHaveLength(1);
    expect(finalized.recommendations).toEqual(['Validate before use.']);
  });

  it('rejects duplicate analyzer results and reports for a different PR', () => {
    expect(() => finalizeReviewReport({ ...validReport, analyzers: [analyzer('code-quality'), analyzer('code-quality'), analyzer('refactoring')] }, { owner: 'dawgoz', repo: 'sample', number: 12 })).toThrow('exactly one result');
    expect(() => finalizeReviewReport(validReport, { owner: 'dawgoz', repo: 'sample', number: 99 })).toThrow('does not match');
  });
});