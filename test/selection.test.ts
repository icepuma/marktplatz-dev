import { describe, expect, test } from "bun:test";
import { parseSelectionPath, selectionPath } from "../src/lib/selection";

describe("selection path", () => {
  test("empty default selection is the home page", () => {
    expect(selectionPath({ roles: [], skills: [], harness: "claude-code", held: false })).toBe("/");
    expect(parseSelectionPath("/")).toEqual({ roles: [], skills: [], harness: "claude-code", held: false });
  });

  test("round-trips roles, skills and harness", () => {
    const selection = { roles: ["platform-engineer", "sre"], skills: ["ponytail"], harness: "codex" as const, held: false };
    const path = selectionPath(selection);
    expect(path).toBe("/market/codex/roles/platform-engineer,sre/skills/ponytail");
    expect(parseSelectionPath(path)).toEqual(selection);
  });

  test("asking for skills held at the gate", () => {
    const selection = { roles: ["sre"], skills: [], harness: "codex" as const, held: true };
    expect(selectionPath(selection)).toBe("/market/codex/roles/sre/with-held");
    expect(parseSelectionPath("/market/codex/roles/sre/with-held")).toEqual(selection);
  });

  test("roles or skills alone", () => {
    expect(selectionPath({ roles: [], skills: ["ponytail"], harness: "claude-code", held: false })).toBe("/market/claude-code/skills/ponytail");
    expect(parseSelectionPath("/market/claude-code/roles/sre")).toEqual({ roles: ["sre"], skills: [], harness: "claude-code", held: false });
  });

  test("ignores unknown harnesses and segments", () => {
    expect(parseSelectionPath("/market/vim/colors/red/skills/a")).toEqual({ roles: [], skills: ["a"], harness: "claude-code", held: false });
    expect(parseSelectionPath("/licenses")).toEqual({ roles: [], skills: [], harness: "claude-code", held: false });
  });
});
