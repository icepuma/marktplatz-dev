import { bayer, type Canvas, type Color, mix } from "./canvas";

// Texture and material helpers for detailed pixel art: noise, dithered ramps, bricks, shingles, wood, foliage.

/** Deterministic hash noise in [0, 1) for integer coordinates. */
export function noise(x: number, y: number, seed = 0): number {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 982451653)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1) with the given cell size. */
export function smooth(x: number, y: number, cell: number, seed = 0): number {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = x / cell - gx;
  const fy = y / cell - gy;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = noise(gx, gy, seed);
  const b = noise(gx + 1, gy, seed);
  const c = noise(gx, gy + 1, seed);
  const d = noise(gx + 1, gy + 1, seed);
  return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy);
}

/** Picks from a color ramp (dark → light) at t in [0, 1], dithering between neighbours. */
export function ramp(colors: readonly Color[], t: number, x: number, y: number): Color {
  const p = Math.max(0, Math.min(0.9999, t)) * (colors.length - 1);
  const k = Math.floor(p);
  return p - k > bayer(x, y) ? colors[Math.min(colors.length - 1, k + 1)]! : colors[k]!;
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/** Fills a rectangle with a per-pixel color function; null leaves the pixel. */
export function fill(c: Canvas, x: number, y: number, w: number, h: number, f: (x: number, y: number) => Color | null) {
  for (let j = Math.floor(y); j < y + h; j++) {
    for (let i = Math.floor(x); i < x + w; i++) {
      const color = f(i, j);
      if (color) c.px(i, j, color);
    }
  }
}

/** Darkens (or lightens) existing pixels toward a color, dithered by coverage t(x, y). */
export function shadow(c: Canvas, x: number, y: number, w: number, h: number, t: (x: number, y: number) => number, color: Color = "#1a1430", amount = 0.35) {
  fill(c, x, y, w, h, (i, j) => {
    const base = c.get(i, j);
    if (!base) return null;
    return t(i, j) > bayer(i, j) ? mix(base, color, amount) : null;
  });
}

// Material ramps, dark → light.
export const RAMPS = {
  wood: ["#3a2214", "#5a3620", "#7a4a2a", "#9a6436", "#b8804a"],
  darkWood: ["#24160e", "#3a2416", "#553420", "#6e452a"],
  stone: ["#4a4652", "#5e5a66", "#77727e", "#908b96", "#aaa5ae"],
  warmStone: ["#5a4e46", "#72645a", "#8a7a6c", "#a49482", "#bcae9a"],
  plaster: ["#b89e7a", "#cdb690", "#e0cca6", "#eee0c0", "#f8eed8"],
  roofRed: ["#4e1a14", "#6e2a1e", "#8e3a28", "#ae5036", "#c86a48"],
  roofSlate: ["#262a3a", "#363c52", "#48506a", "#5c6684", "#76809c"],
  roofBrown: ["#3a2418", "#553624", "#704a30", "#8a5e3c", "#a4764c"],
  leaf: ["#1a3a1e", "#24502a", "#2e6a32", "#3e8a3a", "#5aa844", "#86c458"],
  grass: ["#2a4a22", "#35602a", "#437832", "#56923c", "#72ac48"],
  iron: ["#1a1a22", "#2e2e3a", "#464656", "#6a6a7e", "#9a9aae"],
  gold: ["#6a4a10", "#9a6e18", "#c8962a", "#e8c040", "#fff0a0"],
  skin: ["#8a4a30", "#b4704a", "#d8966a", "#f0b88a", "#ffd8b0"],
  cloth: {
    red: ["#4a1010", "#7a1a1a", "#a82828", "#cc3a32", "#e8604a"],
    cream: ["#8a7a5a", "#b8a47e", "#dccaa2", "#f0e2c0", "#fff6e0"],
    purple: ["#24103a", "#3a1a5a", "#54287e", "#6e3aa0", "#9058c4"],
    gold: ["#6a4a10", "#9a6e18", "#c8962a", "#e8b440", "#f8d870"],
    green: ["#10301a", "#1a4a26", "#246434", "#328044", "#4aa05a"],
    blue: ["#141e4a", "#1e2e6e", "#2a4296", "#3a5ab8", "#5a7ad8"],
  },
} as const;

/** Brick/stone courses with mortar, per-stone tone and a top-left highlight. */
export function bricks(
  c: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: readonly Color[],
  opts: { bw?: number; bh?: number; seed?: number; shade?: (x: number, y: number) => number } = {},
) {
  const { bw = 7, bh = 4, seed = 1, shade = () => 0.5 } = opts;
  const mortar = colors[0]!;
  fill(c, x, y, w, h, (i, j) => {
    const row = Math.floor((j - y) / bh);
    const off = row % 2 ? Math.floor(bw / 2) : 0;
    const col = Math.floor((i - x + off) / bw);
    const bx = (i - x + off) % bw;
    const by = (j - y) % bh;
    if (by === bh - 1 || bx === bw - 1) return mortar;
    const tone = 0.25 + noise(col, row, seed) * 0.35 + (shade(i, j) - 0.5) * 0.8;
    const lit = by === 0 || bx === 0 ? 0.15 : 0;
    const speck = noise(i, j, seed + 7) < 0.06 ? -0.15 : 0;
    return ramp(colors.slice(1), clamp(tone + lit + speck), i, j);
  });
}

/** Rows of roof shingles inside a mask, shaded by a light function. */
export function shingles(
  c: Canvas,
  inside: (x: number, y: number) => boolean,
  box: [x: number, y: number, w: number, h: number],
  colors: readonly Color[],
  light: (x: number, y: number) => number,
  seed = 3,
) {
  const [x0, y0, w, h] = box;
  fill(c, x0, y0, w, h, (i, j) => {
    if (!inside(i, j)) return null;
    const row = Math.floor((j - y0) / 3);
    const off = row % 2 ? 2 : 0;
    const col = Math.floor((i - x0 + off) / 4);
    const by = (j - y0) % 3;
    const bx = (i - x0 + off) % 4;
    let t = light(i, j) * 0.7 + noise(col, row, seed) * 0.25;
    if (by === 2) t -= 0.35; // bottom lip shadow
    if (by === 0) t += 0.1;
    if (bx === 3) t -= 0.15;
    return ramp(colors, clamp(t), i, j);
  });
}

/** Vertical or horizontal planks with grain and seams. */
export function planks(
  c: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: readonly Color[],
  opts: { vertical?: boolean; size?: number; seed?: number; light?: number } = {},
) {
  const { vertical = false, size = 5, seed = 5, light = 0.55 } = opts;
  fill(c, x, y, w, h, (i, j) => {
    const a = vertical ? i - x : j - y;
    const b = vertical ? j - y : i - x;
    const plank = Math.floor(a / size);
    const pa = a % size;
    if (pa === size - 1) return colors[0]!;
    const grain = smooth(b * 0.35, plank * 13 + pa * 2.5, 3, seed) - 0.5;
    const knot = noise(Math.floor(b / 9), plank, seed + 3) < 0.05 && pa === 2 && b % 9 === 4 ? -0.4 : 0;
    const t = light + (noise(plank, 0, seed) - 0.5) * 0.25 + grain * 0.35 + (pa === 0 ? 0.15 : 0) + knot;
    return ramp(colors.slice(1), clamp(t), i, j);
  });
}

/** A leafy foliage blob: clustered leaves, lit from the upper left. */
export function foliage(c: Canvas, cx: number, cy: number, rx: number, ry: number, seed = 9, colors: readonly Color[] = RAMPS.leaf) {
  for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) {
    for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
      const u = (x - cx) / rx;
      const v = (y - cy) / ry;
      const edge = 1 + (smooth(x, y, 3, seed) - 0.5) * 0.5;
      const d = Math.hypot(u, v);
      if (d > edge) continue;
      const clump = smooth(x, y, 4, seed + 1);
      const t = 0.55 - u * 0.25 - v * 0.35 + (clump - 0.5) * 0.6 - Math.max(0, d - 0.75) * 0.8;
      c.px(x, y, ramp(colors, clamp(t), x, y));
    }
  }
}

