import path from "node:path";

import type { NormalizedTrace, SkillParameter } from "../contracts.js";
import { walkJsonStrings } from "../utils/json.js";
import { dedupe, toCamelCase, truncate } from "../utils/text.js";

type CandidateType = SkillParameter["type"];

type Candidate = {
  value: string;
  type: CandidateType;
  pathHint: string | undefined;
  count: number;
  fromObjective: boolean;
};

const URL_RE = /https?:\/\/[^\s"'`)]+/g;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const REPO_RE = /\b[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\b/g;
const PATH_RE =
  /(?:\/[\w./-]+|(?:\.{1,2}\/)?(?:[\w-]+\/)+[\w.-]+|\b[\w.-]+\.(?:ts|tsx|js|jsx|json|md|yaml|yml|txt|csv|py|go|rs|java|kt|swift|sql)\b)/g;
const DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/g;
const BRANCH_RE = /\b(?:main|master|develop|dev|release\/[\w.-]+|feature\/[\w.-]+|bugfix\/[\w.-]+|hotfix\/[\w.-]+)\b/g;

const RESERVED_PARAMETER_NAMES = new Set([
  "input",
  "value",
  "string",
  "path",
  "url",
  "repository",
]);

const IGNORED_VALUES = new Set([
  "main",
  "master",
  "README.md",
  "package.json",
]);

export function extractParameters(trace: NormalizedTrace): SkillParameter[] {
  const candidates = new Map<string, Candidate>();

  collectMatches(trace.objective, true).forEach((match) => {
    upsertCandidate(candidates, match.value, match.type, undefined, true);
  });

  trace.steps.forEach((step) => {
    if (step.kind === "artifact") {
      upsertCandidate(candidates, step.path, "path", "artifact.path", false);
    }

    if (step.kind === "tool") {
      walkJsonStrings(step.input, (text, jsonPath) => {
        collectMatches(text, false).forEach((match) => {
          upsertCandidate(candidates, match.value, match.type, jsonPath.join("."), false);
        });
      });
    }
  });

  const parameters = Array.from(candidates.values())
    .filter((candidate) => shouldKeepCandidate(candidate))
    .sort((left, right) => right.value.length - left.value.length)
    .map((candidate, index) => createParameter(candidate, index));

  return ensureUniqueNames(parameters);
}

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: string) => values[name] ?? `{{${name}}}`);
}

export function applyParameters(template: string, parameters: SkillParameter[]): string {
  return parameters
    .sort((left, right) => right.sourceValues[0]!.length - left.sourceValues[0]!.length)
    .reduce((result, parameter) => {
      let next = result;
      parameter.sourceValues.forEach((sourceValue) => {
        next = next.split(sourceValue).join(`{{${parameter.name}}}`);
      });
      return next;
    }, template);
}

function collectMatches(text: string, fromObjective: boolean): Array<{ value: string; type: CandidateType }> {
  const matches: Array<{ value: string; type: CandidateType }> = [];

  for (const [regex, type] of [
    [URL_RE, "url"],
    [EMAIL_RE, "email"],
    [DATE_RE, "date"],
    [BRANCH_RE, "branch"],
    [PATH_RE, "path"],
    [REPO_RE, "repo"],
  ] satisfies Array<[RegExp, CandidateType]>) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      const value = match[0].trim();
      if (!value) {
        continue;
      }
      matches.push({ value, type });
    }
  }

  if (fromObjective) {
    const quoted = Array.from(text.matchAll(/["'`](.+?)["'`]/g)).map((match) => match[1]?.trim()).filter(Boolean) as string[];
    quoted
      .filter((value) => value.length > 4 && value.length < 80)
      .forEach((value) => matches.push({ value, type: "string" }));
  }

  return matches;
}

function upsertCandidate(
  store: Map<string, Candidate>,
  value: string,
  type: CandidateType,
  pathHint: string | undefined,
  fromObjective: boolean,
): void {
  const trimmed = value.trim();
  if (!trimmed || IGNORED_VALUES.has(trimmed)) {
    return;
  }

  const key = `${type}:${trimmed}`;
  const existing = store.get(key);

  if (existing) {
    existing.count += 1;
    existing.fromObjective ||= fromObjective;
    existing.pathHint ??= pathHint;
    return;
  }

  store.set(key, {
    value: trimmed,
    type,
    pathHint,
    count: 1,
    fromObjective,
  });
}

function shouldKeepCandidate(candidate: Candidate): boolean {
  if (candidate.value.length < 4) {
    return false;
  }

  if (candidate.type === "string") {
    return candidate.fromObjective;
  }

  if (candidate.type === "repo") {
    return candidate.fromObjective || candidate.count > 1;
  }

  return candidate.fromObjective || candidate.count > 0;
}

function createParameter(candidate: Candidate, index: number): SkillParameter {
  const name = createParameterName(candidate, index);
  const description = describeCandidate(candidate);
  const example = candidate.value;
  const confidence = Math.min(0.99, 0.45 + candidate.count * 0.15 + (candidate.fromObjective ? 0.15 : 0));

  return {
    name,
    type: candidate.type,
    required: true,
    description,
    example,
    sourceValues: dedupe([candidate.value]),
    detectionConfidence: Number(confidence.toFixed(2)),
  };
}

function createParameterName(candidate: Candidate, index: number): string {
  const basename = candidate.type === "path" ? path.basename(candidate.value, path.extname(candidate.value)) : "";
  const lastSegment = candidate.type === "repo" ? candidate.value.split("/").at(-1) ?? candidate.value : "";

  let rawName = (() => {
    switch (candidate.type) {
      case "path":
        return basename ? `${basename}Path` : "targetPath";
      case "url":
        return "targetUrl";
      case "email":
        return "recipientEmail";
      case "repo":
        return lastSegment ? `${lastSegment}Repository` : "repository";
      case "branch":
        return "branchName";
      case "date":
        return "targetDate";
      case "string":
      default:
        return truncate(candidate.value, 24);
    }
  })();

  rawName = toCamelCase(rawName);
  if (RESERVED_PARAMETER_NAMES.has(rawName)) {
    rawName = `${rawName}${index + 1}`;
  }

  return rawName;
}

function ensureUniqueNames(parameters: SkillParameter[]): SkillParameter[] {
  const seen = new Map<string, number>();

  return parameters.map((parameter) => {
    const current = seen.get(parameter.name) ?? 0;
    seen.set(parameter.name, current + 1);

    if (current === 0) {
      return parameter;
    }

    return {
      ...parameter,
      name: `${parameter.name}${current + 1}`,
    };
  });
}

function describeCandidate(candidate: Candidate): string {
  switch (candidate.type) {
    case "path":
      return "File or directory path detected in the source run.";
    case "url":
      return "Target URL detected in the source run.";
    case "email":
      return "Email address detected in the source run.";
    case "repo":
      return "Repository reference detected in the source run.";
    case "branch":
      return "Branch name detected in the source run.";
    case "date":
      return "Date value detected in the source run.";
    case "string":
    default:
      return "Quoted string extracted from the original objective.";
  }
}
