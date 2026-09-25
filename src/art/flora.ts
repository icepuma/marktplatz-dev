import { type Canvas, type Color, mix, rng } from "./canvas";
import { clamp, noise } from "./paint";
import { type Sprite, sprite, stamp } from "./sprite";

// Foliage the way Sea of Stars draws it: canopies built leaf by leaf (little rounded leaves overlapping like
// scales, lit toward the sun, with near-black gaps between them), cypresses of stacked needle tufts, ferns,
// flowers and ivy.

export const LEAF = {
  gap: "#132022",
  deep: "#1d3934",
  dark: "#2a5136",
  base: "#3d6c3a",
  mid: "#578a3e",
  light: "#7daa46",
  high: "#a6c656",
  tip: "#cce06c",
} as const;
const LEVELS = [LEAF.deep, LEAF.dark, LEAF.base, LEAF.mid, LEAF.light, LEAF.high, LEAF.tip] as const;

// Leaf shapes hanging down and to the left: s = shadowed edge, b = body, h = lit edge.
const LEAVES: readonly (readonly string[])[] = [
  [".hhh.", "hbbbh", "sbbbh", ".sbb.", "..s.."],
  ["..hh.", ".hbbh", "sbbbh", "sbbs.", ".s..."],
  [".hh..", "hbbh.", "sbbbh", ".sbbs", "...s."],
  [".hhh", "hbbh", "sbbh", ".ss."],
];

/**
 * A rounded clump of leaves: a dark heart, then leaves stamped in staggered rows from back to front, each lit by
 * where it sits on the clump (a sphere lit from the upper right): pale yellow-green on the sunny shoulder, teal in
 * the shade underneath. `level` shifts the whole clump lighter or darker.
 */
export function leafClump(c: Canvas, cx: number, cy: number, rx: number, ry: number, seed: number, level = 0, palette: readonly Color[] = LEVELS) {
  const r = rng(seed);
  c.ellipse(cx, cy, rx - 1.5, ry - 1.5, (x, y) => (noise(x, y, seed) < 0.6 ? LEAF.gap : palette[0]!));
  const n = palette.length;
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry; y += 3) {
    const row = Math.round(y - (cy - ry));
    for (let x = Math.floor(cx - rx) - 1 + ((row / 3) % 2) * 2; x <= cx + rx; x += 5) {
      const lx = x + r.int(-1, 1);
      const ly = y + r.int(-1, 0);
      const u = (lx + 2 - cx) / rx;
      const v = (ly + 2 - cy) / ry;
      const d = u * u + v * v;
      if (d > 1 + r.range(0, 0.15)) continue;
      const nz = Math.sqrt(Math.max(0, 1 - d));
      let light = clamp(0.3 + u * 0.3 - v * 0.55 + nz * 0.16 + r.range(-0.06, 0.06) + level * 0.15);
      if (v > 0.45) light -= 0.12; // the underside of every clump sits in its own shade
      const k = Math.min(n - 2, Math.max(0, Math.floor(clamp(light) * (n - 1))));
      const body = palette[k]!;
      const lit = palette[Math.min(n - 1, k + 1)]!;
      const shade = palette[Math.max(0, k - 1)]!;
      const shape = r.pick(LEAVES);
      shape.forEach((rowStr, j) => {
        for (let i = 0; i < rowStr.length; i++) {
          const key = rowStr[i];
          if (key === ".") continue;
          c.px(lx + i, ly + j, key === "h" ? lit : key === "s" ? shade : body);
        }
      });
    }
  }
  // A dark rim under the clump separates it from whatever lies below.
  for (let x = Math.floor(cx - rx * 0.8); x <= cx + rx * 0.8; x++) {
    const u = (x - cx) / rx;
    const y = Math.round(cy + ry * Math.sqrt(Math.max(0, 1 - u * u)) - 1);
    if (c.get(x, y) && noise(x, 3, seed) < 0.7) c.px(x, y + 1, LEAF.gap);
  }
}

