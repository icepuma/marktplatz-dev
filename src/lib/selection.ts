import type { Harness } from "./emitters";

// Browser-safe: the builder's selection lives in the URL path, e.g.
//   /market/codex/roles/platform-engineer,sre/skills/ponytail
// Every /market/* path is served by the builder page (see public/_redirects).

export type Selection = { roles: string[]; skills: string[]; harness: Harness };

const HARNESSES: Harness[] = ["claude-code", "codex"];

export function selectionPath({ roles, skills, harness }: Selection): string {
  if (!roles.length && !skills.length && harness === "claude-code") return "/";
  const parts = ["market", harness];
  if (roles.length) parts.push("roles", roles.join(","));
  if (skills.length) parts.push("skills", skills.join(","));
  return `/${parts.join("/")}`;
}

export function parseSelectionPath(pathname: string): Selection {
  const [market, harness, ...rest] = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const selection: Selection = { roles: [], skills: [], harness: "claude-code" };
  if (market !== "market") return selection;
  if (HARNESSES.includes(harness as Harness)) selection.harness = harness as Harness;
  for (let i = 0; i + 1 < rest.length; i += 2) {
    const key = rest[i];
    if (key === "roles" || key === "skills") selection[key] = rest[i + 1]!.split(",").filter(Boolean);
  }
  return selection;
}
