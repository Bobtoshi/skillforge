import { z } from "zod";

export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

export const traceMetadataSchema = z.object({
  source: z.string().default("unknown"),
  title: z.string().optional(),
  createdAt: z.string().optional(),
  tags: z.array(z.string()).default([]),
}).default({ source: "unknown", tags: [] });

export const messageStepSchema = z.object({
  kind: z.literal("message"),
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

export const toolStepSchema = z.object({
  kind: z.literal("tool"),
  tool: z.string(),
  input: jsonValueSchema.optional(),
  output: jsonValueSchema.optional(),
  summary: z.string().optional(),
});

export const approvalStepSchema = z.object({
  kind: z.literal("approval"),
  reason: z.string(),
});

export const artifactStepSchema = z.object({
  kind: z.literal("artifact"),
  path: z.string(),
  summary: z.string().optional(),
});

export const normalizedTraceStepSchema = z.discriminatedUnion("kind", [
  messageStepSchema,
  toolStepSchema,
  approvalStepSchema,
  artifactStepSchema,
]);

export const normalizedTraceSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  metadata: traceMetadataSchema,
  objective: z.string(),
  steps: z.array(normalizedTraceStepSchema).min(1),
});

export const skillParameterSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "path", "url", "email", "repo", "branch", "date"]),
  required: z.boolean().default(true),
  description: z.string(),
  example: z.string().optional(),
  sourceValues: z.array(z.string()).default([]),
  detectionConfidence: z.number().min(0).max(1),
});

export const skillRequirementSchema = z.object({
  name: z.string(),
  operations: z.array(z.string()).default([]),
  risk: z.enum(["low", "medium", "high"]),
  approval: z.enum(["none", "recommended", "required"]),
  rationale: z.string(),
});

export const skillApprovalSchema = z.object({
  stepId: z.string(),
  reason: z.string(),
  risk: z.enum(["low", "medium", "high"]),
});

export const skillStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(["instruction", "tool", "verification"]),
  template: z.string(),
  tool: z.string().optional(),
});

export const verificationSchema = z.object({
  checklist: z.array(z.string()).default([]),
  commands: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  trustScore: z.number().min(0).max(100),
});

export const compiledSkillSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  summary: z.string(),
  objective: z.string(),
  source: z.object({
    sourceType: z.string(),
    title: z.string().optional(),
    generatedAt: z.string(),
  }),
  parameters: z.array(skillParameterSchema),
  requiredTools: z.array(skillRequirementSchema),
  approvals: z.array(skillApprovalSchema),
  steps: z.array(skillStepSchema).min(1),
  verification: verificationSchema,
});

export const verificationIssueSchema = z.object({
  level: z.enum(["error", "warning", "info"]),
  message: z.string(),
});

export const verificationReportSchema = z.object({
  skillId: z.string(),
  ok: z.boolean(),
  renderedSteps: z.array(z.string()),
  missingInputs: z.array(z.string()),
  unresolvedTemplates: z.array(z.string()),
  issues: z.array(verificationIssueSchema),
  trustScore: z.number().min(0).max(100),
});

export type NormalizedTrace = z.infer<typeof normalizedTraceSchema>;
export type NormalizedTraceStep = z.infer<typeof normalizedTraceStepSchema>;
export type CompiledSkill = z.infer<typeof compiledSkillSchema>;
export type SkillParameter = z.infer<typeof skillParameterSchema>;
export type SkillRequirement = z.infer<typeof skillRequirementSchema>;
export type SkillApproval = z.infer<typeof skillApprovalSchema>;
export type SkillStep = z.infer<typeof skillStepSchema>;
export type VerificationReport = z.infer<typeof verificationReportSchema>;
