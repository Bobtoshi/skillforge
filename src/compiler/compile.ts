import { compiledSkillSchema, type CompiledSkill, type NormalizedTrace, type SkillApproval, type SkillRequirement, type SkillStep } from "../contracts.js";
import { applyParameters, extractParameters } from "./parameterize.js";
import { clamp, slugify, toTitleCase, truncate } from "../utils/text.js";
import { isRecord, stableStringify } from "../utils/json.js";

type CompileOptions = {
  name?: string;
  slug?: string;
};

const READ_ONLY_COMMAND_PATTERNS = [
  /^git status\b/i,
  /^git diff\b/i,
  /^rg\b/i,
  /^ls\b/i,
  /^find\b/i,
  /^cat\b/i,
  /^sed -n\b/i,
  /^wc\b/i,
  /^(npm|pnpm|yarn|bun)\s+(test|lint|typecheck|check)\b/i,
  /^(vitest|jest|pytest|cargo test|go test)\b/i,
];

const HIGH_RISK_COMMAND_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bsudo\b/i,
  /\bgit reset --hard\b/i,
  /\bcurl\b.+\|\s*(sh|bash|zsh)\b/i,
  /\bnpm publish\b/i,
  /\bpnpm publish\b/i,
  /\byarn publish\b/i,
  /\bgh repo create\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
];

const MEDIUM_RISK_COMMAND_PATTERNS = [
  /\bgit add\b/i,
  /\bgit commit\b/i,
  /\bgit push\b/i,
  /\bgh pr create\b/i,
  /\bmkdir\b/i,
  /\bnpm install\b/i,
  /\bpnpm add\b/i,
  /\byarn add\b/i,
  /\bbrew install\b/i,
  /\bpip install\b/i,
  /\bgit clone\b/i,
];

export function compileTrace(trace: NormalizedTrace, options: CompileOptions = {}): CompiledSkill {
  const parameters = extractParameters(trace);
  const slug = options.slug ?? slugify(options.name ?? trace.metadata.title ?? trace.objective);
  const name = options.name ?? toTitleCase(slug.replace(/-/g, " "));
  const steps = buildSteps(trace, parameters);
  const requirements = buildRequirements(trace);
  const approvals = buildApprovals(steps, requirements);
  const verificationCommands = steps
    .filter((step) => step.kind === "verification")
    .map((step) => stripLeadingLabel(step.template));
  const warnings = approvals.map((approval) => approval.reason);
  const trustScore = scoreSkill(parameters.length, requirements, approvals.length, verificationCommands.length);

  return compiledSkillSchema.parse({
    id: `skillforge:${slug}`,
    slug,
    name,
    summary: truncate(trace.objective, 140),
    objective: trace.objective,
    source: {
      sourceType: trace.metadata.source,
      title: trace.metadata.title,
      generatedAt: new Date().toISOString(),
    },
    parameters,
    requiredTools: requirements,
    approvals,
    steps,
    verification: {
      checklist: [
        "Resolve all required inputs before execution.",
        "Confirm approval gates before any medium or high risk operations.",
        "Run verification commands and inspect outputs before publishing the skill.",
      ],
      commands: verificationCommands,
      warnings,
      trustScore,
    },
  });
}

function buildSteps(trace: NormalizedTrace, parameters: CompiledSkill["parameters"]): SkillStep[] {
  const steps: SkillStep[] = [];

  steps.push({
    id: "step-1",
    title: "Restate objective",
    kind: "instruction",
    template: applyParameters(trace.objective, parameters),
  });

  let index = 2;
  for (const step of trace.steps) {
    if (step.kind === "message") {
      if (step.role !== "user") {
        continue;
      }

      steps.push({
        id: `step-${index++}`,
        title: "User instruction",
        kind: "instruction",
        template: applyParameters(step.content, parameters),
      });
      continue;
    }

    if (step.kind === "approval") {
      steps.push({
        id: `step-${index++}`,
        title: "Manual approval",
        kind: "instruction",
        template: `Request approval: ${applyParameters(step.reason, parameters)}`,
      });
      continue;
    }

    if (step.kind === "artifact") {
      steps.push({
        id: `step-${index++}`,
        title: "Capture artifact",
        kind: "verification",
        template: `Collect artifact ${applyParameters(step.path, parameters)}${step.summary ? `: ${applyParameters(step.summary, parameters)}` : ""}`,
      });
      continue;
    }

    const toolTemplate = buildToolTemplate(step.tool, step.input, parameters);
    const kind = isVerificationTool(step.tool, step.input) ? "verification" : "tool";
    steps.push({
      id: `step-${index++}`,
      title: kind === "verification" ? `Verify with ${step.tool}` : `Run ${step.tool}`,
      kind,
      tool: step.tool,
      template: toolTemplate,
    });
  }

  return steps;
}

function buildToolTemplate(
  toolName: string,
  input: unknown,
  parameters: CompiledSkill["parameters"],
): string {
  if (toolName === "bash" && isRecord(input) && typeof input.command === "string") {
    return `Run command: ${applyParameters(input.command, parameters)}`;
  }

  if (toolName.includes("read") && isRecord(input) && typeof input.path === "string") {
    return `Read ${applyParameters(input.path, parameters)}`;
  }

  if ((toolName.includes("write") || toolName.includes("edit")) && isRecord(input) && typeof input.path === "string") {
    return `Modify ${applyParameters(input.path, parameters)} with ${applyParameters(stableStringify(input), parameters)}`;
  }

  if ((toolName.includes("web") || toolName.includes("fetch") || toolName.includes("http")) && isRecord(input)) {
    const url = typeof input.url === "string" ? input.url : typeof input.href === "string" ? input.href : undefined;
    if (url) {
      return `Fetch ${applyParameters(url, parameters)}`;
    }
  }

  return `Call ${toolName} with ${applyParameters(stableStringify(input ?? {}), parameters)}`;
}

