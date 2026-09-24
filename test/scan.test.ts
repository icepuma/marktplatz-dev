import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanSkill } from "../src/lib/scan";

// Runs the real scanners (needs uv and network to install them): RUN_SCANNERS=1 bun test
test.skipIf(!process.env.RUN_SCANNERS)(
  "every scanner blocks the malicious fixture",
  async () => {
    const out = await mkdtemp(join(tmpdir(), "scan-"));
    const summary = await scanSkill(join(import.meta.dir, "fixtures/malicious/evil-helper"), out);
    expect(summary.passed).toBe(false);
    expect(summary.scanners.map((s) => [s.id, s.blocked])).toEqual([
      ["skillspector", true],
      ["cisco-skill-scanner", true],
      ["atr", true],
    ]);
  },
  300_000,
);
