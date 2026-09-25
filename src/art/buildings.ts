import { type Canvas, type Color, mix, rng } from "./canvas";
import { clamp, noise, smooth } from "./paint";

// Town houses seen from high above, as in Sea of Stars: the roof is the biggest thing you see, the front wall
// stands facing the camera beneath it. Roofs of barrel tiles, slates or fish-scale shingles; plastered and
// half-timbered walls; shuttered windows with flower boxes; doors, signs, awnings and chimneys.

export type Ramp = readonly Color[];

export const ROOF = {
  terracotta: ["#4a1f24", "#7a3430", "#a0463a", "#bf5d44", "#d97a54", "#eb9c6c"],
  slate: ["#232640", "#343d5e", "#465680", "#5b70a0", "#7890bc", "#9fb4d6"],
  teal: ["#173236", "#22504f", "#2e6b67", "#3f8a80", "#58a898", "#80c6b0"],
} as const;

export const WALL = {
  cream: ["#7a6150", "#b39c80", "#cdb999", "#e3d4b4", "#f2e8d0"],
  rose: ["#7a5156", "#b88c8a", "#d3a9a2", "#e7c4b8", "#f4ddd0"],
  sky: ["#4c5670", "#8a9cb8", "#a9bcd4", "#c6d6e6", "#e2ecf4"],
  sand: ["#7a6044", "#b99a70", "#d2b68a", "#e4cea4", "#f2e2c0"],
} as const;

export const TIMBER = ["#2c1a1c", "#48292a", "#633a31", "#7e4e3b", "#9a6647"] as const;
export const SHUTTER = {
  teal: ["#173e42", "#23615f", "#2f807a", "#46a092"],
  blue: ["#1e2c52", "#2f4a80", "#4066a4", "#5a88c4"],
  green: ["#1f3a24", "#2f5a34", "#437a44", "#5e9a58"],
  red: ["#4a1a22", "#7a2a30", "#a43e3e", "#c85c52"],
} as const;
const GLASS = ["#18223c", "#253a60", "#3a5e8c", "#6a9cc4", "#c4e2f0"] as const;
const STONE_WALL = ["#4d4150", "#6f6270", "#8d7f88", "#a99ca0", "#c4b8b6"] as const;

// ---------------------------------------------------------------- roofs

/** Terracotta barrel tiles running down the slope: rounded ridges lit on the right, with staggered tile ends. */
export function barrelTiles(c: Canvas, x: number, y: number, w: number, h: number, pal: Ramp, seed: number, inside?: (x: number, y: number) => boolean) {
  const colShade = [1, 2, 3, 4, 5, 3] as const;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = x + i;
      const py = y + j;
      if (inside && !inside(px, py)) continue;
      const col = Math.floor(i / 6);
      const u = i % 6;
      const off = (col * 5 + Math.floor(noise(col, 0, seed) * 3)) % 7;
      const v = (j + off) % 7;
      let k: number = colShade[u]!;
      if (u === 0) k = 0;
      else if (v === 6) k = u === 0 ? 0 : 1; // shadow under the tile above
      else if (v === 5 && u > 0) k = Math.min(5, k + 1); // the rounded tile end catches light
      else if (v === 0 && u > 1) k = Math.max(1, k - 1);
      // Gentle darkening toward the eave and a few mossy tiles.
      const n = noise(col, Math.floor((j + off) / 7), seed + 3);
      if (n < 0.05 && u > 1 && u < 5 && v > 1 && v < 5 && noise(px, py, seed) < 0.6) {
        c.px(px, py, u > 3 ? "#a4a44e" : "#7a8440");
        continue;
      }
      if (n > 0.9 && k > 1) k -= 1;
      c.px(px, py, pal[k]!);
    }
  }
}

/** Overlapping slates in a running bond, lit along the top of each slate. */
export function slates(c: Canvas, x: number, y: number, w: number, h: number, pal: Ramp, seed: number, inside?: (x: number, y: number) => boolean) {
  for (let j = 0; j < h; j++) {
    const row = Math.floor(j / 5);
    const v = j % 5;
    for (let i = 0; i < w; i++) {
      const px = x + i;
      const py = y + j;
      if (inside && !inside(px, py)) continue;
      const shift = row % 2 === 0 ? 0 : 4;
      const slate = Math.floor((i + shift) / 8);
      const u = (i + shift) % 8;
      const tone = noise(slate, row, seed);
      let k = tone > 0.7 ? 3 : tone < 0.25 ? 2 : 3;
      if (v === 4) k = 0;
      else if (v === 3) k = 1;
      else if (v === 0) k = Math.min(5, k + 1);
      if (u === 7 && v < 4) k = 1;
      if (u === 6 && v < 3) k = Math.min(5, k + 1);
      c.px(px, py, pal[k]!);
    }
  }
}