/** A broadleaf tree: roots and a furrowed trunk, branches forking into a crown of overlapping clumps. */
export function broadleaf(c: Canvas, x: number, gy: number, size: number, seed: number) {
  const r = rng(seed);
  const bark = ["#221820", "#3a2a2c", "#57403a", "#76584a", "#94735c", "#b08c70"];
  const trunkH = Math.round(size * 0.5);
  const tw = Math.max(5, Math.round(size / 8));
  // Roots and trunk, a cylinder lit from the right with vertical furrows.
  for (let y = gy - trunkH - 8; y <= gy; y++) {
    const flare = y > gy - 6 ? (y - (gy - 6)) ** 1.4 * 0.7 : 0;
    const half = tw / 2 + flare;
    for (let xx = Math.floor(x - half); xx <= x + half; xx++) {
      const u = (xx + 0.5 - x) / half;
      let k = u > 0.55 ? 4 : u > 0.1 ? 3 : u > -0.45 ? 2 : 1;
      if (Math.abs(u) > 0.92) k = 0;
      if (noise(xx, Math.floor(y / 4), seed) < 0.22 && Math.abs(u) < 0.9) k = Math.max(1, k - 1); // furrows
      if (y > gy - 3 && noise(xx, y, seed + 1) < 0.3) k = Math.max(1, k - 1);
      c.px(xx, y, bark[k]!);
    }
  }
  // Moss on the shady side of the trunk.
  for (let y = gy - trunkH; y < gy - 2; y++) if (noise(0, y, seed + 2) < 0.35) c.px(Math.round(x - tw / 2 + 1), y, "#4f6e34");
  // Branches reaching into the crown.
  const top = gy - trunkH;
  for (const [dx, dy] of [
    [-size * 0.38, -size * 0.3],
    [size * 0.34, -size * 0.34],
    [-size * 0.08, -size * 0.52],
  ]) {
    for (let t = 0; t <= 1; t += 0.04) {
      const bx = Math.round(x + dx * t);
      const by = Math.round(top + dy * t - Math.sin(t * Math.PI) * 4);
      const w = Math.max(1, Math.round((1 - t) * 2.5));
      for (let i = -w; i <= w; i++) c.px(bx + i, by, bark[i > 0 ? 3 : 2]!);
    }
  }
  // Crown: big back clumps first, then the sides, then the front ones low over the trunk.
  const cy = top - size * 0.32;
  const clumps: [number, number, number, number, number][] = [
    [x + size * 0.02, cy - size * 0.18, size * 0.46, size * 0.3, 0.05],
    [x - size * 0.4, cy, size * 0.36, size * 0.28, -0.15],
    [x + size * 0.42, cy - size * 0.02, size * 0.36, size * 0.28, 0.08],
    [x - size * 0.14, cy + size * 0.1, size * 0.42, size * 0.3, -0.05],
    [x + size * 0.2, cy + size * 0.14, size * 0.36, size * 0.26, 0],
    [x - size * 0.5, cy + size * 0.22, size * 0.22, size * 0.18, -0.3],
    [x + size * 0.5, cy + size * 0.2, size * 0.22, size * 0.17, -0.1],
  ];
  for (const [cx, ccy, rx, ry, level] of clumps) leafClump(c, cx + r.range(-2, 2), ccy, rx, ry, r.int(1, 1e6), level);
}

