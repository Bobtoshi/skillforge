import { describe, expect, test } from "vitest";

import { compileTrace } from "../src/compiler/compile.js";
import { normalizeTrace } from "../src/compiler/normalize.js";
import { verifySkill } from "../src/verifier/verify.js";

describe("verifySkill", () => {
  test("renders placeholders from supplied inputs", () => {
    const skill = compileTrace(
      normalizeTrace({
        objective: "Review docs/guide.md and then run npm test -- guide.",
        steps: [
          {
            kind: "tool",
            tool: "read_file",
            input: {
              path: "docs/guide.md",
            },
          },
          {
            kind: "tool",
            tool: "bash",
            input: {
              command: "npm test -- guide",
            },
          },
        ],
      }),
    );

    const report = verifySkill(skill, {
      guidePath: "docs/guide.md",
    });

    expect(report.ok).toBe(true);
    expect(report.renderedSteps.some((step) => step.includes("docs/guide.md"))).toBe(true);
  });

  test("flags missing required inputs when no example exists", () => {
    const skill = compileTrace(
      normalizeTrace({
        objective: "Send a note to ops@example.com",
        steps: [
          {
            kind: "tool",
            tool: "send_email",
            input: {
              to: "ops@example.com",
            },
          },
        ],
      }),
    );

    const strippedSkill = {
      ...skill,
      parameters: skill.parameters.map((parameter) => ({
        ...parameter,
        example: undefined,
      })),
    };

    const report = verifySkill(strippedSkill);
    expect(report.ok).toBe(false);
    expect(report.missingInputs).toContain("recipientEmail");
  });
});
