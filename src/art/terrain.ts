import { type Canvas, type Color, mix, rng } from "./canvas";
import { clamp, noise, smooth } from "./paint";

// Ground materials in the manner of Sea of Stars, painted per pixel in screen space (the ground is seen from
// above, so one pixel is one step on the ground): sand with a fine grain lattice, woven grass with saw-toothed
// edges, bevelled flagstones and mosaics, cliffs of rounded stone columns, and the sea.

// ---------------------------------------------------------------- palettes

export const SAND = {
  deep: "#8f6e58",
  dark: "#a8876a",
  base: "#bf9e78",
  light: "#c9aa82",
  dot: "#d2b68d",
  pebble: "#e2cba4",
} as const;

export const GRASS = {
  deep: "#34431f",
  dark: "#4d5f2a",
  base: "#627735",
  mid: "#6d833a",
  light: "#809843",
  tip: "#9db04e",
} as const;

export type StonePalette = {
  grout: Color;
  dark: Color;
  base: readonly Color[];
  light: Color;
  high: Color;
  moss: Color;
};

/** Warm sandstone flags. */
export const STONE: StonePalette = {
  grout: "#5e4a4c",
  dark: "#8a7470",
  base: ["#b39c8a", "#bca591", "#a99486", "#b7a08a"],
  light: "#cdb9a2",
  high: "#e0d0b8",
  moss: "#72853e",
};

/** Cool blue-grey stones for inlays. */
export const STONE_COOL: StonePalette = {
  grout: "#4a4458",
  dark: "#6c6a82",
  base: ["#8e8fa6", "#9798ae", "#8688a0"],
  light: "#aeb0c4",
  high: "#c8cad8",
  moss: "#62783e",
};

/** Terracotta tiles for inlays. */
export const STONE_TERRA: StonePalette = {
  grout: "#5a3432",
  dark: "#8a4a3e",
  base: ["#b0644a", "#b86c50", "#a85e46"],
  light: "#cc8662",
  high: "#e0a47c",
  moss: "#72853e",
};

// ---------------------------------------------------------------- masks

/** A boolean mask over the canvas, for regions like lawns and plazas. */
export class Mask {
  readonly data: Uint8Array;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8Array(width * height);
  }
  static of(width: number, height: number, f: (x: number, y: number) => boolean) {
    const m = new Mask(width, height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (f(x, y)) m.data[y * width + x] = 1;
    return m;
  }
  has(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height && this.data[y * this.width + x] === 1;
  }
  set(x: number, y: number, on = true) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.data[y * this.width + x] = on ? 1 : 0;
  }
}

/** Distance (in pixels, chamfer 3-4) from each pixel inside the mask to the nearest pixel outside it. */
export function insideDistance(m: Mask): Float32Array {
  const { width: w, height: h } = m;
  const d = new Float32Array(w * h);
  const big = 1e6;
  for (let i = 0; i < w * h; i++) d[i] = m.data[i] ? big : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]!);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i]!, at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i]!, at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
    }
  for (let i = 0; i < w * h; i++) d[i] = d[i]! / 3;
  return d;
}

// ---------------------------------------------------------------- cells

/**
 * Bevelled cells from an id function (stones, slabs, tiles): 1px grout on the top and left of every cell, a lit
 * rim below the top grout, a shaded rim at the bottom and a lit rim on the right (the sun is up and to the right).
 */
export type CellEdge = "grout" | "corner" | "top" | "bottom" | "right" | "left" | null;
export function cellEdge(x: number, y: number, id: (x: number, y: number) => number): CellEdge {
  const k = id(x, y);
  if (k !== id(x - 1, y) || k !== id(x, y - 1)) return "grout";
  const bottom = k !== id(x, y + 1);
  const right = k !== id(x + 1, y);
  const top = k !== id(x, y - 2);
  const left = k !== id(x - 2, y);
  if ((top || bottom) && (left || right) && (k !== id(x - 1, y - 1) || k !== id(x + 1, y + 1) || k !== id(x - 1, y + 1) || k !== id(x + 1, y - 1)))
    return "corner";
  if (bottom) return "bottom";
  if (top) return "top";
  if (right) return "right";
  if (left) return "left";
  return null;
}

