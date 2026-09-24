import type { Provenance, Role, ScanSummary } from "./schema";

// Browser-safe types shared by the site, the builder and the emitters.

export type CatalogSkill = Provenance & {
  description: string;
  scan: ScanSummary;
};

export type CatalogRole = Role & { id: string };

export type Catalog = {
  skills: CatalogSkill[];
  roles: CatalogRole[];
};