function buildRequirements(trace: NormalizedTrace): SkillRequirement[] {
  const requirements = new Map<string, SkillRequirement>();

  trace.steps.forEach((step) => {
    if (step.kind !== "tool") {
      return;
    }

    const requirement = requirements.get(step.tool) ?? {
      name: step.tool,
      operations: [],
      risk: "low",
      approval: "none",
      rationale: `Observed in source trace via ${step.tool}.`,
    };

    const operation = describeToolOperation(step.tool, step.input);
    if (operation && !requirement.operations.includes(operation)) {
      requirement.operations.push(operation);
    }

    const nextClassification = classifyStepRisk(step.tool, step.input);
    requirement.risk = highestRisk(requirement.risk, nextClassification.risk);
    requirement.approval = highestApproval(requirement.approval, nextClassification.approval);
    requirement.rationale = nextClassification.rationale;

    requirements.set(step.tool, requirement);
  });

  return Array.from(requirements.values());
}

function buildApprovals(steps: SkillStep[], requirements: SkillRequirement[]): SkillApproval[] {
  const approvals: SkillApproval[] = [];
  const byTool = new Map(requirements.map((requirement) => [requirement.name, requirement]));

  for (const step of steps) {
    if (step.kind === "tool" || step.kind === "verification") {
      const requirement = step.tool ? byTool.get(step.tool) : undefined;
      if (requirement && requirement.approval !== "none") {
        approvals.push({
          stepId: step.id,
          reason: `${requirement.approval === "required" ? "Approval required" : "Approval recommended"} before ${step.title.toLowerCase()} because ${requirement.rationale.toLowerCase()}`,
          risk: requirement.risk,
        });
      }
    }
  }

  return approvals;
}

function describeToolOperation(toolName: string, input: unknown): string {
  if (toolName === "bash" && isRecord(input) && typeof input.command === "string") {
    return input.command;
  }

  if (isRecord(input) && typeof input.path === "string") {
    return `${toolName}:${input.path}`;
  }

  return toolName;
}

function classifyStepRisk(toolName: string, input: unknown): {
  risk: SkillRequirement["risk"];
  approval: SkillRequirement["approval"];
  rationale: string;
} {
  if (toolName === "bash" && isRecord(input) && typeof input.command === "string") {
    const command = input.command.trim();
    if (HIGH_RISK_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
      return {
        risk: "high",
        approval: "required",
        rationale: `command \`${command}\` can mutate state outside the current task`,
      };
    }

    if (MEDIUM_RISK_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
      return {
        risk: "medium",
        approval: "recommended",
        rationale: `command \`${command}\` can change repository or system state`,
      };
    }

    if (READ_ONLY_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
      return {
        risk: "low",
        approval: "none",
        rationale: `command \`${command}\` looks read-only or verification-focused`,
      };
    }

    return {
      risk: "medium",
      approval: "recommended",
      rationale: `command \`${command}\` is not classified as read-only`,
    };
  }

  if (toolName.includes("edit") || toolName.includes("write") || toolName.includes("delete")) {
    return {
      risk: "medium",
      approval: "recommended",
      rationale: `${toolName} changes files`,
    };
  }

  if (toolName.includes("fetch") || toolName.includes("web") || toolName.includes("search")) {
    return {
      risk: "low",
      approval: "none",
      rationale: `${toolName} reads remote information`,
    };
  }

  return {
    risk: "low",
    approval: "none",
    rationale: `${toolName} is a bounded trace step`,
  };
}

function highestRisk(left: SkillRequirement["risk"], right: SkillRequirement["risk"]): SkillRequirement["risk"] {
  const order = { low: 0, medium: 1, high: 2 };
  return order[right] > order[left] ? right : left;
}

function highestApproval(
  left: SkillRequirement["approval"],
  right: SkillRequirement["approval"],
): SkillRequirement["approval"] {
  const order = { none: 0, recommended: 1, required: 2 };
  return order[right] > order[left] ? right : left;
}

function isVerificationTool(toolName: string, input: unknown): boolean {
  if (toolName !== "bash" || !isRecord(input) || typeof input.command !== "string") {
    return false;
  }

  const command = input.command.trim();
  return READ_ONLY_COMMAND_PATTERNS.some((pattern) => pattern.test(command));
}

function scoreSkill(
  parameterCount: number,
  requirements: SkillRequirement[],
  approvalCount: number,
  verificationCommandCount: number,
): number {
  const toolCount = requirements.length;
  const highRiskCount = requirements.filter((requirement) => requirement.risk === "high").length;
  const mediumRiskCount = requirements.filter((requirement) => requirement.risk === "medium").length;
  const raw = 92 - highRiskCount * 18 - mediumRiskCount * 8 - approvalCount * 4 + verificationCommandCount * 6 + parameterCount * 1.5 - toolCount;
  return Math.round(clamp(raw, 15, 99));
}

function stripLeadingLabel(template: string): string {
  return template.replace(/^Run command:\s*/, "");
}