/** Fish-scale shingles: rows of rounded tiles, each lit on its crown with a dark lip underneath. */
export function scales(c: Canvas, x: number, y: number, w: number, h: number, pal: Ramp, seed: number, inside?: (x: number, y: number) => boolean) {
  const SCALE = ["23443", "23432", "12331", "01210", "00000"]; // 5x5 cell: shade index per pixel (0 = gap)
  for (let j = 0; j < h; j++) {
    const row = Math.floor(j / 4);
    const v = j % 4;
    for (let i = 0; i < w; i++) {
      const px = x + i;
      const py = y + j;
      if (inside && !inside(px, py)) continue;
      const shift = row % 2 === 0 ? 0 : 2;
      const u = (i + shift) % 5;
      let k = Number(SCALE[v]![u]);
      if (v === 3 && (u === 0 || u === 4)) k = 0;
      if (noise(Math.floor((i + shift) / 5), row, seed) > 0.85) k = Math.max(0, k - 1);
      c.px(px, py, pal[Math.min(5, k + 1)]!);
    }
  }
}

// ---------------------------------------------------------------- walls

/**
 * Plaster: an even coat with soft weathered patches, a few hairline cracks, and here and there a place where it
 * has flaked away to show the stones underneath.
 */
export function plaster(c: Canvas, x: number, y: number, w: number, h: number, pal: Ramp, seed: number) {
  const r = rng(seed);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = x + i;
      const py = y + j;
      // Weathering: soft darker patches, denser toward the ground, with a dithered fringe.
      const n = smooth(px, py * 1.6, 9, seed) + (j / h) * 0.28;
      const edge = n > 0.68 && n < 0.72;
      const dark = n >= 0.72 || (edge && (px + py) % 2 === 0);
      c.px(px, py, pal[dark ? 2 : 3]!);
    }
  }
  // Hairline cracks.
  for (let k = 0; k < Math.max(1, Math.floor(w / 45)); k++) {
    let cx = x + r.int(4, w - 4);
    let cy = y + r.int(2, Math.max(3, h - 10));
    for (let s = 0; s < r.int(3, 6); s++) {
      c.px(cx, cy, pal[1]!);
      cx += r.pick([-1, 0, 1]);
      cy += 1;
    }
  }
  // Flaked patches showing rounded stones.
  for (let k = 0; k < Math.max(1, Math.floor(w / 50)); k++) {
    const px = x + r.int(3, w - 14);
    const py = y + r.int(Math.floor(h * 0.45), Math.max(Math.floor(h * 0.45) + 1, h - 9));
    const pw = r.int(8, 12);
    const ph = r.int(5, 7);
    for (let j = 0; j < ph; j++) {
      for (let i = 0; i < pw; i++) {
        const u = (i + 0.5) / pw - 0.5;
        const v = (j + 0.5) / ph - 0.5;
        if (u * u * 4 + v * v * 4 + noise(px + i, py + j, seed) * 0.4 > 1.1) continue;
        const stoneRow = Math.floor(j / 3);
        const joint = j % 3 === 2 || (i + stoneRow * 2) % 5 === 4;
        c.px(px + i, py + j, joint ? pal[1]! : (i + stoneRow * 2) % 5 === 0 ? pal[3]! : pal[2]!);
      }
    }
  }
}

/** A stone plinth or ground floor of dressed blocks. */
export function ashlar(c: Canvas, x: number, y: number, w: number, h: number, seed: number, pal: Ramp = STONE_WALL) {
  for (let j = 0; j < h; j++) {
    const row = Math.floor(j / 6);
    const v = j % 6;
    for (let i = 0; i < w; i++) {
      const shift = row % 2 === 0 ? 0 : 7;
      const block = Math.floor((i + shift) / 14);
      const u = (i + shift) % 14;
      const tone = noise(block, row, seed);
      let k = tone > 0.66 ? 3 : 2;
      if (v === 5 || u === 13) k = 0;
      else if (v === 0) k = 4;
      else if (v === 4 || u === 12) k = 1;
      else if (noise(x + i, y + j, seed + 2) < 0.04) k = 1;
      c.px(x + i, y + j, pal[k]!);
    }
  }
}