// ---------------------------------------------------------------- sand

/** Sand and packed earth: an even warm base with a faint staggered lattice of grains, as in the game's paths. */
export function sand(x: number, y: number): Color {
  const n = smooth(x, y, 30, 7);
  const base = n > 0.8 ? SAND.light : SAND.base;
  if ((x % 4 === 0 && y % 4 === 0) || (x % 4 === 2 && y % 4 === 2)) return base === SAND.light ? SAND.dot : SAND.light;
  if ((x % 4 === 2 && y % 4 === 0) && noise(x, y, 3) < 0.18) return SAND.dark;
  return base;
}

// ---------------------------------------------------------------- grass

// Leaf clusters: soft rounded blobs with a lit crown and a dark foot, scattered on a jittered grid, low in
// contrast so the lawn stays calm behind the characters.
const LEAVES = [
  [".ml.", "mmmm", ".dd."],
  ["ml.", "mmm", ".dd"],
  [".lm", "mmm", "dd."],
  ["..l.", ".mmm", "mmd.", "dd.."],
  [".l..", "mmm.", ".dmm", "..dd"],
] as const;

/** Leafy grass texture; `shade` in [-1, 1] darkens (shadowed lawn) or lightens (sunlit lawn). */
export function grass(x: number, y: number, shade = 0): Color {
  const t = smooth(x, y, 28, 11) - 0.5 + shade * 0.7;
  // Dim patches only in real shade, with a dithered fringe rather than a hard blotch.
  const dim = t < -0.36 || (t < -0.3 && (x + y) % 2 === 0);
  const base = dim ? GRASS.dark : GRASS.base;
  for (let cy = Math.floor(y / 3) - 1; cy <= Math.floor(y / 3); cy++) {
    for (let cx = Math.floor(x / 4) - 1; cx <= Math.floor(x / 4); cx++) {
      const ax = cx * 4 + Math.floor(noise(cx, cy, 21) * 2) + (cy % 2 === 0 ? 0 : 2);
      const ay = cy * 3 + Math.floor(noise(cx, cy, 22) * 2);
      const shape = LEAVES[Math.floor(noise(cx, cy, 23) * LEAVES.length)]!;
      const key = shape[y - ay]?.[x - ax];
      if (!key || key === ".") continue;
      const bright = t + (noise(cx, cy, 24) - 0.5) * 0.4;
      if (key === "d") return dim ? GRASS.deep : GRASS.dark;
      if (key === "l") return bright > 0.12 ? GRASS.light : dim ? GRASS.base : GRASS.mid;
      return dim ? GRASS.base : GRASS.mid;
    }
  }
  return base;
}

/**
 * Paints a lawn from a mask: leafy grass inside, a darker rim along the inside edge, ragged leaf tips poking out of
 * every edge (dark below, lit above), and a soft drop shadow on the ground under the lower edge.
 */