/** A cypress: a tall flame of needle tufts, lit on the right. */
export function cypress(c: Canvas, x: number, gy: number, h: number, seed: number) {
  const r = rng(seed);
  const pal = ["#1b2c24", "#2a4230", "#3a5a36", "#4f743c", "#6a9044", "#88aa52"];
  const w = h * 0.2;
  const shape = (y: number) => {
    const t = (gy - y) / h; // 0 at the base, 1 at the tip
    return w * Math.sin(Math.min(1, t * 1.25) * Math.PI) * (t > 0.8 ? 1 - (t - 0.8) * 2.2 : 1) + (t < 0.08 ? 0 : 0);
  };
  for (let y = gy - h; y <= gy - 3; y++) {
    const half = shape(y);
    for (let xx = Math.floor(x - half); xx <= x + half; xx++) c.px(xx, y, pal[0]!);
  }
  // Tufts: little chevrons stacked up the trunk.
  for (let y = gy - 4; y > gy - h; y -= 2) {
    const half = shape(y);
    for (let xx = Math.floor(x - half) + 1; xx < x + half; xx += 3) {
      const u = (xx - x) / Math.max(1, half);
      const t = clamp(0.4 + u * 0.45 + ((gy - y) / h) * 0.2 + r.range(-0.12, 0.12));
      const k = 1 + Math.round(t * 4);
      c.px(xx, y, pal[Math.min(5, k)]!);
      c.px(xx + 1, y - 1, pal[Math.min(5, k)]!);
      c.px(xx - 1, y + 1, pal[Math.max(1, k - 1)]!);
      c.px(xx + 1, y + 1, pal[Math.max(1, k - 2)]!);
    }
  }
  // A bit of trunk at the base.
  c.rect(x - 1, gy - 3, 3, 3, "#4a3230");
  c.px(x + 1, gy - 3, "#6a4a3e");
}

/** A fern: bright fronds radiating from a dark heart. */
export function fern(c: Canvas, x: number, y: number, size: number, seed: number) {
  const r = rng(seed);
  const pal = ["#233a1e", "#3e6a2c", "#5e9434", "#86ba44", "#aad25a"];
  const fronds = 5 + r.int(0, 2);
  for (let f = 0; f < fronds; f++) {
    const a = Math.PI * (1.08 + (f / (fronds - 1)) * 0.84) + r.range(-0.1, 0.1);
    const len = size * r.range(0.7, 1);
    for (let s = 1; s <= len; s++) {
      const t = s / len;
      const px = Math.round(x + Math.cos(a) * s);
      const py = Math.round(y + Math.sin(a) * s * 0.75 + t * t * size * 0.35);
      const lit = Math.cos(a) > 0 ? 1 : 0;
      c.px(px, py, pal[t < 0.25 ? 1 : 2 + lit]!);
      if (s % 2 === 0 && t < 0.9) {
        c.px(px, py - 1, pal[3 + lit]!);
        c.px(px + (Math.cos(a) > 0 ? 1 : -1), py + 1, pal[1]!);
      }
    }
  }
  c.px(x, y, pal[0]!);
  c.px(x, y + 1, pal[0]!);
}

const FLOWER: Record<string, Sprite> = {
  daisy: sprite([".w.", "wyw", ".w."], { w: "#fbf6ee", y: "#f2c24a" }),
  poppy: sprite([".r.", "rkr", ".r."], { r: "#e4483e", k: "#5a1a1e" }),
  blue: sprite(["b.b", ".c.", "b.b"], { b: "#8ab4f0", c: "#f6f0d0" }),
  pink: sprite([".p.", "pwp", ".p."], { p: "#f08ab0", w: "#fff2f4" }),
};

/** A little patch of wildflowers with leaves. */
export function flowers(c: Canvas, x: number, y: number, n: number, seed: number, kinds: readonly (keyof typeof FLOWER)[] = ["daisy", "poppy", "blue", "pink"]) {
  const r = rng(seed);
  for (let k = 0; k < n; k++) {
    const fx = x + r.int(-6, 6);
    const fy = y + r.int(-3, 3);
    c.px(fx, fy + 2, "#3e6a2c");
    c.px(fx + 1, fy + 3, "#5e9434");
    c.px(fx - 1, fy + 3, "#3e6a2c");
    stamp(c, FLOWER[r.pick(kinds)]!, fx - 1, fy - 1);
  }
}

