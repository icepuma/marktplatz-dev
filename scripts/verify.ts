// Usage: bun scripts/verify.ts
// Validates every hand-written file and checks each approved skill against its provenance.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { approvedDir, loadApprovedVersions, loadQuarantine, loadRoles } from "../src/lib/catalog";
import { pluginManifests } from "../src/lib/emitters";
import { contentHash } from "../src/lib/skill";

const errors: string[] = [];

const quarantine = await loadQuarantine();
for (const [id, role] of await loadRoles()) {
  for (const skill of role.skills) {
    if (!quarantine.has(skill)) errors.push(`roles/${id}.yaml: unknown skill "${skill}"`);
  }
}

for (const [id, versions] of await loadApprovedVersions()) {
  for (const skill of versions) {
    const dir = approvedDir(id, skill.version);
    const where = `approved/${id}/${skill.version}`;
    if (skill.id !== id) errors.push(`${where}: provenance id is "${skill.id}"`);
    if ((await contentHash(join(dir, "skills", id))) !== skill.contentHash) errors.push(`${where}: content hash mismatch`);
    if (!existsSync(join(dir, "LICENSE"))) errors.push(`${where}: LICENSE is missing`);
    if (!skill.scan.passed) errors.push(`${where}: scan did not pass`);
    for (const [file, expected] of Object.entries(pluginManifests(skill))) {
      const actual = await readFile(join(dir, file), "utf8").catch(() => "");
      if (actual !== `${JSON.stringify(expected, null, 2)}\n`) errors.push(`${where}: ${file} is missing or outdated`);
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}
console.log(`ok: ${quarantine.size} quarantine manifests, all approved skills match their provenance`);
