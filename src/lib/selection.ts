import type { Harness } from "./emitters";

// Browser-safe: the builder's selection lives in the URL path, e.g.
//   /market/codex/roles/platform-engineer,sre/skills/ponytail/with-held
// `with-held` means skills held at the gate were asked for too.
// Every /market/* path is served by the builder page (see public/_redirects).

export type Selection = { roles: string[]; skills: string[]; harness: Harness; held: boolean };

const HARNESSES: Harness[] = ["claude-code", "codex"];

export function selectionPath({ roles, skills, harness, held }: Selection): string {
  if (!roles.length && !skills.length && harness === "claude-code" && !held) return "/";
  const parts = ["market", harness];
  if (roles.length) parts.push("roles", roles.join(","));
  if (skills.length) parts.push("skills", skills.join(","));
  if (held) parts.push("with-held");
  return `/${parts.join("/")}`;
}

export function parseSelectionPath(pathname: string): Selection {
  const [market, harness, ...rest] = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const selection: Selection = { roles: [], skills: [], harness: "claude-code", held: false };
  if (market !== "market") return selection;
  if (HARNESSES.includes(harness as Harness)) selection.harness = harness as Harness;
  selection.held = rest.at(-1) === "with-held";
  const pairs = selection.held ? rest.slice(0, -1) : rest;
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    const key = pairs[i];
    if (key === "roles" || key === "skills") selection[key] = pairs[i + 1]!.split(",").filter(Boolean);
  }
  return selection;
}
