import { ReviewError, ErrorCodes } from './error-handler.js';
import { ReviewReportSchema } from '../types/review.js';
const requiredAnalyzers = ['code-quality', 'test-coverage', 'refactoring'];
export function finalizeReviewReport(report, target) {
    const analyzerNames = report.analyzers.map((analyzer) => analyzer.analyzer);
    if (analyzerNames.length !== requiredAnalyzers.length ||
        requiredAnalyzers.some((name) => analyzerNames.filter((current) => current === name).length !== 1)) {
        throw new ReviewError(ErrorCodes.INVALID_REPORT, 'The report must contain exactly one result from each required analyzer.');
    }
    if (report.repository.owner.toLowerCase() !== target.owner.toLowerCase() ||
        report.repository.name.toLowerCase() !== target.repo.toLowerCase() ||
        report.repository.pullRequest !== target.number) {
        throw new ReviewError(ErrorCodes.INVALID_REPORT, 'The agent report does not match the requested pull request.');
    }
    const findingMap = new Map();
    for (const finding of report.analyzers.flatMap((analyzer) => analyzer.findings)) {
        const key = [finding.filePath ?? '', finding.line ?? '', finding.severity, finding.title, finding.description].join('\0');
        if (!findingMap.has(key))
            findingMap.set(key, finding);
    }
    const findings = [...findingMap.values()];
    const recommendations = report.recommendations.length
        ? report.recommendations
        : [...new Set(findings.map((finding) => finding.recommendation))];
    const overallScore = Math.round(report.analyzers.reduce((total, analyzer) => total + analyzer.score, 0) / report.analyzers.length);
    return ReviewReportSchema.parse({
        ...report,
        overallScore,
        findings,
        recommendations,
    });
}
