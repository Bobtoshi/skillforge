# Skillforge

Skillforge turns successful agent traces into reusable skills.

It compiles a source run into:

- a portable `skill.contract.json`
- an OpenClaw-friendly `SKILL.md`
- a `verification.report.json`
- example inputs for reuse

The goal is simple: stop losing good agent work in transcripts. Capture what worked, parameterize it, attach approval gates, and make it reusable across OpenClaw or your own agent stack.

## Why it exists

Most agent tooling can execute one-off tasks, but successful runs usually die as logs. Skillforge promotes a successful trace into a reusable asset:

- extract inputs like paths, URLs, repositories, dates, and emails
- convert raw steps into a reusable execution plan
- infer tool requirements and approval gates
- export an installable markdown skill plus a portable JSON contract
- statically verify that the generated skill can be re-rendered safely

## Install

```bash
npm install
npm run build
```

Or run the CLI directly in development:

```bash
npm run dev -- inspect examples/fix-flaky-test.trace.json
```

## CLI

Compile a trace into a skill bundle:

```bash
npm run dev -- compile examples/fix-flaky-test.trace.json --out generated-skills
```

Inspect a trace without writing files:

```bash
npm run dev -- inspect examples/publish-weekly-report.trace.json
```

Verify a generated contract:

```bash
npm run dev -- verify generated-skills/fix-flaky-auth-test/skill.contract.json
```

List a local skill registry:

```bash
npm run dev -- list generated-skills
```

## Supported input shapes

Skillforge accepts:

- normalized trace JSON with `objective` + `steps`
- objects containing `messages`
- objects containing `events`, `entries`, or `trace`
- JSONL event streams

The compiler is intentionally conservative. It aims to create a useful reusable skill from incomplete data without executing any part of the source trace.

## Output structure

Each compiled skill bundle contains:

- `skill.contract.json`: portable contract for any agent runtime
- `SKILL.md`: Markdown skill for OpenClaw-style skill registries
- `verification.report.json`: static verification result
- `inputs.example.json`: extracted example values

## Development

```bash
npm run check
npm test
npm run build
```

## Roadmap

- adapter plugins for more agent trace formats
- richer policy engines for command risk classification
- replay-backed verification harnesses
- registry publishing and trust receipts
