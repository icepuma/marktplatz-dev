import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { parse as parseYaml } from "yaml";
import { SkillFrontmatter } from "./schema";

const MAX_TOTAL_BYTES = 5 * 1024 * 1024;

export function parseSkillMd(text: string): { frontmatter: SkillFrontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) throw new Error("SKILL.md must start with a --- frontmatter block");
  const frontmatter = SkillFrontmatter.parse(parseYaml(match[1]!));
  return { frontmatter, body: match[2]! };
}

/** All regular files below `dir`, as sorted POSIX paths relative to `dir`. Fails on symlinks. */
export async function listFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(current: string) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      const rel = relative(dir, full).split(sep).join("/");
      if (entry.isSymbolicLink()) throw new Error(`symlinks are not allowed: ${rel}`);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) files.push(rel);
      else throw new Error(`unsupported file type: ${rel}`);
    }
  }
  await walk(dir);
  return files.sort();
}

/** Deterministic hash over relative paths and file contents. */
export async function contentHash(dir: string): Promise<string> {
  const outer = createHash("sha256");
  for (const file of await listFiles(dir)) {
    const inner = createHash("sha256").update(await readFile(join(dir, file))).digest("hex");
    outer.update(`${file}\0${inner}\n`);
  }
  return `sha256-${outer.digest("hex")}`;
}

/** Checks a staged skill directory and returns its frontmatter. */
export async function validateSkillDir(dir: string, id: string): Promise<SkillFrontmatter> {
  const files = await listFiles(dir);
  if (!files.includes("SKILL.md")) throw new Error("SKILL.md is missing");

  let total = 0;
  for (const file of files) total += (await lstat(join(dir, file))).size;
  if (total > MAX_TOTAL_BYTES) throw new Error(`skill is ${total} bytes, the limit is ${MAX_TOTAL_BYTES}`);

  const { frontmatter } = parseSkillMd(await readFile(join(dir, "SKILL.md"), "utf8"));
  if (frontmatter.name !== id) throw new Error(`SKILL.md name "${frontmatter.name}" must equal "${id}"`);
  return frontmatter;
}
