---
name: Publish Weekly Report
slug: publish-weekly-report
summary: Draft the weekly report in reports/weekly-2026-04-01.md from https://status.example.com and get approval before git commit.
generated_by: skillforge
trust_score: 73
---

# Publish Weekly Report

## Objective
Draft the weekly report in reports/weekly-2026-04-01.md from https://status.example.com and get approval before git commit.

## Inputs
- `weekly20260401path` (path): File or directory path detected in the source run. Example: `reports/weekly-2026-04-01.md`.
- `weekly20260401MdRepository` (repo): Repository reference detected in the source run. Example: `reports/weekly-2026-04-01.md`.
- `targetUrl` (url): Target URL detected in the source run. Example: `https://status.example.com`.
- `statusExamplePath` (path): File or directory path detected in the source run. Example: `//status.example.com`.
- `targetDate` (date): Date value detected in the source run. Example: `2026-04-01`.

## Required Tools
- `web_fetch`: web_fetch reads remote information. Risk: low. Approval: none.
- `write_file`: write_file changes files. Risk: medium. Approval: recommended.
- `bash`: command `git commit -am "weekly report"` can change repository or system state. Risk: medium. Approval: recommended.

## Approval Gates
- Approval recommended before run write_file because write_file changes files
- Approval recommended before run bash because command `git commit -am "weekly report"` can change repository or system state

## Execution Plan
1. Draft the weekly report in {{weekly20260401path}} from {{targetUrl}} and get approval before git commit.
2. Draft the weekly report in {{weekly20260401path}} from {{targetUrl}}.
3. Fetch {{targetUrl}}
4. Modify {{weekly20260401path}} with {
  "content": "# Weekly Report\n\nSummarize incidents and uptime.",
  "path": "{{weekly20260401path}}"
}
5. Request approval: Approve the generated report before making a commit.
6. Run command: git commit -am "weekly report"

## Verification
- No explicit verification commands were captured.
