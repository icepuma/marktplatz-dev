# marktplatz

A curated marketplace of agent skills (SKILL.md), grouped by role. Every skill is
license-checked and scanned before it is admitted. People pick roles and skills on
the website and download a `marketplace.json` for Claude Code or OpenAI Codex.

## Adding a skill

Create `quarantine/<id>.yaml`. The file name must equal the `name` in the skill's SKILL.md.

```yaml
repo: DietrichGebert/ponytail
path: skills/ponytail
version: v4.10.0 # exact git tag
```

On push to `main`, the `quarantine` workflow:

1. clones the tag and copies `path`
2. requires a recognized SPDX license on the repo at that commit
3. scans the skill with NVIDIA SkillSpector, Cisco skill-scanner and ATR (offline, no LLM)
4. opens a PR that adds `approved/<id>/<version>/`

Any critical or high finding (or a SkillSpector risk score above 20) blocks the skill.
There are no waivers: fix it upstream or pick another version.

Run the same steps locally (needs `uv` and `bun`):

```sh
bun scripts/quarantine.ts check <id>
bun scripts/promote.ts <id>
```

## Curating roles

Create `roles/<role>.yaml`:

```yaml
name: Platform Engineer
description: Builds and runs the internal developer platform.
skills:
  - ponytail
```

## Layout

- `quarantine/`: hand-written skill requests
- `roles/`: hand-written role curation
- `approved/<id>/<version>/`: everything about one approved skill: upstream files
  (`skills/<id>/`), `LICENSE`, `provenance.json`, `scan/summary.json` and the plugin manifest
- `src/`: the Astro site, plus the shared library used by the scripts

## Development

```sh
bun install
bun run dev      # the site (needs at least one git commit, which pins generated files)
bun test         # RUN_SCANNERS=1 also runs the real scanners against test/fixtures/malicious
bun scripts/verify.ts
```

Deploys go through `.github/workflows/deploy.yml` to Cloudflare (on push to `main`).
Every pull request also gets a [Worker Preview](https://developers.cloudflare.com/workers/previews/)
via `.github/workflows/preview.yml`: a stable URL that follows each push, posted as a PR
comment and deleted when the PR closes. Both need the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` secrets, in the `production` and `preview` environments.