export function lawn(c: Canvas, m: Mask, shade: (x: number, y: number) => number = () => 0) {
  const { width: w, height: h } = m;
  const extra: [number, number, Color | "shadow"][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!m.has(x, y)) continue;
      const below = !m.has(x, y + 1);
      const above = !m.has(x, y - 1);
      const side = !m.has(x - 1, y) || !m.has(x + 1, y);
      let color = grass(x, y, shade(x, y));
      if (below) color = GRASS.dark;
      else if (!m.has(x, y + 2)) color = mix(color, GRASS.dark, 0.5);
      c.px(x, y, color);
      const n = noise(x, y, 31);
      // Leaf tips: a pointed blade of one to three pixels leaning left or right.
      if (below) {
        if (n < 0.45) {
          const lean = n < 0.22 ? -1 : 1;
          extra.push([x, y + 1, GRASS.dark], [x + lean, y + 2, GRASS.dark]);
          if (n < 0.12) extra.push([x + lean, y + 3, GRASS.deep]);
          extra.push([x, y + 2, "shadow"], [x + lean, y + 3, "shadow"], [x - lean, y + 1, "shadow"]);
        } else extra.push([x, y + 1, "shadow"]);
      }
      if (above && n < 0.4) {
        const lean = n < 0.2 ? -1 : 1;
        extra.push([x, y - 1, GRASS.mid], [x + lean, y - 2, GRASS.light]);
      }
      if (side && !above && !below && n < 0.35) {
        const dir = !m.has(x - 1, y) ? -1 : 1;
        extra.push([x + dir, y, GRASS.base], [x + dir * 2, y - 1, GRASS.mid]);
      }
    }
  }
  for (const [x, y, color] of extra) {
    if (m.has(x, y)) continue;
    const base = c.get(x, y);
    if (!base) continue;
    if (color === "shadow") {
      if (base.startsWith("#") && !Object.values(GRASS).includes(base as never)) c.px(x, y, mix(base, "#3a2c3c", 0.2));
    } else c.px(x, y, color);
  }
}

/**
 * A raised tuft of thick grass: overlapping leaf scales, light on top and dark underneath, drawn back to front,
 * with a toothed rim and a contact shadow.
 */
export function tuft(c: Canvas, cx: number, cy: number, rx: number, ry: number, seed: number) {
  const r = rng(seed);
  const inside = (x: number, y: number) => {
    const u = (x - cx) / rx;
    const v = (y - cy) / ry;
    return u * u + v * v + (noise(x, y, seed) - 0.5) * 0.35 < 1;
  };
  // Shadow under the tuft.
  for (let y = Math.floor(cy - ry); y <= cy + ry + 3; y++) {
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (inside(x, y) || !inside(x + 1, y - 2)) continue;
      const base = c.get(x, y);
      if (base) c.px(x, y, mix(base, "#2a2438", 0.28));
    }
  }
  // Scales in rows, back to front.
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 2) {
    const off = ((y - Math.floor(cy - ry)) / 2) % 2 === 0 ? 0 : 2;
    for (let x = Math.floor(cx - rx) + off; x <= cx + rx; x += 4) {
      if (!inside(x, y)) continue;
      const v = (y - cy) / ry;
      const u = (x - cx) / rx;
      const t = clamp(0.55 - v * 0.45 + u * 0.2 + (r.next() - 0.5) * 0.25);
      const top = t > 0.72 ? GRASS.tip : t > 0.5 ? GRASS.light : t > 0.3 ? GRASS.mid : GRASS.base;
      const under = t > 0.5 ? GRASS.base : GRASS.dark;
      // A leaf scale: a 4px crown, its body, and a dark lower lip.
      for (const [i, j, col] of [
        [1, 0, top],
        [2, 0, top],
        [0, 1, top],
        [1, 1, top],
        [2, 1, under],
        [3, 1, under],
        [0, 2, under],
        [1, 2, GRASS.dark],
        [2, 2, GRASS.dark],
        [3, 2, GRASS.deep],
      ] as const) {
        if (inside(x + i, y + j) || j === 0) c.px(x + i, y + j, col);
      }
    }
  }
}

// ---------------------------------------------------------------- flagstones

type Row = { y0: number; y1: number; cuts: number[] };

