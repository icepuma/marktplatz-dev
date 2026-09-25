import { $ } from "bun";
import { cp, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { QuarantineManifest } from "./schema";

/** Resolves the exact tag `version` to its commit SHA. Fails if the tag doesn't exist. */
export async function resolveTag(repo: string, version: string): Promise<string> {
  const url = `https://github.com/${repo}.git`;
  const out = await $`git ls-remote --tags ${url} ${`refs/tags/${version}`} ${`refs/tags/${version}^{}`}`.text();
  const refs = new Map(
    out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, ref] = line.split("\t");
        return [ref!, sha!] as const;
      }),
  );
  // Annotated tags list the peeled commit under `^{}`.
  const sha = refs.get(`refs/tags/${version}^{}`) ?? refs.get(`refs/tags/${version}`);
  if (!sha) throw new Error(`tag ${version} not found in ${repo}`);
  return sha;
}

/** Copies `manifest.path` at the tag's commit into `dest` and returns the commit SHA. */
export async function stageSkill(manifest: QuarantineManifest, dest: string): Promise<string> {
  const sha = await resolveTag(manifest.repo, manifest.version);
  const work = await mkdtemp(join(tmpdir(), "marktplatz-"));
  try {
    const url = `https://github.com/${manifest.repo}.git`;
    await $`git -c advice.detachedHead=false clone --quiet --depth 1 --no-tags --filter=blob:none --branch ${manifest.version} ${url} ${work}`;
    const head = (await $`git -C ${work} rev-parse HEAD`.text()).trim();
    if (head !== sha) throw new Error(`clone is at ${head}, expected ${sha}`);

    const source = join(work, manifest.path);
    if (!(await stat(source).catch(() => null))?.isDirectory()) {
      throw new Error(`${manifest.path} is not a directory in ${manifest.repo}@${manifest.version}`);
    }
    await rm(dest, { recursive: true, force: true });
    await cp(source, dest, { recursive: true, verbatimSymlinks: true });
    return sha;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** Every tag name in `repo`. */
export async function listTags(repo: string): Promise<string[]> {
  const out = await $`git ls-remote --tags ${`https://github.com/${repo}.git`}`.text();
  return out
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t")[1]!.replace(/^refs\/tags\//, ""))
    .filter((tag) => !tag.endsWith("^{}"));
}

/**
 * The newest release after `current` among `tags`, or null. Only tags shaped like `current` count: the same prefix
 * followed by dot-separated numbers alone, so `v1.10.0` follows `v1.9.2`, and pre-releases (`v2.0.0-rc.1`) and
 * other tag families (`mattpocock-skills@1.0.0` next to `v1.2.3`) are never picked.
 */
export function newerTag(current: string, tags: string[]): string | null {
  const shape = (tag: string) => {
    const m = /^(\D*)(\d+(?:\.\d+)*)$/.exec(tag);
    return m ? { prefix: m[1]!, parts: m[2]!.split(".").map(Number) } : null;
  };
  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
    return 0;
  };
  const base = shape(current);
  if (!base) return null;
  let best: { tag: string; parts: number[] } | null = null;
  for (const tag of tags) {
    const s = shape(tag);
    if (!s || s.prefix !== base.prefix || compare(s.parts, base.parts) <= 0) continue;
    if (!best || compare(s.parts, best.parts) > 0) best = { tag, parts: s.parts };
  }
  return best?.tag ?? null;
}
