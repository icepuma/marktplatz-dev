import { expect, test } from "bun:test";
import { appendFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { loadCatalog } from "../src/lib/catalog";
import { emitters, type Harness, pick } from "../src/lib/emitters";

// Installs a guild with the real CLIs, from a clone of this repo, by running exactly the commands the site shows,
// then changes one of its skills in a new commit and runs them again (needs claude and codex on PATH; everything
// happens in a throwaway home): RUN_HARNESSES=1 bun test
const installed: Record<Harness, (env: Record<string, string>) => Promise<string>> = {
  "claude-code": (env) => $`claude plugin list`.env(env).text(),
  codex: (env) => $`codex plugin list -m marktplatz`.env(env).text(),
};

for (const harness of Object.keys(emitters) as Harness[]) {
  test.skipIf(!process.env.RUN_HARNESSES)(
    `${harness} installs a guild from its own marketplace file, and running the commands again updates it`,
    async () => {
      const dir = await mkdtemp(join(tmpdir(), `harness-${harness}-`));
      const catalog = await loadCatalog();
      const guild = catalog.roles[0]!;
      const skill = catalog.skills.find((s) => s.id === guild.skills[0])!;

      // Two commits of the approved folder as it is now: one as is, one that changes a skill of the guild.
      const commit = (message: string) => $`git -C ${dir}/work -c user.name=test -c user.email=test@example.com commit -qm ${message}`;
      await mkdir(`${dir}/work`);
      await $`cp -R ${join(import.meta.dir, "../approved")} ${dir}/work/`;
      await $`git -C ${dir}/work init -q && git -C ${dir}/work add -A`;
      await commit("as is");
      await appendFile(`${dir}/work/approved/${skill.id}/${skill.version}/skills/${skill.id}/SKILL.md`, "\nmarktplatz-update-check\n");
      await $`git -C ${dir}/work add -A`;
      await commit("update");
      await $`git clone -q --bare ${dir}/work ${dir}/repo.git`;
      const shas = (await $`git -C ${dir}/repo.git rev-list -n 2 HEAD`.text()).trim().split("\n").reverse();

      for (const d of ["downloads", "home", "claude", "codex"]) await mkdir(join(dir, d));
      const env = { ...process.env, HOME: `${dir}/home`, CLAUDE_CONFIG_DIR: `${dir}/claude`, CODEX_HOME: `${dir}/codex` } as Record<string, string>;
      for (const sha of shas) {
        const out = emitters[harness].emit(catalog, pick(catalog, [guild.id], [], false), { repoUrl: `file://${dir}/repo.git`, sha });
        await writeFile(join(dir, "downloads/marketplace.json"), out.content);
        await $`bash -euc ${out.install.join("\n")}`.cwd(`${dir}/downloads`).env(env).quiet();
      }

      const seen = await installed[harness](env);
      if (harness === "claude-code") {
        expect(seen).toContain(`${guild.id}-guild@marktplatz`);
        expect(seen).toContain("enabled");
        expect(seen).not.toContain("failed to load");
      }
      else for (const id of guild.skills) expect(seen).toMatch(new RegExp(`${id}@marktplatz\\s+installed, enabled`));
      expect(await $`grep -rl marktplatz-update-check ${dir}/claude ${dir}/codex`.nothrow().text()).toContain(`skills/${skill.id}/SKILL.md`);
    },
    300_000,
  );
}
