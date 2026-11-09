# DevFlow PR Review System

A read-only TypeScript CLI that uses the Claude Agent SDK to coordinate three focused pull-request analyzers and writes validated JSON, Markdown, and HTML reports.

## Requirements

- Node.js 20 or newer
- An Anthropic API key
- A GitHub personal access token with read access to the target repository

The hosted GitHub MCP server is configured with repository and pull-request toolsets in server-enforced read-only mode. The tool does not post reviews, comments, commits, or other changes. Give the token only the repository content and pull-request read permissions needed for the target repository.

## Setup

```powershell
npm install
```

Create a `.env` file in the project root with your credentials:

```dotenv
ANTHROPIC_API_KEY=your-anthropic-api-key
GITHUB_PERSONAL_ACCESS_TOKEN=your-read-only-github-token
```

The GitHub token can also be supplied as `GITHUB_TOKEN`. `ANTHROPIC_MODEL` selects the model; `CLAUDE_MODEL` remains a supported fallback. If neither is set, the model defaults to `claude-sonnet-4-5`. `REPORTS_DIR` defaults to `reports`.

## Use

```powershell
npm run dev -- --owner dawgoz --repo claudeproject --pr-number 1
```

The command writes one `.json`, `.md`, and `.html` report for that pull request under `reports/`. Replace the PR number with the actual GitHub pull request number. After building, use `npm start -- --owner ... --repo ... --pr-number ...`.

To generate all nine requested deliverables for PRs #1, #2, and #3:

```powershell
npm run reports:required
```

The three agents are registered as `code-quality-analyzer`, `test-coverage-analyzer`, and `refactoring-suggester`. They use project skills under `.claude/skills/`; results are checked against the shared Zod `ReviewReport` schema before files are written.

## Development

```powershell
npm run build
npm test
npm run lint
```

Tests cover schema acceptance/rejection, CLI validation, retry and timeout behavior, sliding-window and concurrency limits, report writing, and HTML escaping. Live PR analysis requires valid credentials and network access; it is not part of the offline test suite. ESLint MCP can lint files available in the local workspace; it should not be treated as evidence about a remote PR revision unless that revision is checked out locally.