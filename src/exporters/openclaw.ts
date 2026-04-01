import type { CompiledSkill } from "../contracts.js";

export function renderOpenClawSkill(skill: CompiledSkill): string {
  const parameters = skill.parameters.length
    ? skill.parameters
        .map((parameter) => `- \`${parameter.name}\` (${parameter.type}): ${parameter.description}${parameter.example ? ` Example: \`${parameter.example}\`.` : ""}`)
        .join("\n")
    : "- No external inputs required.";

  const tools = skill.requiredTools
    .map(
      (requirement) =>
        `- \`${requirement.name}\`: ${requirement.rationale}. Risk: ${requirement.risk}. Approval: ${requirement.approval}.`,
    )
    .join("\n");

  const steps = skill.steps.map((step, index) => `${index + 1}. ${step.template}`).join("\n");

  const approvals = skill.approvals.length
    ? skill.approvals.map((approval) => `- ${approval.reason}`).join("\n")
    : "- No extra approvals inferred from the source run.";

  const verification = skill.verification.commands.length
    ? skill.verification.commands.map((command) => `- \`${command}\``).join("\n")
    : "- No explicit verification commands were captured.";

  return `---
name: ${skill.name}
slug: ${skill.slug}
summary: ${skill.summary}
generated_by: skillforge
trust_score: ${skill.verification.trustScore}
---

# ${skill.name}

## Objective
${skill.objective}

## Inputs
${parameters}

## Required Tools
${tools}

## Approval Gates
${approvals}

## Execution Plan
${steps}

## Verification
${verification}
`;
}
