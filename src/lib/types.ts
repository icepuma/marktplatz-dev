import type { Provenance, Role, ScanSummary } from "./schema";

// Browser-safe types shared by the site, the builder and the emitters.

export type CatalogSkill = Provenance & {
  description: string;
  scan: ScanSummary;
};

/** `skills` are the guild's cleared skills; `held` are the ones waiting at the gate, offered only on request. */
export type CatalogRole = Role & { id: string; held: string[] };

export type Catalog = {
  skills: CatalogSkill[];
  roles: CatalogRole[];
  /** Skills that did not clear the watch. They are never copied into the market; installs point at their repo. */
  held: CatalogSkill[];
};