/** A flagstone layout: rows of slabs in a running bond, with varied lengths and heights. */
export function flagstones(width: number, height: number, seed: number, { minW = 9, maxW = 17, minH = 6, maxH = 8 } = {}) {
  const r = rng(seed);
  const rows: Row[] = [];
  for (let y = 0; y < height; ) {
    const h = r.int(minH, maxH);
    const cuts: number[] = [];
    for (let x = -r.int(0, maxW); x < width; x += r.int(minW, maxW)) cuts.push(x);
    cuts.push(width + maxW);
    rows.push({ y0: y, y1: y + h, cuts });
    y += h;
  }
  const rowAt = (y: number) => {
    let lo = 0;
    let hi = rows.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (rows[mid]!.y0 <= y) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const id = (x: number, y: number) => {
    if (y < 0) return -1;
    const ri = rowAt(y);
    const cuts = rows[ri]!.cuts;
    let k = 0;
    while (k + 1 < cuts.length && cuts[k + 1]! <= x) k++;
    return ri * 4096 + k;
  };
  return id;
}

/**
 * Irregular flagstones: a jittered grid of seeds, each pixel belonging to its nearest seed (squashed vertically
 * for the top-down view), which gives the chunky polygonal slabs of the game's plazas.
 */
export function slabs(cellW: number, cellH: number, seed: number, squareness = 0.35) {
  const point = (gx: number, gy: number): [number, number] => [
    (gx + 0.2 + noise(gx, gy, seed) * 0.6) * cellW,
    (gy + 0.2 + noise(gx, gy, seed + 1) * 0.6) * cellH,
  ];
  return (x: number, y: number) => {
    const gx = Math.floor(x / cellW);
    const gy = Math.floor(y / cellH);
    let best = Number.POSITIVE_INFINITY;
    let id = 0;
    for (let j = gy - 1; j <= gy + 1; j++) {
      for (let i = gx - 1; i <= gx + 1; i++) {
        const [px, py] = point(i, j);
        const dx = Math.abs(x + 0.5 - px) / cellW;
        const dy = Math.abs(y + 0.5 - py) / cellH;
        // Blend Euclidean and Chebyshev distance: rounder or squarer slabs.
        const d = Math.hypot(dx, dy) * (1 - squareness) + Math.max(dx, dy) * squareness;
        if (d < best) {
          best = d;
          id = (j + 512) * 1024 + (i + 512);
        }
      }
    }
    return id;
  };
}

/** Colors a pixel of a bevelled stone surface given its cell id function. */
export function stoneAt(x: number, y: number, id: (x: number, y: number) => number, seed: number, palette: StonePalette = STONE, wear = 0): Color {
  const k = id(x, y);
  const edge = cellEdge(x, y, id);
  const tone = palette.base[Math.floor(noise(k, 0, seed) * palette.base.length)]!;
  const warm = noise(k, 1, seed);
  let base = warm > 0.88 ? mix(tone, "#c89a84", 0.22) : warm < 0.1 ? mix(tone, "#8a92a8", 0.22) : tone;
  // Worn stones along busy lanes are polished lighter.
  if (wear > 0) base = mix(base, palette.light, Math.min(0.6, wear));
  switch (edge) {
    case "grout":
      return noise(x, y, seed + 5) < 0.06 ? palette.moss : palette.grout;
    case "corner":
      return mix(palette.grout, palette.dark, 0.5);
    case "top":
      return palette.high;
    case "right":
      return palette.light;
    case "bottom":
      return palette.dark;
    case "left":
      return mix(base, palette.dark, 0.35);
    default: {
      // A few weathered pits and a lighter fleck here and there.
      const n = noise(x, y, seed + 9);
      if (n < 0.035) return palette.dark;
      if (n > 0.975) return palette.light;
      return base;
    }
  }
}

/** Radial mosaic slabs around a centre: rings of wedge-shaped stones, as in the game's stone circles. */
export function ringStones(cx: number, cy: number, squash: number, rings: readonly number[], seed: number) {
  return (x: number, y: number) => {
    const dx = x + 0.5 - cx;
    const dy = (y + 0.5 - cy) / squash;
    const d = Math.hypot(dx, dy);
    let ring = 0;
    while (ring < rings.length && d >= rings[ring]!) ring++;
    if (ring === 0) return 0;
    if (ring >= rings.length) return -2;
    const mid = (rings[ring - 1]! + rings[ring]!) / 2;
    const n = Math.max(6, Math.round((2 * Math.PI * mid) / 15));
    const a = (Math.atan2(dy, dx) / (2 * Math.PI) + 1 + noise(ring, 0, seed) / n) % 1;
    return 1 + ring * 256 + Math.floor(a * n);
  };
}

// ---------------------------------------------------------------- cliffs

export const CLIFF = {
  outline: "#43202a",
  deep: "#5f3334",
  dark: "#7b4840",
  base: "#9a6250",
  mid: "#b07860",
  light: "#c99478",
  high: "#dfb394",
  top: "#e9c7a4",
} as const;

/**
 * A cliff face of rounded stone columns hanging from a ground edge, the Sea of Stars signature. Each column is a
 * pile of rounded stone lumps (rounded rectangles of varied width) stacked top to bottom, so every seam shows a
 * dark crack over the lit top rim of the lump below. Lumps are lit from the upper right and darken toward the
 * waterline; each column is capped by the pale top of its highest stone. Columns stand at slightly different
 * depths and overlap. `edge(x)` is the screen y of the cliff top at x; the face is about `height` tall.
 */
export function cliffFace(c: Canvas, x0: number, x1: number, edge: (x: number) => number, height: number, seed: number) {
  const r = rng(seed);
  type Lump = { x: number; y: number; w: number; h: number; cap: boolean };
  type Column = { z: number; lumps: Lump[]; top: number; bottom: number };
  const cols: Column[] = [];
  for (let x = x0 - 6; x < x1 + 6; ) {
    const w = r.int(12, 20);
    const z = r.int(0, 3);
    let top = Number.POSITIVE_INFINITY;
    for (let i = Math.max(x0, x); i < Math.min(x1, x + w); i++) top = Math.min(top, edge(i));
    if (!Number.isFinite(top)) top = edge(Math.min(x1 - 1, Math.max(x0, x)));
    top += z + r.int(-1, 1);
    const bottom = top + height + r.int(-2, 6);
    const lumps: Lump[] = [{ x: x - 1, y: top - 3, w: w + 2, h: 7, cap: true }];
    for (let y = top + 3; y < bottom; ) {
      const h = r.int(7, 12);
      // Sometimes the course splits into two stones side by side.
      if (w > 15 && r.chance(0.3)) {
        const split = r.int(6, w - 6);
        lumps.push({ x: x + r.int(-1, 0), y, w: split + 1, h: h + r.int(-1, 1), cap: false });
        lumps.push({ x: x + split, y: y + r.int(-1, 1), w: w - split + r.int(0, 1), h, cap: false });
      } else lumps.push({ x: x + r.int(-1, 1), y, w: w + r.int(-1, 1), h, cap: false });
      y += h - 1;
    }
    cols.push({ z, lumps, top, bottom });
    x += w - r.int(1, 3);
  }
  cols.sort((a, b) => a.z - b.z);
  const bottom = new Int16Array(x1 - x0).fill(-1);
  for (const col of cols) {
    for (const lump of col.lumps) {
      const { x, y, w, h } = lump;
      const inside = (i: number, j: number) => {
        const u = ((i + 0.5) / w) * 2 - 1;
        const v = ((j + 0.5) / h) * 2 - 1;
        return Math.abs(u) ** 3 + Math.abs(v) ** 3 <= 1;
      };
      for (let j = -1; j <= h; j++) {
        for (let i = -1; i <= w; i++) {
          const px = x + i;
          const py = y + j;
          if (px < x0 || px >= x1) continue;
          const me = inside(i, j);
          const near = inside(i - 1, j) || inside(i + 1, j) || inside(i, j - 1) || inside(i, j + 1);
          if (!me) {
            if (near) c.px(px, py, CLIFF.outline);
            continue;
          }
          bottom[px - x0] = Math.max(bottom[px - x0]!, py + 1);
          const edgePx = !inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1);
          if (edgePx) {
            c.px(px, py, CLIFF.outline);
            continue;
          }
          const u = ((i + 0.5) / w) * 2 - 1;
          const v = ((j + 0.5) / h) * 2 - 1;
          const depth = (py - col.top) / Math.max(1, col.bottom - col.top);
          let color: Color;
          if (lump.cap) {
            const t = 0.8 + u * 0.2 - Math.max(0, v) * 0.6;
            color = t > 0.85 ? CLIFF.top : t > 0.62 ? CLIFF.high : CLIFF.light;
          } else {
            let t = 0.62 + u * 0.22 - v * 0.26 - depth * 0.42;
            if (!inside(i, j - 2)) t += 0.24; // lit top rim
            if (!inside(i, j + 2)) t -= 0.12; // curling under
            if (t > 0.46 && t < 0.58 && (px + py) % 2 === 0) t += 0.1; // a touch of dither
            if (noise(px, py, seed) < 0.03) t -= 0.2; // pits
            color = t > 0.84 ? CLIFF.high : t > 0.66 ? CLIFF.light : t > 0.5 ? CLIFF.mid : t > 0.34 ? CLIFF.base : t > 0.18 ? CLIFF.dark : CLIFF.deep;
          }
          c.px(px, py, color);
        }
      }
    }
  }
  return bottom;
}

