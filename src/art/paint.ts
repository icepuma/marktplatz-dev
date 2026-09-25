import { type Canvas, type Color, hueRamp } from "./canvas";

// Shared painting helpers: deterministic noise, palette ramps, and normal-based shading with the one key light (the
// sun, up and to the right). The materials themselves live with what they paint (terrain, buildings, flora, props).

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

export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/** Picks the nearest color from a ramp (dark → light) at t in [0, 1]. */
export function ramp(colors: readonly Color[], t: number): Color {
  return colors[Math.round(clamp(t) * (colors.length - 1))]!;
}

/** Fills a rectangle with a per-pixel color function; null leaves the pixel. */
export function fill(c: Canvas, x: number, y: number, w: number, h: number, f: (x: number, y: number) => Color | null) {
  for (let j = Math.floor(y); j < y + h; j++) {
    for (let i = Math.floor(x); i < x + w; i++) {
      const color = f(i, j);
      if (color) c.px(i, j, color);
    }
  }
}

// ---------------------------------------------------------------- light

const len = Math.hypot(0.5, 0.72, 0.48);
/** The key light: from the upper right and slightly in front (x right, y down, z toward the viewer). */
export const LIGHT = [0.5 / len, -0.72 / len, 0.48 / len] as const;

/** Brightness in [0, 1] for a surface normal (need not be normalized), with ambient fill. */
export function lit(nx: number, ny: number, nz: number, ambient = 0.3): number {
  const n = Math.hypot(nx, ny, nz) || 1;
  const d = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / n;
  return clamp(ambient + (1 - ambient) * Math.max(0, d));
}

/** Brightness of a sphere at (u, v) in [-1, 1]. */
export const sphere = (u: number, v: number, ambient = 0.3) => lit(u, v, Math.sqrt(Math.max(0, 1 - u * u - v * v)), ambient);

/** Brightness across a vertical cylinder at u in [-1, 1]. */
export const cylinder = (u: number, ambient = 0.3) => lit(u, -0.15, Math.sqrt(Math.max(0, 1 - u * u)), ambient);

// ---------------------------------------------------------------- palettes

export const RAMPS = {
  wood: hueRamp("#a0603a", 6),
  darkWood: hueRamp("#6a3e2a", 6, 0.5),
  paleWood: hueRamp("#c8925a", 6, 0.5),
  stone: hueRamp("#8c8aa0", 6),
  warmStone: hueRamp("#b09484", 6),
  cliff: hueRamp("#6a6e8c", 6),
  roofRed: hueRamp("#c85a40", 6),
  roofSlate: hueRamp("#5a6a9a", 6),
  roofBrown: hueRamp("#a06a40", 6),
  roofTeal: hueRamp("#3a8a8a", 6),
  leaf: hueRamp("#4aa040", 7, 0.72),
  grass: hueRamp("#6ab444", 6, 0.6),
  iron: hueRamp("#4e5068", 5, 0.6),
  gold: hueRamp("#e8ac30", 6, 0.62),
  skin: hueRamp("#eea87a", 5, 0.45),
  rope: hueRamp("#caa26a", 5, 0.5),
  burlap: hueRamp("#b8945e", 5, 0.5),
  paving: hueRamp("#b8a68e", 6, 0.42),
  dirt: hueRamp("#a88a64", 5, 0.4),
  plaster: {
    cream: hueRamp("#efdcb8", 5, 0.32),
    pink: hueRamp("#ecc2b8", 5, 0.32),
    blue: hueRamp("#c4d8ec", 5, 0.32),
    mint: hueRamp("#cce6cc", 5, 0.32),
    butter: hueRamp("#f0dca0", 5, 0.32),
  },
  cloth: {
    red: hueRamp("#d8403a", 6),
    cream: hueRamp("#f2e0bc", 6, 0.4),
    purple: hueRamp("#7c48c0", 6),
    gold: hueRamp("#eab440", 6, 0.55),
    green: hueRamp("#34a060", 6),
    blue: hueRamp("#3a6ad8", 6),
    teal: hueRamp("#2aa0a0", 6),
    orange: hueRamp("#ec8030", 6),
  },
} as const;
