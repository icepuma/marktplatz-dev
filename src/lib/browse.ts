import type { Catalog, CatalogRole, CatalogSkill } from "./types";

// Browser-safe: searching and filtering the catalog for the shop. Search is every word of the query somewhere in
// an item's text; filters combine as OR within one facet and AND across facets; each facet's option counts are
// taken with the other facets applied, so they always say how many results picking that option would give.

export type SkillFacet = "guilds" | "licenses" | "authors";
export type SkillFilters = Record<SkillFacet, string[]>;
export const NO_FILTERS: SkillFilters = { guilds: [], licenses: [], authors: [] };

export const words = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);
export const author = (skill: Pick<CatalogSkill, "repo">) => skill.repo.split("/")[0]!;
/** A readable name for a license id: "MIT" stays, "LicenseRef-Databricks" becomes "Databricks License". */
export const licenseName = (id: string) =>
  id.startsWith("LicenseRef-") ? `${id.slice("LicenseRef-".length).replace(/[-_]+/g, " ")} License` : id;

/** Everything the shop needs to know about a skill, computed once per catalog. `held`: waiting at the gate. */
export type SkillEntry = { skill: CatalogSkill; held: boolean; guilds: CatalogRole[]; text: string; values: Record<SkillFacet, string[]> };

/** The cleared skills, and with `withHeld` also the ones held at the gate. */
export function skillEntries(catalog: Catalog, withHeld: boolean): SkillEntry[] {
  const skills = [...catalog.skills, ...(withHeld ? catalog.held : [])];
  return skills.map((skill) => {
    const held = catalog.held.includes(skill);
    const guilds = catalog.roles.filter((r) => (held ? r.held : r.skills).includes(skill.id));
    return {
      skill,
      held,
      guilds,
      text: [skill.id, skill.description, skill.repo, skill.license, ...guilds.map((g) => g.name)].join(" ").toLowerCase(),
      values: { guilds: guilds.map((g) => g.id), licenses: [skill.license], authors: [author(skill)] },
    };
  });
}

export type GuildEntry = { role: CatalogRole; text: string };

export function guildEntries(catalog: Catalog): GuildEntry[] {
  return catalog.roles.map((role) => ({ role, text: [role.name, role.description, ...role.skills].join(" ").toLowerCase() }));
}

const matches = (text: string, terms: string[]) => terms.every((t) => text.includes(t));

/** Skills matching the search and the filters; `except` leaves one facet out (for counting its options). */
export function filterSkills(entries: SkillEntry[], terms: string[], filters: SkillFilters, except?: SkillFacet): SkillEntry[] {
  const facets = (Object.keys(filters) as SkillFacet[]).filter((f) => f !== except && filters[f].length > 0);
  return entries.filter((e) => matches(e.text, terms) && facets.every((f) => e.values[f].some((v) => filters[f].includes(v))));
}

/** For one facet, how many skills each option would leave, given the search and the other facets. */
export function facetCounts(entries: SkillEntry[], terms: string[], filters: SkillFilters, facet: SkillFacet): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of filterSkills(entries, terms, filters, facet)) for (const v of e.values[facet]) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

export function filterGuilds(entries: GuildEntry[], terms: string[]): GuildEntry[] {
  return entries.filter((e) => matches(e.text, terms));
}

/** How well a name answers the search: exact, then prefix, then contained, then only found elsewhere. */
export function nameScore(name: string, terms: string[]): number {
  const n = name.toLowerCase();
  let score = 0;
  for (const t of terms) score += n === t ? 3 : n.startsWith(t) ? 2 : n.includes(t) ? 1 : 0;
  return score;
}
