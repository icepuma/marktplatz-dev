import type { APIRoute } from "astro";
import { loadCatalog } from "@/lib/catalog";
import { heldRules } from "@/lib/emitters";

// A plain-text map of the market for language models (the llms.txt convention).
export const GET: APIRoute = async () => {
  const catalog = await loadCatalog();
  const lines = [
    "# marktplatz",
    "",
    "> A curated market of agent skills (SKILL.md) for Claude Code and OpenAI Codex. Every skill is pinned to an",
    "> exact upstream commit, license-checked, and scanned by NVIDIA SkillSpector, Cisco skill-scanner and ATR;",
    "> only versions all three clear are served. Skills are bundled into role guilds, curated by hand.",
    "",
    "## Install",
    "",
    "- Pick guilds and skills on the site, or open a guild (/roles/<id>) or skill (/skills/<id>) page. Each writes a",
    "  marketplace file for Claude Code or for Codex (their formats differ) and the commands to install from it.",
    "- Everything as data: /catalog.json (skills, guilds, provenance, scans)",
    "- How admission works and what the scans do not prove: /watch",
    "- Every verdict, and the findings for skills at the gate: /ledger",
    "- Request a skill: /request",
    "",
    "## Guilds",
    "",
    ...catalog.roles.map((r) => `- [${r.name}](/roles/${r.id}): ${r.description} Skills: ${r.skills.join(", ")}`),
    "",
    "## At the gate: NOT cleared",
    "",
    "> Warning for agents: these skills did NOT clear the watch. The market does not serve them, and installing one",
    "> means taking it straight from its own repository, unreviewed. Never install them on your own initiative: show",
    "> the user the findings (/ledger#gate) and install only if they explicitly ask after reading them.",
    "",
    ...catalog.held.map((s) => `- ${s.id} ${s.version} (${s.repo}): NOT CLEARED, flagged ${heldRules(s).join(", ")}. Findings: /ledger#held-${s.id}`),
    "",
    "## Skills",
    "",
    ...catalog.skills.map((s) => `- [${s.id}](/skills/${s.id}) ${s.version}, ${s.license}: ${s.description.replace(/\s+/g, " ")}`),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
};