/** Ivy climbing a wall from the ground: a spray of small leaves along a wandering stem. */
export function ivy(c: Canvas, x: number, gy: number, h: number, seed: number) {
  const r = rng(seed);
  let px = x;
  for (let y = gy; y > gy - h; y--) {
    px += r.pick([-1, 0, 0, 1]);
    c.px(px, y, "#2e4a26");
    if (r.chance(0.6)) {
      const side = r.pick([-1, 1]);
      c.px(px + side, y, r.chance(0.5) ? LEAF.mid : LEAF.base);
      c.px(px + side * 2, y - 1, r.chance(0.5) ? LEAF.light : LEAF.mid);
      c.px(px + side, y - 1, LEAF.dark);
    }
  }
}

/** A hedge band of leaf clumps along a line (gardens behind houses). */
export function hedge(c: Canvas, x0: number, x1: number, y: number, seed: number) {
  const r = rng(seed);
  for (let x = x0; x < x1; x += r.int(14, 22)) leafClump(c, x, y + r.int(-3, 3), r.int(12, 17), r.int(9, 12), r.int(1, 1e6), r.range(-0.35, 0));
}

export const leafTint = (color: Color, t: number) => mix(color, LEAF.gap, t);

/** A round shrub: a couple of leaf clumps on a dark base, with a few blossoms if given. */
export function shrub(c: Canvas, cx: number, gy: number, w: number, seed: number, blossoms?: readonly Color[]) {
  const r = rng(seed);
  const h = w * 0.7;
  leafClump(c, cx - w * 0.18, gy - h * 0.55, w * 0.36, h * 0.42, r.int(1, 1e6), -0.1);
  leafClump(c, cx + w * 0.18, gy - h * 0.58, w * 0.34, h * 0.4, r.int(1, 1e6), 0.05);
  leafClump(c, cx, gy - h * 0.42, w * 0.44, h * 0.38, r.int(1, 1e6), 0);
  if (blossoms) {
    for (let k = 0; k < w * 0.6; k++) {
      const x = Math.round(cx + r.range(-w * 0.42, w * 0.42));
      const y = Math.round(gy - h * r.range(0.3, 0.85));
      if (!c.get(x, y)) continue;
      const col = r.pick(blossoms);
      c.px(x, y, col);
      if (r.chance(0.5)) c.px(x + 1, y, mix(col, "#ffffff", 0.35));
    }
  }
}

/** A flower bed edged with low boards: clumps of leaves and blooms on dark soil. */
export function flowerBed(c: Canvas, x: number, y: number, w: number, d: number, seed: number) {
  const r = rng(seed);
  const soil = ["#3a2622", "#4e342a"];
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) c.px(x + i, y + j, soil[noise(x + i, y + j, seed) < 0.3 ? 1 : 0]!);
  // Leafy clumps first, then blooms of a few kinds on top.
  for (let i = 1; i < w - 1; i += 3) {
    for (let j = 1; j < d - 1; j += 3) {
      const lx = x + i + r.int(0, 1);
      const ly = y + j + r.int(0, 1);
      c.px(lx, ly, LEAF.base);
      c.px(lx + 1, ly, LEAF.mid);
      c.px(lx, ly + 1, LEAF.dark);
      c.px(lx - 1, ly + 1, LEAF.base);
    }
  }
  const kinds = Object.keys(FLOWER) as (keyof typeof FLOWER)[];
  for (let k = 0; k < Math.floor((w * d) / 14); k++) stamp(c, FLOWER[r.pick(kinds)]!, x + r.int(0, w - 3), y + r.int(-1, d - 3));
  // Board edging: the near side faces us.
  for (let i = -1; i <= w; i++) {
    c.px(x + i, y + d, "#b8844c");
    c.px(x + i, y + d + 1, "#8a5e36");
    c.px(x + i, y + d + 2, "#5a3c26");
    c.px(x + i, y - 1, "#8a5e36");
  }
  for (let j = -1; j <= d; j++) {
    c.px(x - 1, y + j, "#7a5232");
    c.px(x + w, y + j, "#b88048");
  }
}