/** A timber beam (horizontal or vertical) with a lit edge and a grain line. */
export function beam(c: Canvas, x: number, y: number, w: number, h: number) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const horizontal = w > h;
      const a = horizontal ? j : i;
      const size = horizontal ? h : w;
      let k = 2;
      if (a === 0) k = horizontal ? 3 : 1;
      else if (a === size - 1) k = horizontal ? 1 : 3;
      if (noise(x + i, y + j, 77) < 0.08) k = Math.max(1, k - 1);
      c.px(x + i, y + j, TIMBER[k]!);
    }
  }
}

/** A diagonal brace between two points, two pixels thick. */
export function brace(c: Canvas, x0: number, y0: number, x1: number, y1: number) {
  c.line(x0, y0, x1, y1, TIMBER[2]!);
  c.line(x0 + 1, y0, x1 + 1, y1, TIMBER[3]!);
  c.line(x0 - 1, y0, x1 - 1, y1, TIMBER[1]!);
}

// ---------------------------------------------------------------- openings

export type WindowOptions = {
  shutters?: Ramp;
  box?: boolean; // a flower box under the sill
  flowers?: readonly Color[];
  arch?: boolean;
  lit?: boolean; // warm light behind the glass (night)
  curtain?: Color;
  closed?: boolean; // shutters closed over the glass
  cat?: boolean; // a cat sitting on the sill
};

