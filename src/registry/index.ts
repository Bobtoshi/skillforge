import path from "node:path";
import { readdir, readFile } from "node:fs/promises";

import { compiledSkillSchema, type CompiledSkill, type VerificationReport } from "../contracts.js";
import { writeJson, writeText } from "../io.js";
import { renderOpenClawSkill } from "../exporters/openclaw.js";

export async function writeSkillBundle(
  skill: CompiledSkill,
  verificationReport: VerificationReport,
  outDir: string,
): Promise<{ contractPath: string; skillPath: string; verificationPath: string }> {
  const contractPath = path.join(outDir, "skill.contract.json");
  const skillPath = path.join(outDir, "SKILL.md");
  const verificationPath = path.join(outDir, "verification.report.json");
  const exampleInputsPath = path.join(outDir, "inputs.example.json");

  await writeJson(contractPath, skill);
  await writeText(skillPath, renderOpenClawSkill(skill));
  await writeJson(verificationPath, verificationReport);
  await writeJson(
    exampleInputsPath,
    Object.fromEntries(skill.parameters.map((parameter) => [parameter.name, parameter.example ?? ""])),
  );

  return {
    contractPath,
    skillPath,
    verificationPath,
  };
}

export async function loadCompiledSkill(skillPath: string): Promise<CompiledSkill> {
  const raw = JSON.parse(await readFile(skillPath, "utf8")) as unknown;
  return compiledSkillSchema.parse(raw);
}

export async function buildRegistryIndex(rootDir: string): Promise<
  Array<{
    slug: string;
    name: string;
    trustScore: number;
    path: string;
  }>
> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const contractPath = path.join(rootDir, entry.name, "skill.contract.json");
    try {
      const skill = await loadCompiledSkill(contractPath);
      skills.push({
        slug: skill.slug,
        name: skill.name,
        trustScore: skill.verification.trustScore,
        path: contractPath,
      });
    } catch {
      continue;
    }
  }

  return skills.sort((left, right) => right.trustScore - left.trustScore || left.slug.localeCompare(right.slug));
}
