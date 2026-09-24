// Usage: bun scripts/promote.ts <id>
// Turns a passed .quarantine/<id>/ into approved/<id>/<version>/.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { approvedDir, ROOT } from "../src/lib/catalog";
import { pluginManifests } from "../src/lib/emitters";
import { Provenance, ScanSummary } from "../src/lib/schema";
import { contentHash, parseSkillMd } from "../src/lib/skill";

const id = process.argv[2];
if (!id) throw new Error("usage: promote.ts <id>");

const stage = join(ROOT, ".quarantine", id);
const summary = ScanSummary.parse(JSON.parse(await readFile(join(stage, "scan/summary.json"), "utf8")));
if (!summary.passed) throw new Error(`${id} did not pass the scan`);

const provenance = Provenance.parse({
  ...JSON.parse(await readFile(join(stage, "provenance.json"), "utf8")),
  promotedAt: new Date().toISOString(),
});
if ((await contentHash(join(stage, "skill"))) !== provenance.contentHash) throw new Error("staged content changed");

const dest = approvedDir(id, provenance.version);
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
await cp(join(stage, "skill"), join(dest, "skills", id), { recursive: true });
await cp(join(stage, "LICENSE"), join(dest, "LICENSE"));
await mkdir(join(dest, "scan"));
await cp(join(stage, "scan/summary.json"), join(dest, "scan/summary.json"));
await writeFile(join(dest, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);

const { frontmatter } = parseSkillMd(await readFile(join(dest, "skills", id, "SKILL.md"), "utf8"));
for (const [file, content] of Object.entries(pluginManifests({ ...provenance, description: frontmatter.description }))) {
  await mkdir(dirname(join(dest, file)), { recursive: true });
  await writeFile(join(dest, file), `${JSON.stringify(content, null, 2)}\n`);
}
console.log(`approved ${id}@${provenance.version} → ${dest}`);