/** Foam and a wet shadow where water meets the foot of a cliff; `bottom[x - x0]` is the cliff's lowest y. */
export function surf(c: Canvas, x0: number, bottom: Int16Array, seed: number) {
  for (let i = 0; i < bottom.length; i++) {
    const x = x0 + i;
    const y = bottom[i]!;
    if (y < 0) continue;
    // The cliff's dark reflection in the water.
    for (let j = 0; j < 7; j++) {
      const base = c.get(x, y + j);
      if (base) c.px(x, y + j, mix(base, "#0c2436", 0.55 - j * 0.07));
    }
    // A broken line of foam hugging the rock, with a second ripple further out.
    const n = noise(x, 0, seed);
    if (n < 0.85) c.px(x, y, n < 0.5 ? SEA.foam : SEA.crest);
    if (noise(x, 1, seed) < 0.55) c.px(x, y + 1, SEA.crest);
    if (noise(Math.floor(x / 3), 2, seed) < 0.5) c.px(x, y + 4 + Math.round(noise(x, 3, seed)), SEA.light);
  }
}

// ---------------------------------------------------------------- water and sky

export const SEA = {
  deep: "#174a63",
  base: "#1f6079",
  mid: "#2c7890",
  light: "#4d9aad",
  crest: "#86c6cc",
  foam: "#e6f4ee",
  haze: "#9cc2cf",
  horizon: "#d4e2dc",
} as const;