/** A cumulus cloud built from puffs, lit from the top right. */
export function cloud(c: Canvas, x: number, y: number, w: number, seed: number, colors: readonly Color[]) {
  const puffs = Math.max(3, Math.round(w / 12));
  for (let k = 0; k < puffs; k++) {
    const px = x + (k + 0.5) * (w / puffs);
    const r = (w / puffs) * (0.7 + noise(k, 1, seed) * 0.6) * (k === 0 || k === puffs - 1 ? 0.7 : 1);
    const py = y - r * 0.4 - noise(k, 2, seed) * 3;
    for (let j = Math.floor(py - r); j <= y + 1; j++) {
      for (let i = Math.floor(px - r - 1); i <= px + r + 1; i++) {
        const u = (i - px) / r;
        const v = (j - py) / r;
        if (u * u + v * v > 1 + (noise(i, j, seed) - 0.5) * 0.15) continue;
        const t = 0.75 + u * 0.15 - v * 0.45 - (j > y - 3 ? 0.3 : 0);
        c.px(i, j, ramp(colors, clamp(t), i, j));
      }
    }
  }
}

/** A cylinder-shading factor for column x in [x0, x0+w): light on the left, dark on the right. */
export const cylinder = (x: number, x0: number, w: number) => clamp(0.85 - ((x - x0) / Math.max(1, w - 1)) * 0.75);
