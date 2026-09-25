import { stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { approvedDir } from "./catalog";
import { renderMarkdown } from "./markdown";
import { REPO } from "./site";
import { listFiles, parseSkillMd } from "./skill";
import type { CatalogSkill } from "./types";

// Everything a skill's page shows about what you'd install, read from its approved folder at build time.

export type SkillFile = { path: string; bytes: number; script: boolean };

export type SkillDetails = {
  /** The rendered SKILL.md body (untrusted Markdown, made safe). */
  html: string;
  files: SkillFile[];
  /** Rough context cost, as Claude Code estimates it: the frontmatter every turn, the body when the skill fires. */
  tokens: { always: number; invoked: number };
  /** The skill folder as installed, in this repo at the build commit. */
  copy: string;
  /** The same files where they came from, at the pinned upstream commit. */
  upstream: string;
  /** The scan folder in this repo: summary.json plus each scanner's raw report, <scanner id>.json. */
  scan: string;
};

// Files an agent could run: interpreters and shells by extension.
const SCRIPT = /\.(sh|bash|zsh|fish|ps1|bat|cmd|py|rb|pl|php|js|mjs|cjs|ts|lua|go|rs|swift|kt|java|exe|bin)$/i;

const tokens = (text: string) => Math.ceil(text.length / 4);

export async function skillDetails(skill: CatalogSkill, sha: string): Promise<SkillDetails> {
  const dir = join(approvedDir(skill.id, skill.version), "skills", skill.id);
  const copy = `https://github.com/${REPO}/tree/${sha}/approved/${skill.id}/${skill.version}/skills/${skill.id}`;
  const text = await readFile(join(dir, "SKILL.md"), "utf8");
  const { frontmatter, body } = parseSkillMd(text);
  const files = await Promise.all(
    (await listFiles(dir)).map(async (path) => ({ path, bytes: (await stat(join(dir, path))).size, script: SCRIPT.test(path) })),
  );
  return {
    html: renderMarkdown(body, copy.replace("/tree/", "/blob/")),
    files,
    tokens: { always: tokens(`${frontmatter.name} ${frontmatter.description}`), invoked: tokens(body) },
    copy,
    upstream: `https://github.com/${skill.repo}/tree/${skill.sha}/${skill.path}`,
    scan: `https://github.com/${REPO}/blob/${sha}/approved/${skill.id}/${skill.version}/scan`,
  };
}

export const kb = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);
export const approx = (n: number) => (n < 1000 ? `~${n}` : `~${(n / 1000).toFixed(1)}k`);

/** Where a license's section starts on /licenses. */
export const charterAnchor = (spdx: string) => `license-${spdx.replace(/[^A-Za-z0-9.-]/g, "-")}`;
