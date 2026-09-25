# marktplatz

A curated marketplace of agent skills (SKILL.md), grouped by role. Every skill is
license-checked and scanned before it is admitted. People pick roles and skills on
the website and download a `marketplace.json` for Claude Code or OpenAI Codex. Every
harness reads its own marketplace format, so each one gets its own file, written in
the browser from the selection, with the commands to install from it.

## Adding a skill

Create `quarantine/<id>.yaml` (the form on the site's `/request` page fills it in on GitHub).
The file name must equal the `name` in the skill's SKILL.md.

```yaml
repo: DietrichGebert/ponytail
path: skills/ponytail
version: v4.10.0 # exact git tag
```

The `quarantine` workflow (`.github/workflows/quarantine.yml`) runs every day, on demand, and on
every push to `main` that changes `quarantine/` (a merged request). Daily and on demand it first
moves each `quarantine/<id>.yaml` to its repository's newest release tag
(`bun scripts/quarantine.ts updates`). Then, for every version not checked yet, in a job of its own, it:

1. clones the tag and copies `path`
2. requires a recognized SPDX license on the repo at that commit
3. scans the skill with NVIDIA SkillSpector, Cisco skill-scanner and ATR (offline, no LLM)

and records every verdict in one pull request (branch `bot/admit`) for a person to review and merge once CI passes:
a version that clears goes to `approved/<id>/<version>/`; one that is blocked stays in quarantine,
held in `gate/<id>/<version>/` with just its provenance and scan results (the files are not copied),
while the version already in the market keeps being served. The merge deploys the site. A new release
that can't be fetched or license-checked is left out of the PR and tried again the next day.

Pull requests that touch `quarantine/` (requests) run steps 1 to 3 as a read-only check.
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

- `quarantine/`: skill requests, written by hand and moved to new releases by the daily check
- `roles/`: hand-written role curation
- `approved/<id>/<version>/`: everything about one approved skill: upstream files
  (`skills/<id>/`), `LICENSE`, `provenance.json`, `scan/` (`summary.json` and each scanner's raw report) and the plugin manifest
- `src/`: the Astro site, plus the shared library used by the scripts

## Development

```sh
bun install
bun run dev      # the site (needs at least one git commit, which pins generated files)
bun test         # RUN_HARNESSES=1 also installs a guild with the real claude and codex CLIs in a throwaway home
bun scripts/verify.ts
```

Deploys go through `.github/workflows/deploy.yml` to Cloudflare (on push to `main`).
Every pull request also gets a [Worker Preview](https://developers.cloudflare.com/workers/previews/)
via `.github/workflows/preview.yml`: a stable URL that follows each push, shown on the PR as a
deployment of the `preview` environment (and in a comment), and deleted when the PR closes. Both need
the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets, in the `production` and `preview`
environments.

The quarantine workflow opens its PR as a GitHub App, because events caused by the workflow's own
`GITHUB_TOKEN` start no other workflows (CI would never run on the PR). It needs:

- a GitHub App with Contents and Pull requests read & write, installed on this repository, with its
  client id in the repository variable `MARKTPLATZ_APP_CLIENT_ID` and a private key in the secret
  `MARKTPLATZ_APP_PRIVATE_KEY`
- a ruleset on `main` that requires the `ci` status check
