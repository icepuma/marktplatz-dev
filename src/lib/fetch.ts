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
