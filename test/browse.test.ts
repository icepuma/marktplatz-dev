import { describe, expect, test } from "bun:test";
import { facetCounts, filterGuilds, filterSkills, guildEntries, NO_FILTERS, nameScore, skillEntries, words } from "../src/lib/browse";
import type { Catalog, CatalogSkill } from "../src/lib/types";

const skill = (id: string, repo: string, license: string, description: string): CatalogSkill => ({
  id,
  repo,
  path: `skills/${id}`,
  version: "v1.0.0",
  sha: "a".repeat(40),
  contentHash: `sha256-${"b".repeat(64)}`,
  license,
  promotedAt: "2026-09-25T00:00:00.000Z",
  description,
  scan: { passed: true, scanners: [], findings: [] },
});

const catalog: Catalog = {
  skills: [
    skill("terraform-review", "acme/infra", "MIT", "Reviews Terraform plans."),
    skill("k8s-debug", "acme/infra", "Apache-2.0", "Debugs pods and services."),
    skill("sql-tuner", "dbfolk/sql", "MIT", "Tunes slow queries."),
  ],
  roles: [
    { id: "platform", name: "Platform Engineer", description: "Runs the platform.", skills: ["terraform-review", "k8s-debug"], held: [] },
    { id: "data", name: "Data Engineer", description: "Moves data.", skills: ["sql-tuner"], held: [] },
  ],
  held: [],
};
const skills = skillEntries(catalog, false);
const ids = (entries: ReturnType<typeof filterSkills>) => entries.map((e) => e.skill.id);

describe("search", () => {
  test("every word must match somewhere: name, description, repo, license or guild", () => {
    expect(ids(filterSkills(skills, words("terraform"), NO_FILTERS))).toEqual(["terraform-review"]);
    expect(ids(filterSkills(skills, words("acme debug"), NO_FILTERS))).toEqual(["k8s-debug"]);
    expect(ids(filterSkills(skills, words("Platform"), NO_FILTERS))).toEqual(["terraform-review", "k8s-debug"]);
    expect(ids(filterSkills(skills, words("  "), NO_FILTERS))).toHaveLength(3);
  });

  test("guilds match on their name, description and skills", () => {
    const guilds = guildEntries(catalog);
    expect(filterGuilds(guilds, words("sql")).map((g) => g.role.id)).toEqual(["data"]);
    expect(filterGuilds(guilds, words("runs platform")).map((g) => g.role.id)).toEqual(["platform"]);
  });

  test("names that start with the search rank above names that only contain it", () => {
    expect(nameScore("terraform-review", ["terra"])).toBeGreaterThan(nameScore("review-terraform", ["terra"]));
    expect(nameScore("sql", ["sql"])).toBeGreaterThan(nameScore("sql-tuner", ["sql"]));
    expect(nameScore("k8s-debug", ["terra"])).toBe(0);
  });
});

describe("filters", () => {
  test("values of one filter widen (OR), different filters narrow (AND)", () => {
    expect(ids(filterSkills(skills, [], { ...NO_FILTERS, licenses: ["MIT", "Apache-2.0"] }))).toHaveLength(3);
    expect(ids(filterSkills(skills, [], { ...NO_FILTERS, licenses: ["MIT"], authors: ["acme"] }))).toEqual(["terraform-review"]);
    expect(ids(filterSkills(skills, [], { ...NO_FILTERS, guilds: ["data"] }))).toEqual(["sql-tuner"]);
  });

  test("a filter's counts apply the search and the other filters, but not itself", () => {
    const filters = { ...NO_FILTERS, licenses: ["MIT"], authors: ["acme"] };
    expect(Object.fromEntries(facetCounts(skills, [], filters, "licenses"))).toEqual({ MIT: 1, "Apache-2.0": 1 });
    expect(Object.fromEntries(facetCounts(skills, [], filters, "authors"))).toEqual({ acme: 1, dbfolk: 1 });
    expect(Object.fromEntries(facetCounts(skills, words("tunes"), NO_FILTERS, "guilds"))).toEqual({ data: 1 });
  });
});
