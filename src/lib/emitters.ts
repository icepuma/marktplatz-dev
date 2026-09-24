import type { Provenance } from "./schema";
import type { Catalog, CatalogSkill } from "./types";

// Browser-safe: used by the builder island and by scripts/promote.ts.

export const MARKETPLACE_NAME = "marktplatz";

export type Harness = "claude-code" | "codex";

export type EmitContext = {
  /** Git URL of this repo, e.g. https://github.com/icepuma/marktplatz-dev.git */
  repoUrl: string;
  /** The commit the site was built from; every skill is pinned to it. */
  sha: string;
};

/** The downloaded file is always `marketplace.json`; `install` says what to do with it. */
export type Emitted = { content: string; install: string[] };

type SkillRef = Pick<Provenance, "id" | "version" | "repo" | "license"> & { description: string };

/** The plugin manifest written next to each approved skill. Claude Code and Codex both read it. */
export function pluginManifests(skill: SkillRef): Record<string, object> {
  return {
    ".claude-plugin/plugin.json": {
      name: skill.id,
      description: skill.description,
      license: skill.license,
      repository: `https://github.com/${skill.repo}`,
    },
  };
}

/** Selected roles expand to their skills, merged with the selected skills, without duplicates. */
export function resolveSelection(catalog: Catalog, roleIds: string[], skillIds: string[]): CatalogSkill[] {
  const wanted = new Set([...catalog.roles.filter((r) => roleIds.includes(r.id)).flatMap((r) => r.skills), ...skillIds]);
  return catalog.skills.filter((s) => wanted.has(s.id));
}

function source(skill: SkillRef, ctx: EmitContext) {
  return { source: "git-subdir", url: ctx.repoUrl, path: `approved/${skill.id}/${skill.version}`, sha: ctx.sha };
}

const json = (value: object) => `${JSON.stringify(value, null, 2)}\n`;

export const emitters: Record<Harness, { label: string; emit(skills: SkillRef[], ctx: EmitContext): Emitted }> = {
  "claude-code": {
    label: "Claude Code",
    emit(skills, ctx) {
      return {
        content: json({
          name: MARKETPLACE_NAME,
          owner: { name: "marktplatz.dev" },
          plugins: skills.map((s) => ({
            name: s.id,
            description: s.description,
            license: s.license,
            repository: `https://github.com/${s.repo}`,
            source: source(s, ctx),
          })),
        }),
        install: ["/plugin marketplace add ./marketplace.json", ...skills.map((s) => `/plugin install ${s.id}@${MARKETPLACE_NAME}`)],
      };
    },
  },
  codex: {
    label: "OpenAI Codex",
    emit(skills, ctx) {
      return {
        content: json({
          name: MARKETPLACE_NAME,
          plugins: skills.map((s) => ({
            name: s.id,
            source: source(s, ctx),
            policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
            category: "Productivity",
          })),
        }),
        // Codex only adds marketplaces from a directory, so the file moves into one.
        install: [
          `mkdir -p ${MARKETPLACE_NAME}/.agents/plugins`,
          `mv marketplace.json ${MARKETPLACE_NAME}/.agents/plugins/`,
          `codex plugin marketplace add ./${MARKETPLACE_NAME}`,
        ],
      };
    },
  },
};
