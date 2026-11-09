import { codeQualityAnalyzerPrompt } from '../prompts/code-quality-analyzer.prompt.js';
import { refactoringSuggesterPrompt } from '../prompts/refactoring-suggester.prompt.js';
import { testCoverageAnalyzerPrompt } from '../prompts/test-coverage-analyzer.prompt.js';
export const reviewAgents = {
    'code-quality-analyzer': {
        description: 'Reviews changed code for supported security, performance, correctness, and maintainability issues.',
        prompt: codeQualityAnalyzerPrompt,
        model: 'inherit',
        tools: ['Read', 'Grep', 'Glob', 'Skill', 'mcp__github__pull_request_read', 'mcp__github__get_file_contents', 'mcp__eslint__lint-files'],
        mcpServers: ['github', 'eslint'],
        skills: ['security-analysis', 'javascript-best-practices'],
        maxTurns: 8,
    },
    'test-coverage-analyzer': {
        description: 'Finds meaningful test gaps and proposes focused tests with assertions.',
        prompt: testCoverageAnalyzerPrompt,
        model: 'inherit',
        tools: ['Read', 'Grep', 'Glob', 'Skill', 'mcp__github__pull_request_read', 'mcp__github__get_file_contents'],
        mcpServers: ['github'],
        skills: ['javascript-best-practices'],
        maxTurns: 8,
    },
    'refactoring-suggester': {
        description: 'Identifies actionable, behavior-preserving refactoring opportunities in changed code.',
        prompt: refactoringSuggesterPrompt,
        model: 'inherit',
        tools: ['Read', 'Grep', 'Glob', 'Skill', 'mcp__github__pull_request_read', 'mcp__github__get_file_contents'],
        mcpServers: ['github'],
        skills: ['javascript-best-practices'],
        maxTurns: 8,
    },
};
