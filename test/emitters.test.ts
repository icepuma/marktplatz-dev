import { describe, expect, test } from "bun:test";
import { emitters, resolveSelection } from "../src/lib/emitters";
import type { Catalog, CatalogSkill } from "../src/lib/types";

const skill = (id: string): CatalogSkill => ({
  id,
  repo: `acme/${id}`,
  path: `skills/${id}`,
  version: "v1.0.0",
  sha: "a".repeat(40),
  contentHash: `sha256-${"b".repeat(64)}`,
  license: "MIT",
  promotedAt: "2026-09-25T00:00:00.000Z",
  description: `The ${id} skill.`,
  scan: { passed: true, scanners: [], findings: [] },
});

const catalog: Catalog = {
  skills: [skill("alpha"), skill("beta"), skill("gamma")],
  roles: [
    { id: "sre", name: "SRE", description: "d", skills: ["alpha", "beta"] },
    { id: "dev", name: "Dev", description: "d", skills: ["beta"] },
  ],
};

const ctx = { repoUrl: "https://github.com/icepuma/marktplatz-dev.git", sha: "c".repeat(40) };

describe("resolveSelection", () => {
  const ids = (roles: string[], skills: string[]) => resolveSelection(catalog, roles, skills).map((s) => s.id);

  test("roles only", () => expect(ids(["sre"], [])).toEqual(["alpha", "beta"]));
  test("skills only", () => expect(ids([], ["gamma"])).toEqual(["gamma"]));
  test("mixed, without duplicates", () => expect(ids(["sre", "dev"], ["beta", "gamma"])).toEqual(["alpha", "beta", "gamma"]));
  test("unknown ids are ignored", () => expect(ids(["nope"], ["nope"])).toEqual([]));
});

describe("emitters", () => {
  test("claude-code", () => {
    const out = emitters["claude-code"].emit([skill("alpha")], ctx);
    expect(JSON.parse(out.content)).toEqual({
      name: "marktplatz",
      owner: { name: "marktplatz.dev" },
      plugins: [
        {
          name: "alpha",
          description: "The alpha skill.",
          license: "MIT",
          repository: "https://github.com/acme/alpha",
          source: { source: "git-subdir", url: ctx.repoUrl, path: "approved/alpha/v1.0.0", sha: ctx.sha },
        },
      ],
    });
    expect(out.install).toEqual(["/plugin marketplace add ./marketplace.json", "/plugin install alpha@marktplatz"]);
  });

  test("codex", () => {
    const out = emitters.codex.emit([skill("alpha")], ctx);
    expect(JSON.parse(out.content)).toEqual({
      name: "marktplatz",
      plugins: [
        {
          name: "alpha",
          source: { source: "git-subdir", url: ctx.repoUrl, path: "approved/alpha/v1.0.0", sha: ctx.sha },
          policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
          category: "Productivity",
        },
      ],
    });
    expect(out.install).toEqual([
      "mkdir -p marktplatz/.agents/plugins",
      "mv marketplace.json marktplatz/.agents/plugins/",
      "codex plugin marketplace add ./marktplatz",
    ]);
  });
});
