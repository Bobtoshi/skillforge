import { compiledSkillSchema, verificationReportSchema, type CompiledSkill, type VerificationReport } from "../contracts.js";
import { renderTemplate } from "../compiler/parameterize.js";

export function verifySkill(skillInput: CompiledSkill, providedInputs: Record<string, string> = {}): VerificationReport {
  const skill = compiledSkillSchema.parse(skillInput);
  const missingInputs = skill.parameters
    .filter((parameter) => parameter.required && !providedInputs[parameter.name] && !parameter.example)
    .map((parameter) => parameter.name);
  const resolvedInputs = Object.fromEntries(
    skill.parameters.map((parameter) => [parameter.name, providedInputs[parameter.name] ?? parameter.example ?? ""]),
  );
  const renderedSteps = skill.steps.map((step) => renderTemplate(step.template, resolvedInputs));
  const unresolvedTemplates = renderedSteps.filter((step) => /\{\{.+?\}\}/.test(step));
  const issues: VerificationReport["issues"] = [];

  if (missingInputs.length > 0) {
    issues.push({
      level: "error",
      message: `Missing required inputs: ${missingInputs.join(", ")}`,
    });
  }

  if (unresolvedTemplates.length > 0) {
    issues.push({
      level: "error",
      message: "Rendered steps still contain unresolved placeholders.",
    });
  }

  if (skill.approvals.length > 0) {
    issues.push({
      level: "warning",
      message: `${skill.approvals.length} approval gate(s) must be acknowledged before execution.`,
    });
  }

  if (skill.verification.commands.length === 0) {
    issues.push({
      level: "warning",
      message: "No explicit verification commands were captured in the source trace.",
    });
  }

  if (skill.verification.trustScore < 60) {
    issues.push({
      level: "warning",
      message: `Trust score is low (${skill.verification.trustScore}). Review before reuse.`,
    });
  }

  return verificationReportSchema.parse({
    skillId: skill.id,
    ok: issues.every((issue) => issue.level !== "error"),
    renderedSteps,
    missingInputs,
    unresolvedTemplates,
    issues,
    trustScore: skill.verification.trustScore,
  });
}
