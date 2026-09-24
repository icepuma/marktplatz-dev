# marktplatz

See README.md for what this is and how skills flow from `quarantine/` to `approved/`.

- Keep it simple: no fallbacks, no overrides, no optional manifest fields.
- Everything about a skill stays in `approved/<id>/<version>/`. There are no central lockfiles.
- Never edit files under `approved/` by hand; they are produced by `scripts/promote.ts` and checked by `scripts/verify.ts`.
- Use bun for everything (`bun test`, `bun scripts/...`, `bun run build`).
- `src/lib/emitters.ts` and `src/lib/types.ts` run in the browser; don't import node or bun modules there.
- The site is a pixel-art medieval market in the style of early-90s point-and-click adventures (verb bar, sentence line, inventory).
- All art is painted in code by `src/art/` (a small canvas with dithering, lighting and PNG output) and served as build-time endpoints under `src/pages/art/`. Guild shields and ware icons are derived from ids. Don't commit binary images.
- The hero scene (640x320) is painted once in daylight colors (`src/art/market.ts`, materials in `paint.ts`, props in `props.ts`); `paintMarket("night")` grades it to moonlight and then draws every registered light source (`Glow`, occlusion-aware via `visibleGlow`). Clicking the sun/moon or any `[data-theme-toggle]` switches the theme (saved in localStorage).
- Preview art while painting: `bun scripts/art-preview.ts <out-dir>` writes upscaled PNGs.

Astro docs: https://docs.astro.build
