import { describe, expect, test } from "vitest";

import { compileTrace } from "../src/compiler/compile.js";
import { normalizeTrace } from "../src/compiler/normalize.js";

const sampleTrace = {
  schemaVersion: "1.0",
  metadata: {
    source: "demo",
    title: "Fix flaky auth test",
  },
  objective: "Fix the flaky test in tests/auth.spec.ts and verify it with npm test -- auth.",
  steps: [
    {
      kind: "message",
      role: "user",
      content: "Fix the flaky test in tests/auth.spec.ts and make sure npm test -- auth passes.",
    },
    {
      kind: "tool",
      tool: "read_file",
      input: {
        path: "tests/auth.spec.ts",
      },
    },
    {
      kind: "tool",
      tool: "edit_file",
      input: {
        path: "tests/auth.spec.ts",
        instruction: "Replace the fixed sleep with a waitFor assertion.",
      },
    },
    {
      kind: "tool",
      tool: "bash",
      input: {
        command: "npm test -- auth",
      },
    },
    {
      kind: "artifact",
      path: "tests/auth.spec.ts",
      summary: "Updated flaky test with deterministic waiting.",
    },
  ],
} as const;

describe("compileTrace", () => {
  test("extracts parameters and verification commands from a normalized trace", () => {
    const trace = normalizeTrace(sampleTrace);
    const skill = compileTrace(trace);

    expect(skill.name).toBe("Fix Flaky Auth Test");
    expect(skill.parameters.some((parameter) => parameter.name === "authSpecPath")).toBe(true);
    expect(skill.requiredTools.some((requirement) => requirement.name === "bash")).toBe(true);
    expect(skill.verification.commands).toContain("npm test -- auth");
    expect(skill.verification.trustScore).toBeGreaterThan(50);
  });

  test("marks commit commands as approval-gated", () => {
    const trace = normalizeTrace({
      objective: "Commit the release notes",
      steps: [
        {
          kind: "tool",
          tool: "bash",
          input: {
            command: "git commit -am \"release notes\"",
          },
        },
      ],
    });
    const skill = compileTrace(trace);

    expect(skill.approvals.length).toBe(1);
    expect(skill.approvals[0]?.reason.toLowerCase()).toContain("approval recommended");
  });
});
