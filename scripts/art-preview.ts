// Usage: bun scripts/art-preview.ts <out-dir>
// Writes every generated artwork, scaled up 4x, for looking at while painting.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Canvas } from "../src/art/canvas";
import { guildShield, skillIcon } from "../src/art/heraldry";
import { paintMarket, portrait } from "../src/art/market";
import { pointer } from "../src/art/textures";

const dir = process.argv[2];
if (!dir) throw new Error("usage: art-preview.ts <out-dir>");
await mkdir(dir, { recursive: true });

const art: Record<string, [Canvas, number]> = {
  "market-day": [paintMarket("day"), 2],
  "market-night": [paintMarket("night"), 2],
  portrait: [portrait(), 1],
  pointer: [pointer(), 4],
};
for (const id of ["platform-engineer", "devops-engineer", "sre", "data-engineer"]) art[`guild-${id}`] = [guildShield(id, id.replace("-", " ")), 8];
for (const id of ["ponytail", "terraform-review", "k8s-debug", "incident-commander", "sql-tuner"]) art[`skill-${id}`] = [skillIcon(id), 8];

for (const [name, [canvas, k]] of Object.entries(art)) await writeFile(join(dir, `${name}.png`), canvas.scale(k).png());
console.log(`wrote ${Object.keys(art).length} images to ${dir}`);