/** A window: deep frame, mullions, glass with a sky reflection, a stone sill, shutters and a flower box. */
export function window(c: Canvas, x: number, y: number, w: number, h: number, seed: number, o: WindowOptions = {}) {
  const r = rng(seed);
  // Shutters, folded open to each side (or closed over the window).
  if (o.shutters && o.closed) {
    for (let j = -1; j <= h; j++) {
      for (let i = -1; i <= w; i++) {
        const edge = i === -1 || j === -1 || i === w || j === h || i === Math.floor(w / 2);
        const slat = j % 3 === 2;
        c.px(x + i, y + j, edge ? o.shutters[0]! : slat ? o.shutters[1]! : i > w / 2 ? o.shutters[3]! : o.shutters[2]!);
      }
    }
    for (let i = -2; i <= w + 1; i++) {
      c.px(x + i, y + h + 1, STONE_WALL[4]!);
      c.px(x + i, y + h + 2, STONE_WALL[2]!);
    }
    return;
  }
  if (o.shutters) {
    const sw = Math.max(3, Math.round(w / 2) - 1);
    for (const [sx, flipped] of [
      [x - sw - 1, false],
      [x + w + 1, true],
    ] as const) {
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < sw; i++) {
          const slat = j % 3 === 2;
          let k = slat ? 1 : 2;
          if ((flipped ? i === sw - 1 : i === 0) || j === 0 || j === h - 1) k = 0;
          if (!slat && (flipped ? i === 0 : i === sw - 1)) k = 3;
          c.px(sx + i, y + j, o.shutters[k]!);
        }
      }
    }
  }
  // Frame.
  for (let j = -1; j <= h; j++) {
    for (let i = -1; i <= w; i++) {
      const edge = i === -1 || j === -1 || i === w || j === h;
      if (o.arch && j < 2 && (i < 1 - j || i > w - 2 + j)) continue;
      if (edge) c.px(x + i, y + j, TIMBER[0]!);
    }
  }
  // Glass with a diagonal reflection band, darker in the top corner where the lintel shades it.
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (o.arch && j < 2 && (i < 2 - j || i > w - 3 + j)) {
        c.px(x + i, y + j, TIMBER[0]!);
        continue;
      }
      let color: Color;
      if (o.lit) color = j < 2 ? "#f6c46a" : (i + j) % 5 === 0 ? "#ffe6a0" : "#f0a850";
      else {
        const band = (i - j + h) % 9;
        color = j === 0 ? GLASS[0] : band === 0 || band === 1 ? GLASS[3] : j < 2 ? GLASS[1] : GLASS[2];
        if (band === 0 && j > 1) color = GLASS[4];
      }
      c.px(x + i, y + j, color);
    }
  }
  if (o.curtain) {
    for (let j = 0; j < h; j++) {
      c.px(x, y + j, o.curtain);
      if (j < h - 2) c.px(x + 1, y + j, mix(o.curtain, "#ffffff", 0.2));
      c.px(x + w - 1, y + j, o.curtain);
    }
  }
  // Mullions.
  const mx = x + Math.floor(w / 2);
  const my = y + Math.floor(h / 2) - 1;
  for (let j = 0; j < h; j++) c.px(mx, y + j, TIMBER[1]!);
  for (let i = 0; i < w; i++) c.px(x + i, my, TIMBER[1]!);
  // Sill.
  for (let i = -2; i <= w + 1; i++) {
    c.px(x + i, y + h + 1, STONE_WALL[4]!);
    c.px(x + i, y + h + 2, STONE_WALL[2]!);
  }
  if (o.cat) {
    // A black cat sitting on the sill, tail hanging down.
    const cx = x + w - 5;
    const CAT = ["o...o", "ooooo", "oyoyo", "ooooo", ".ooooo", ".oooooo", "..ooooo"];
    CAT.forEach((row, j) => [...row].forEach((k, i) => k !== "." && c.px(cx + i, y + h - 6 + j, k === "y" ? "#f4d060" : "#1e1a24")));
    c.vline(cx + 6, y + h + 1, y + h + 4, "#1e1a24");
  }
  // Flower box with blooms spilling over.
  if (o.box) {
    const flowers = o.flowers ?? ["#e24a5a", "#f4a0b0", "#ffd65a"];
    for (let i = -1; i <= w; i++) {
      c.px(x + i, y + h + 3, TIMBER[3]!);
      c.px(x + i, y + h + 4, TIMBER[2]!);
      c.px(x + i, y + h + 5, TIMBER[1]!);
    }
    for (let i = -2; i <= w + 1; i++) {
      const n = noise(x + i, y, seed);
      c.px(x + i, y + h + 2, n < 0.5 ? "#4f7a35" : "#6a9a40");
      if (n > 0.3) c.px(x + i, y + h + 1, n > 0.65 ? "#86b04a" : "#5a8a3a");
      if (r.chance(0.45)) c.px(x + i, y + h + (r.chance(0.5) ? 1 : 0), r.pick(flowers));
      if (r.chance(0.2)) c.px(x + i, y + h + 6, "#4f7a35"); // trailing ivy
    }
  }
}

/** A plank door with iron bands, an arched top, a stone step and a ring handle. */
export function door(c: Canvas, x: number, y: number, w: number, h: number, seed: number, wood: Ramp = TIMBER) {
  const arch = Math.floor(w / 2);
  for (let j = -2; j < h; j++) {
    for (let i = -2; i < w + 2; i++) {
      // Stone surround.
      const inArch = (ii: number, jj: number) => {
        if (jj >= arch) return ii >= 0 && ii < w;
        const dx = (ii + 0.5 - w / 2) / (w / 2);
        const dy = (arch - jj - 0.5) / arch;
        return dx * dx + dy * dy <= 1;
      };
      if (inArch(i, j)) {
        const plank = Math.floor(i / 3);
        const u = i % 3;
        let k = 2 + (noise(plank, 0, seed) > 0.5 ? 1 : 0);
        if (u === 2) k = 1;
        if (j === Math.floor(h * 0.3) || j === Math.floor(h * 0.75)) k = 0; // iron bands
        if (j >= h - 2) k = Math.max(0, k - 1);
        c.px(x + i, y + j, k === 0 ? "#3a3440" : wood[k]!);
      } else if (inArch(i - 1, j) || inArch(i + 1, j) || inArch(i, j + 1) || inArch(i - 2, j) || inArch(i + 2, j) || inArch(i, j + 2)) {
        c.px(x + i, y + j, (i + j) % 4 === 0 ? STONE_WALL[2]! : STONE_WALL[3]!);
      }
    }
  }
  // Handle.
  c.px(x + w - 3, y + Math.floor(h * 0.55), "#e0b84a");
  c.px(x + w - 3, y + Math.floor(h * 0.55) + 1, "#8a6a2a");
  // Step.
  for (let i = -3; i < w + 3; i++) {
    c.px(x + i, y + h, STONE_WALL[4]!);
    c.px(x + i, y + h + 1, STONE_WALL[3]!);
    c.px(x + i, y + h + 2, STONE_WALL[1]!);
  }
}