/**
 * The sea from above: deep teal with lighter wave strokes that shrink and pale with distance (`far` in [0, 1]),
 * and a glitter path under the sun at `sunX`.
 */
export function sea(x: number, y: number, far: number, sunX: number, frame = 0): Color {
  const hazeT = clamp(far * 1.15 - 0.1);
  x += frame * (far > 0.5 ? 1 : 2); // the swell drifts between animation frames
  const body = far > 0.55 ? mix(SEA.mid, SEA.haze, clamp((far - 0.55) / 0.45)) : far > 0.25 ? SEA.base : SEA.deep;
  // Wave strokes: short horizontal dashes on staggered rows; longer and bolder near the viewer.
  const rowGap = far > 0.6 ? 2 : far > 0.3 ? 3 : 4;
  const len = far > 0.6 ? 2 : far > 0.3 ? 4 : 6;
  if (y % rowGap === 0) {
    const cell = Math.floor((x + noise(0, y, 4) * 40) / (len * 3));
    const start = Math.floor(noise(cell, y, 5) * len * 2);
    const local = (x + Math.floor(noise(0, y, 4) * 40)) % (len * 3);
    if (local >= start && local < start + len && noise(cell, y, 6) < 0.7) {
      const glitter = Math.abs(x - sunX) < 12 + far * 30 && noise(x, y, 7 + frame) < 0.5;
      return glitter ? "#fff4d8" : mix(far > 0.5 ? SEA.crest : SEA.light, SEA.horizon, hazeT * 0.6);
    }
  }
  if (Math.abs(x - sunX) < 8 + far * 26 && noise(x, y, 8 + frame) < 0.06 + far * 0.1) return "#f6f0d8";
  return body;
}
