import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReviewError, ErrorCodes } from './utils/error-handler.js';
import { ReviewReportSchema } from './types/review.js';
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
function renderMarkdown(report) {
    const findings = report.findings.length
        ? report.findings
            .map((finding) => {
            const location = finding.filePath
                ? ` (${finding.filePath}${finding.line ? `:${finding.line}` : ''})`
                : '';
            return `- **${finding.severity.toUpperCase()}** ${finding.title}${location}\n  ${finding.description}\n  Recommendation: ${finding.recommendation}${finding.codeExample ? `\n\n  \`\`\`\n  ${finding.codeExample.replaceAll('\n', '\n  ')}\n  \`\`\`` : ''}`;
        })
            .join('\n\n')
        : '- No findings were reported by the analyzers.';
    return `# Pull Request Review: ${report.repository.owner}/${report.repository.name} #${report.repository.pullRequest}

**${report.repository.title}**  
${report.repository.url}  
Generated: ${report.generatedAt}  
Overall score: **${report.overallScore}/100**

## Summary

${report.summary}

## Findings

${findings}

## Analyzer Scores

${report.analyzers.map((analyzer) => `- **${analyzer.analyzer}**: ${analyzer.score}/100 - ${analyzer.summary}`).join('\n')}

## Recommendations

${report.recommendations.length ? report.recommendations.map((item) => `- ${item}`).join('\n') : '- No additional recommendations.'}
`;
}
function renderHtml(report) {
    const markdownSafe = (value) => escapeHtml(value).replaceAll('\n', '<br>');
    const findings = report.findings.length
        ? report.findings.map((finding) => `<article class="finding"><div class="finding-heading"><span class="severity ${finding.severity}">${escapeHtml(finding.severity)}</span><strong>${escapeHtml(finding.title)}</strong></div><p>${markdownSafe(finding.description)}</p>${finding.filePath ? `<p class="location"><code>${escapeHtml(finding.filePath)}${finding.line ? `:${finding.line}` : ''}</code></p>` : ''}<p><strong>Recommendation:</strong> ${markdownSafe(finding.recommendation)}</p>${finding.codeExample ? `<pre><code>${escapeHtml(finding.codeExample)}</code></pre>` : ''}</article>`).join('\n')
        : '<p>No findings were reported by the analyzers.</p>';
    const analyzers = report.analyzers.map((analyzer) => `<tr><th>${escapeHtml(analyzer.analyzer)}</th><td>${analyzer.score}/100</td><td>${escapeHtml(analyzer.summary)}</td></tr>`).join('\n');
    const recommendations = report.recommendations.length
        ? `<ul>${report.recommendations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : '<p>No additional recommendations.</p>';
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PR #${report.repository.pullRequest} Review - ${escapeHtml(report.repository.name)}</title>
  <style>
    :root{color-scheme:light;--ink:#17212b;--muted:#52616b;--line:#d8e0e5;--paper:#fff;--wash:#f3f6f7;--red:#a12828;--orange:#8a4b08;--green:#17623c}
    *{box-sizing:border-box}body{margin:0;background:var(--wash);color:var(--ink);font:16px/1.6 system-ui,sans-serif}
    main{max-width:920px;margin:32px auto;padding:32px;background:var(--paper);border:1px solid var(--line);border-radius:8px}
    h1{font-size:1.75rem;line-height:1.2;margin:0 0 8px}h2{font-size:1.2rem;margin:32px 0 12px;border-bottom:1px solid var(--line);padding-bottom:8px}
    .meta,.location{color:var(--muted);font-size:.92rem}.score{font-weight:700;font-size:1.25rem;margin:20px 0}
    .finding{border-top:1px solid var(--line);padding:16px 0}.finding-heading{display:flex;align-items:center;gap:12px}.severity{text-transform:uppercase;font-size:.75rem;font-weight:700;padding:2px 8px;border-radius:4px;background:#e8edf0}
    .severity.critical,.severity.high{color:var(--red);background:#fbe9e7}.severity.medium{color:var(--orange);background:#fff1dc}.severity.low,.severity.info{color:var(--green);background:#e5f3eb}
    pre{overflow:auto;background:#f3f6f7;padding:12px;border-radius:4px}code{font-family:ui-monospace,monospace}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--line)}
    @media(max-width:600px){main{margin:0;padding:20px;border:0;border-radius:0}}
    @media print{body{background:#fff}main{max-width:none;margin:0;border:0;padding:0}}
  </style>
</head>
<body><main>
  <h1>Pull Request Review</h1>
  <p><strong>${escapeHtml(report.repository.owner)}/${escapeHtml(report.repository.name)} #${report.repository.pullRequest}: ${escapeHtml(report.repository.title)}</strong></p>
  <p class="meta"><a href="${escapeHtml(report.repository.url)}">Open pull request</a> · ${escapeHtml(report.generatedAt)} · ${escapeHtml(report.repository.state)} · ${escapeHtml(report.repository.headSha)}</p>
  <p class="score">Overall score: ${report.overallScore}/100</p>
  <h2>Summary</h2><p>${markdownSafe(report.summary)}</p>
  <h2>Findings</h2>${findings}
  <h2>Analyzer Scores</h2><table><thead><tr><th>Analyzer</th><th>Score</th><th>Summary</th></tr></thead><tbody>${analyzers}</tbody></table>
  <h2>Recommendations</h2>${recommendations}
</main></body></html>`;
}
export class ReportGenerator {
    async generate(reportInput, outputDirectory) {
        const report = ReviewReportSchema.parse(reportInput);
        const prefix = `${report.repository.owner}-${report.repository.name}-pr-${report.repository.pullRequest}`
            .replace(/[^a-zA-Z0-9._-]/g, '-');
        const files = [
            { path: join(outputDirectory, `${prefix}.json`), content: `${JSON.stringify(report, null, 2)}\n` },
            { path: join(outputDirectory, `${prefix}.md`), content: renderMarkdown(report) },
            { path: join(outputDirectory, `${prefix}.html`), content: renderHtml(report) },
        ];
        try {
            await mkdir(outputDirectory, { recursive: true });
            await Promise.all(files.map((file) => writeFile(file.path, file.content, 'utf8')));
            return files.map((file) => file.path);
        }
        catch (error) {
            throw new ReviewError(ErrorCodes.REPORT_WRITE, `Could not write reports to ${outputDirectory}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
        }
    }
}
