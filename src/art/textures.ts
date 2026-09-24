import { bayer, Canvas, mix, rng } from "./canvas";

// Seamless 32x32 tiles for panels and backgrounds.

export function woodTile(): Canvas {
  const c = new Canvas(32, 32);
  const r = rng(11);
  const planks = ["#8a5a34", "#7e5230", "#946238", "#835632"];
  for (let p = 0; p < 4; p++) {
    const y0 = p * 8;
    const base = planks[p]!;
    for (let y = y0; y < y0 + 8; y++) {
      for (let x = 0; x < 32; x++) {
        // Grain: periodic in x so the tile repeats.
        const grain = Math.sin(((x + p * 7) / 32) * Math.PI * 4 + y * 1.3) * 0.5 + 0.5;
        c.px(x, y, grain > 0.8 && bayer(x, y) < 0.6 ? mix(base, "#4e2e19", 0.35) : base);
      }
    }
    c.hline(0, 31, y0, mix(base, "#c89060", 0.35));
    c.hline(0, 31, y0 + 7, "#4e2e19");
    // Seam and nails.
    const seam = (p * 13 + 5) % 32;
    c.vline(seam, y0, y0 + 7, "#4e2e19");
    c.px((seam + 2) % 32, y0 + 2, "#2a1a10");
    c.px((seam + 2) % 32, y0 + 5, "#2a1a10");
    if (r.chance(0.5)) c.ellipse((seam + 16) % 32, y0 + 4, 1.5, 1, "#5a3620");
  }
  return c;
}

/** The classic adventure-game crosshair cursor, 2x scaled. */
export function crosshair(): Canvas {
  const c = new Canvas(15, 15);
  for (let i = 0; i < 15; i++) {
    if (Math.abs(i - 7) < 2) continue;
    c.px(i, 7, "#ffffff");
    c.px(7, i, "#ffffff");
  }
  c.px(7, 7, "#ffe066");
  c.outline("#1a1020");
  return c.scale(2);
}
