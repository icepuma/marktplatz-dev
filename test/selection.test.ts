import { describe, expect, test } from "bun:test";
import { parseSelectionPath, selectionPath } from "../src/lib/selection";

describe("selection path", () => {
  test("empty default selection is the home page", () => {
    expect(selectionPath({ roles: [], skills: [], harness: "claude-code" })).toBe("/");
    expect(parseSelectionPath("/")).toEqual({ roles: [], skills: [], harness: "claude-code" });
  });

  test("round-trips roles, skills and harness", () => {
    const selection = { roles: ["platform-engineer", "sre"], skills: ["ponytail"], harness: "codex" as const };
    const path = selectionPath(selection);
    expect(path).toBe("/market/codex/roles/platform-engineer,sre/skills/ponytail");
    expect(parseSelectionPath(path)).toEqual(selection);
  });

  test("roles or skills alone", () => {
    expect(selectionPath({ roles: [], skills: ["ponytail"], harness: "claude-code" })).toBe("/market/claude-code/skills/ponytail");
    expect(parseSelectionPath("/market/claude-code/roles/sre")).toEqual({ roles: ["sre"], skills: [], harness: "claude-code" });
  });

  test("ignores unknown harnesses and segments", () => {
    expect(parseSelectionPath("/market/vim/colors/red/skills/a")).toEqual({ roles: [], skills: ["a"], harness: "claude-code" });
    expect(parseSelectionPath("/licenses")).toEqual({ roles: [], skills: [], harness: "claude-code" });
  });
});
