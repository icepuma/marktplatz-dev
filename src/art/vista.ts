import { type Canvas, type Color, mix, rng } from "./canvas";
import { clamp, noise, smooth } from "./paint";
import { SEA, sea } from "./terrain";

// The far view past the edge of the square: sky, sun, clouds, islands and the open sea, softened by haze the
// way Sea of Stars paints its vistas (pale, low contrast, no outlines), so the town in front stands out.

export const SKY = {
  top: "#5d97d6",
  high: "#78aee2",
  mid: "#9cc6ea",
  low: "#c8def0",
  haze: "#efe8d6",
} as const;

/** A smooth sky gradient from y0 down to the horizon (the game's skies are soft, not banded). */
export function sky(c: Canvas, x0: number, x1: number, y0: number, horizon: number) {
  const stops = [SKY.top, SKY.high, SKY.mid, SKY.low, SKY.haze];
  for (let y = y0; y < horizon; y++) {
    const p = ((y - y0) / Math.max(1, horizon - y0)) * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(p));
    const color = mix(stops[k]!, stops[k + 1]!, p - k);
    for (let x = x0; x < x1; x++) c.px(x, y, color);
  }
}

/** The sun: a pale disc with a warm rim; its glow is added later as light. */
export function sun(c: Canvas, cx: number, cy: number, r: number) {
  c.ellipse(cx, cy, r + 3, r + 3, (x, y) => mix(c.get(x, y) ?? SKY.haze, "#fff4cc", 0.55));
  c.ellipse(cx, cy, r, r, (_, __, u, v) => (u * u + v * v > 0.8 ? "#fff0bc" : "#fffbea"));
}

/** A big soft cumulus cloud: stacked puffs, lit on top, lavender underneath, no outline. */
export function cloud(c: Canvas, cx: number, cy: number, w: number, seed: number, haze = 0) {
  const r = rng(seed);
  const puffs: [number, number, number][] = [];
  const n = Math.max(3, Math.round(w / 10));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const pr = (w / n) * r.range(0.9, 1.5) * (1 - Math.abs(t) * 0.7);
    puffs.push([cx + t * w, cy - pr * 0.4 + r.range(-2, 2), pr]);
  }
  const base = cy + w * 0.06;
  const palette = ["#fbf8f0", "#eef0f6", "#d9dcef", "#c0c3e0", "#a9aed2"].map((col) => mix(col, SKY.low, haze));
  for (const [px, py, pr] of puffs) {
    c.ellipse(px, py, pr, pr * 0.8, (_, y, u, v) => {
      if (y > base) return null;
      const t = 0.7 - v * 0.55 + u * 0.18 - (y - (base - 3) > 0 ? 0.45 : 0);
      return palette[t > 0.9 ? 0 : t > 0.65 ? 1 : t > 0.42 ? 2 : t > 0.2 ? 3 : 4]!;
    });
  }
}

/** Distant island: rocky pillars with green caps, washed out by haze. */
export function island(c: Canvas, cx: number, base: number, w: number, h: number, seed: number, haze: number) {
  const r = rng(seed);
  const rock = ["#8f86a8", "#a59cbc", "#b9b1cc"].map((col) => mix(col, SKY.low, haze));
  const green = ["#7f9a8a", "#94ae96", "#aac2a6"].map((col) => mix(col, SKY.low, haze));
  const pillars = Math.max(1, Math.round(w / 12));
  for (let i = 0; i < pillars; i++) {
    const px = cx - w / 2 + ((i + 0.5) / pillars) * w + r.range(-3, 3);
    const pw = r.range(5, 9);
    const ph = h * r.range(0.55, 1) * (1 - Math.abs(i / Math.max(1, pillars - 1) - 0.5) * 0.6);
    for (let y = Math.floor(base - ph); y < base; y++) {
      for (let x = Math.floor(px - pw); x <= px + pw; x++) {
        const u = (x - px) / pw;
        if (Math.abs(u) > 1 - Math.max(0, (base - ph + 3 - y) / 3) * 0.4) continue;
        const cap = y < base - ph + 3 + noise(x, 0, seed) * 2;
        c.px(x, y, cap ? green[u > 0.1 ? 2 : u > -0.4 ? 1 : 0]! : rock[u > 0.3 ? 2 : u > -0.3 ? 1 : 0]!);
      }
    }
  }
  // Foam line where the island meets the sea.
  for (let x = Math.floor(cx - w / 2 - 4); x <= cx + w / 2 + 4; x++) if (noise(x, base, seed) < 0.6) c.px(x, base, mix(SEA.foam, SKY.low, haze));
}

/** The open sea from the horizon down to `y1`, with haze that thins toward the viewer. */
export function openSea(c: Canvas, x0: number, x1: number, horizon: number, y1: number, sunX: number, frame = 0) {
  for (let y = horizon; y < y1; y++) {
    const far = 1 - (y - horizon) / Math.max(1, y1 - horizon);
    for (let x = x0; x < x1; x++) {
      const f = clamp(far * 0.85 + 0.15 + (smooth(x, y, 20, 3) - 0.5) * 0.1);
      c.px(x, y, y === horizon ? SEA.horizon : sea(x, y, f, sunX, frame));
    }
  }
}

/** A tiny sailing ship far away. */
export function sail(c: Canvas, x: number, y: number, haze: number) {
  const white = mix("#fbf6ea", SKY.low, haze);
  const shade = mix("#c9c4d8", SKY.low, haze);
  const hull = mix("#6a4a52", SKY.low, haze);
  c.hline(x - 3, x + 3, y, hull);
  c.hline(x - 2, x + 2, y + 1, hull);
  c.vline(x, y - 7, y - 1, hull);
  for (let j = 0; j < 5; j++) {
    c.hline(x + 1, x + 1 + Math.min(3, j), y - 6 + j, j < 2 ? white : shade);
    c.hline(x - 1 - Math.min(2, j >> 1), x - 1, y - 5 + j, white);
  }
}

export const hazeOf = (color: Color, t: number) => mix(color, SKY.low, t);
