import { z } from 'zod';

export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export const AnalyzerNameSchema = z.enum([
  'code-quality',
  'test-coverage',
  'refactoring',
]);

export const FindingSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  severity: SeveritySchema,
  category: z.string().min(1),
  filePath: z.string().optional(),
  line: z.number().int().positive().optional(),
  recommendation: z.string().min(1),
  codeExample: z.string().optional(),
});

export const AnalyzerResultSchema = z.object({
  analyzer: AnalyzerNameSchema,
  summary: z.string().min(1),
  score: z.number().min(0).max(100),
  findings: z.array(FindingSchema),
  filesReviewed: z.array(z.string()),
  testGaps: z.array(z.string()),
  refactoringOpportunities: z.array(z.string()),
});

export const ReviewReportSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  repository: z.object({
    owner: z.string().min(1),
    name: z.string().min(1),
    pullRequest: z.number().int().positive(),
    title: z.string().min(1),
    url: z.string().url(),
    state: z.string().min(1),
    headSha: z.string().min(1),
  }),
  generatedAt: z.string().datetime(),
  overallScore: z.number().min(0).max(100),
  summary: z.string().min(1),
  analyzers: z.array(AnalyzerResultSchema).length(3),
  findings: z.array(FindingSchema),
  recommendations: z.array(z.string()),
});

export type Severity = z.infer<typeof SeveritySchema>;
export type AnalyzerName = z.infer<typeof AnalyzerNameSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type AnalyzerResult = z.infer<typeof AnalyzerResultSchema>;
export type ReviewReport = z.infer<typeof ReviewReportSchema>;