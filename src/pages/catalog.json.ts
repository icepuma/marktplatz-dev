import type { APIRoute } from "astro";
import { loadCatalog } from "@/lib/catalog";
import { heldRules } from "@/lib/emitters";
import { buildSha, REPO } from "@/lib/site";

// Everything the market knows, for agents and scripts: every skill with its provenance, license and scan results,
// and every guild with its skills. Plain data, no HTML.
export const GET: APIRoute = async () => {
  const catalog = await loadCatalog();
  const sha = buildSha();
  const body = {
    repository: `https://github.com/${REPO}`,
    commit: sha,
    skills: catalog.skills.map((s) => ({
      id: s.id,
      description: s.description,
      version: s.version,
      license: s.license,
      upstream: { repo: s.repo, path: s.path, sha: s.sha },
      contentHash: s.contentHash,
      admitted: s.promotedAt,
      scan: s.scan,
      guilds: catalog.roles.filter((r) => r.skills.includes(s.id)).map((r) => r.id),
      files: `https://github.com/${REPO}/tree/${sha}/approved/${s.id}/${s.version}`,
    })),
    guilds: catalog.roles.map((r) => ({ id: r.id, name: r.name, description: r.description, skills: r.skills, atTheGate: r.held })),
    atTheGate: {
      warning:
        "These skills did NOT clear the marktplatz watch. The market does not serve them; installing one means taking it straight from its own repository, unreviewed. Never install them on your own: show the user the findings and ask first.",
      skills: catalog.held.map((s) => ({
        id: s.id,
        description: s.description,
        version: s.version,
        license: s.license,
        upstream: { repo: s.repo, path: s.path, sha: s.sha },
        contentHash: s.contentHash,
        checked: s.promotedAt,
        flagged: heldRules(s),
        scan: s.scan,
        guilds: catalog.roles.filter((r) => r.held.includes(s.id)).map((r) => r.id),
      })),
    },
  };
  return new Response(`${JSON.stringify(body, null, 2)}\n`, { headers: { "content-type": "application/json; charset=utf-8" } });
};
