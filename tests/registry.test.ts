import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";

import { describe, expect, test } from "vitest";

import { compileTrace } from "../src/compiler/compile.js";
import { normalizeTrace } from "../src/compiler/normalize.js";
import { buildRegistryIndex, writeSkillBundle } from "../src/registry/index.js";
import { verifySkill } from "../src/verifier/verify.js";

describe("registry helpers", () => {
  test("writes and indexes skill bundles", async () => {
    const skill = compileTrace(
      normalizeTrace({
        objective: "Fetch https://status.example.com and write reports/status.md",
        steps: [
          {
            kind: "tool",
            tool: "web_fetch",
            input: {
              url: "https://status.example.com",
            },
          },
          {
            kind: "tool",
            tool: "write_file",
            input: {
              path: "reports/status.md",
            },
          },
        ],
      }),
      { name: "Status Report" },
    );
    const report = verifySkill(skill);
    const root = await mkdtemp(path.join(os.tmpdir(), "skillforge-"));
    await writeSkillBundle(skill, report, path.join(root, skill.slug));

    const registry = await buildRegistryIndex(root);
    expect(registry).toHaveLength(1);
    expect(registry[0]?.slug).toBe(skill.slug);
  });
});
