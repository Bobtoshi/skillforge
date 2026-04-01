---
name: Fix Flaky Auth Test
slug: fix-flaky-auth-test
summary: Fix the flaky test in tests/auth.spec.ts and verify it with npm test -- auth.
generated_by: skillforge
trust_score: 92
---

# Fix Flaky Auth Test

## Objective
Fix the flaky test in tests/auth.spec.ts and verify it with npm test -- auth.

## Inputs
- `authSpecPath` (path): File or directory path detected in the source run. Example: `tests/auth.spec.ts`.
- `authSpecTsRepository` (repo): Repository reference detected in the source run. Example: `tests/auth.spec.ts`.

## Required Tools
- `read_file`: read_file is a bounded trace step. Risk: low. Approval: none.
- `edit_file`: edit_file changes files. Risk: medium. Approval: recommended.
- `bash`: command `npm test -- auth` looks read-only or verification-focused. Risk: low. Approval: none.

## Approval Gates
- Approval recommended before run edit_file because edit_file changes files

## Execution Plan
1. Fix the flaky test in {{authSpecPath}} and verify it with npm test -- auth.
2. Fix the flaky test in {{authSpecPath}} and make sure npm test -- auth passes.
3. Read {{authSpecPath}}
4. Modify {{authSpecPath}} with {
  "instruction": "Replace the fixed sleep with a waitFor assertion.",
  "path": "{{authSpecPath}}"
}
5. Run command: npm test -- auth
6. Collect artifact {{authSpecPath}}: Updated flaky test with deterministic waiting.

## Verification
- `npm test -- auth`
- `Collect artifact {{authSpecPath}}: Updated flaky test with deterministic waiting.`
