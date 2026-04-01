#!/usr/bin/env node

import path from "node:path";
import { Command } from "commander";

import { compileTrace } from "./compiler/compile.js";
import { normalizeTrace } from "./compiler/normalize.js";
import { readStructuredFile } from "./io.js";
import { buildRegistryIndex, loadCompiledSkill, writeSkillBundle } from "./registry/index.js";
import { verifySkill } from "./verifier/verify.js";
import { stableStringify } from "./utils/json.js";

const program = new Command();

program
  .name("skillforge")
  .description("Compile successful agent traces into reusable OpenClaw-compatible skills.")
  .version("0.1.0");

program
  .command("compile")
  .description("Compile a trace file into a portable skill contract and OpenClaw skill markdown.")
  .argument("<trace-file>", "path to a trace JSON or JSONL file")
  .option("-o, --out <dir>", "output directory", "generated-skills")
  .option("-n, --name <name>", "override the generated skill name")
  .option("-s, --source <source>", "override the trace source label")
  .action(async (traceFile, options) => {
    const rawTrace = await readStructuredFile(traceFile);
    const trace = normalizeTrace(rawTrace, {
      source: options.source,
      title: options.name,
    });
    const skill = compileTrace(trace, {
      name: options.name,
    });
    const verification = verifySkill(skill);
    const skillDir = path.join(options.out, skill.slug);
    const bundle = await writeSkillBundle(skill, verification, skillDir);

    process.stdout.write(
      `${stableStringify({
        ok: verification.ok,
        skill: skill.name,
        slug: skill.slug,
        trustScore: verification.trustScore,
        outputs: bundle,
      })}\n`,
    );
  });

program
  .command("verify")
  .description("Verify a compiled skill contract against optional input values.")
  .argument("<skill-contract>", "path to skill.contract.json")
  .option("-i, --inputs <file>", "path to an inputs JSON object")
  .action(async (skillContract, options) => {
    const skill = await loadCompiledSkill(skillContract);
    const inputValues = options.inputs ? ((await readStructuredFile(options.inputs)) as Record<string, string>) : {};
    const report = verifySkill(skill, inputValues);
    process.stdout.write(`${stableStringify(report)}\n`);
    process.exitCode = report.ok ? 0 : 1;
  });

program
  .command("inspect")
  .description("Normalize a trace and print a compilation preview without writing files.")
  .argument("<trace-file>", "path to a trace JSON or JSONL file")
  .option("-n, --name <name>", "override the generated skill name")
  .option("-s, --source <source>", "override the trace source label")
  .action(async (traceFile, options) => {
    const rawTrace = await readStructuredFile(traceFile);
    const trace = normalizeTrace(rawTrace, {
      source: options.source,
      title: options.name,
    });
    const skill = compileTrace(trace, {
      name: options.name,
    });

    process.stdout.write(`${stableStringify(skill)}\n`);
  });

program
  .command("list")
  .description("Build a registry index from a directory of compiled skills.")
  .argument("<skills-dir>", "directory containing skill bundles")
  .action(async (skillsDir) => {
    const registry = await buildRegistryIndex(skillsDir);
    process.stdout.write(`${stableStringify(registry)}\n`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