/** A striped cloth awning seen from above: its sloping top, then a scalloped valance. */
export function awning(c: Canvas, x: number, y: number, w: number, depth: number, stripes: readonly [Ramp, Ramp]) {
  for (let j = 0; j < depth; j++) {
    for (let i = 0; i < w; i++) {
      const stripe = Math.floor((i + 2) / 6) % 2;
      const pal = stripes[stripe]!;
      const t = j / depth; // lighter toward the front edge, which faces the sky more
      let k = t > 0.6 ? 3 : t > 0.25 ? 2 : 1;
      if ((i + 2) % 6 === 0) k = Math.max(0, k - 1);
      c.px(x + i, y + j, pal[k]!);
    }
  }
  // Valance with rounded scallops.
  for (let i = 0; i < w; i++) {
    const stripe = Math.floor((i + 2) / 6) % 2;
    const pal = stripes[stripe]!;
    const s = i % 6;
    const drop = s === 0 || s === 5 ? 2 : 4;
    for (let j = 0; j < drop; j++) c.px(x + i, y + depth + j, j === drop - 1 ? pal[0]! : pal[j === 0 ? 3 : 2]!);
  }
}

/** A chimney of stone with a cap and a dark flue seen from above. */
export function chimney(c: Canvas, x: number, y: number, w: number, h: number) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const row = Math.floor(j / 3);
      const u = (i + (row % 2) * 2) % 4;
      let k = i === w - 1 ? 3 : i === 0 ? 1 : 2;
      if (j % 3 === 2 || u === 3) k = Math.max(0, k - 1);
      c.px(x + i, y + j, STONE_WALL[k]!);
    }
  }
  // Cap and flue.
  for (let i = -1; i <= w; i++) {
    c.px(x + i, y - 1, STONE_WALL[4]!);
    c.px(x + i, y, STONE_WALL[3]!);
  }
  for (let i = 0; i < w; i++) c.px(x + i, y - 3, STONE_WALL[3]!);
  for (let i = 1; i < w - 1; i++) c.px(x + i, y - 2, "#241c24");
  // Soot staining down from the flue.
  for (let j = 1; j < 4; j++) for (let i = 0; i < w; i++) if (noise(x + i, y + j, 9) < 0.5 - j * 0.12) c.px(x + i, y + j, STONE_WALL[1]!);
  c.px(x - 1, y - 2, STONE_WALL[4]!);
  c.px(x + w, y - 2, STONE_WALL[2]!);
}

/** A hanging shop sign on a wrought-iron bracket; `icon` paints the board's emblem. */
export function hangingSign(c: Canvas, x: number, y: number, w: number, h: number, icon: (c: Canvas, x: number, y: number) => void) {
  const iron = "#2a2632";
  c.hline(x - 2, x + w + 1, y, iron);
  c.px(x - 2, y + 1, iron);
  c.px(x - 1, y - 1, iron);
  c.px(x + 2, y + 1, iron);
  c.px(x + w - 3, y + 1, iron);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      c.px(x + i, y + 2 + j, edge ? TIMBER[1]! : j === 1 ? TIMBER[4]! : j === h - 2 ? TIMBER[2]! : TIMBER[3]!);
    }
  }
  icon(c, x + 2, y + 4);
}

/** A little wall lantern: an iron cage with a glass pane. Returns where its light sits. */
export function wallLantern(c: Canvas, x: number, y: number): { x: number; y: number } {
  const iron = "#2c2834";
  c.hline(x - 3, x, y, iron);
  c.px(x, y + 1, iron);
  for (let j = 0; j < 7; j++) {
    for (let i = -2; i <= 2; i++) {
      const edge = Math.abs(i) === 2 || j === 0 || j === 6;
      c.px(x + i, y + 2 + j, edge ? iron : j < 3 ? "#f8e2a0" : "#e8b060");
    }
  }
  c.hline(x - 1, x + 1, y + 1, iron);
  return { x, y: y + 5 };
}

export const roofShade = (t: number) => clamp(t);
