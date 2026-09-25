import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { Held, Provenance, QuarantineManifest, Role, ScanSummary } from "./schema";
import { parseSkillMd } from "./skill";
import type { Catalog, CatalogSkill } from "./types";

export const ROOT = process.cwd();
export const QUARANTINE_DIR = join(ROOT, "quarantine");
export const ROLES_DIR = join(ROOT, "roles");
export const APPROVED_DIR = join(ROOT, "approved");
export const GATE_DIR = join(ROOT, "gate");

async function dirs(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

async function yamlFiles<T>(dir: string, parse: (data: unknown) => T): Promise<Map<string, T>> {
  const entries = await readdir(dir).catch(() => [] as string[]);
  const result = new Map<string, T>();
  for (const file of entries.filter((f) => f.endsWith(".yaml")).sort()) {
    try {
      result.set(basename(file, ".yaml"), parse(parseYaml(await readFile(join(dir, file), "utf8"))));
    } catch (error) {
      throw new Error(`${join(dir, file)}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return result;
}

export const loadQuarantine = () => yamlFiles(QUARANTINE_DIR, (d) => QuarantineManifest.parse(d));
export const loadRoles = () => yamlFiles(ROLES_DIR, (d) => Role.parse(d));

export function approvedDir(id: string, version: string): string {
  return join(APPROVED_DIR, id, version);
}

export function gateDir(id: string, version: string): string {
  return join(GATE_DIR, id, version);
}

/** Every skill held at the gate (checked, not cleared), newest check first per id. */
export async function loadHeldVersions(): Promise<Map<string, CatalogSkill[]>> {
  const result = new Map<string, CatalogSkill[]>();
  for (const id of await dirs(GATE_DIR)) {
    const versions = await Promise.all(
      (await dirs(join(GATE_DIR, id))).map(async (v) => {
        const read = (file: string) => readFile(join(gateDir(id, v), file), "utf8");
        const held = Held.parse(JSON.parse(await read("provenance.json")));
        return { ...held, scan: ScanSummary.parse(JSON.parse(await read("scan/summary.json"))) };
      }),
    );
    versions.sort((a, b) => b.promotedAt.localeCompare(a.promotedAt));
    result.set(id, versions);
  }
  return result;
}

export async function loadApprovedSkill(id: string, version: string): Promise<CatalogSkill> {
  const dir = approvedDir(id, version);
  const read = (file: string) => readFile(join(dir, file), "utf8");
  const provenance = Provenance.parse(JSON.parse(await read("provenance.json")));
  const scan = ScanSummary.parse(JSON.parse(await read("scan/summary.json")));
  const { frontmatter } = parseSkillMd(await read(`skills/${id}/SKILL.md`));
  return { ...provenance, description: frontmatter.description, scan };
}

/** Every approved skill version, newest promotion first per id. */
export async function loadApprovedVersions(): Promise<Map<string, CatalogSkill[]>> {
  const result = new Map<string, CatalogSkill[]>();
  for (const id of await dirs(APPROVED_DIR)) {
    const versions = await Promise.all((await dirs(join(APPROVED_DIR, id))).map((v) => loadApprovedSkill(id, v)));
    versions.sort((a, b) => b.promotedAt.localeCompare(a.promotedAt));
    result.set(id, versions);
  }
  return result;
}

/** The catalog the site and builder use: the latest approved version of each skill, plus roles. */
export async function loadCatalog(): Promise<Catalog> {
  const versions = await loadApprovedVersions();
  const skills = [...versions.values()].map((v) => v[0]!).sort((a, b) => a.id.localeCompare(b.id));
  // A skill with an approved version is never shown as held, even if a newer version did not clear.
  const held = [...(await loadHeldVersions()).values()]
    .map((v) => v[0]!)
    .filter((h) => !versions.has(h.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const roles = [...(await loadRoles())].map(([id, role]) => ({
    id,
    ...role,
    skills: role.skills.filter((s) => versions.has(s)),
    held: role.skills.filter((s) => held.some((h) => h.id === s)),
  }));
  return { skills, roles, held };
}
