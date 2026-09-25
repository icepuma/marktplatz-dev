import { type Canvas, type Color, mix, rng } from "./canvas";
import { clamp, noise } from "./paint";

// Props for the square, drawn in the game's steep top-down view: you see the top of everything (lids, rims,
// table tops) and the side that faces you. Shading follows the one sun, up and to the right.

export type Ramp = readonly Color[];

export const WOOD = ["#2f1c20", "#4e2e28", "#6e4232", "#8e5a3e", "#ae7650", "#c99466"] as const;
export const PALE_WOOD = ["#4a3228", "#7a5638", "#a07448", "#bf935e", "#d6ae78", "#e8c890"] as const;
export const IRON = ["#1e1c26", "#34303e", "#4c4858", "#6c6878", "#928ea0"] as const;
export const BURLAP = ["#4c3a2c", "#7a6046", "#a08262", "#c0a47e", "#dcc49c"] as const;
export const CLAY = ["#4a2226", "#7a3a30", "#a2543e", "#c2704e", "#dc9068", "#eeb088"] as const;
export const STONE = ["#3e3644", "#5e5462", "#7e737e", "#9c9198", "#bab0b0", "#d4ccc4"] as const;
export const WATER = ["#163e56", "#1e5a74", "#2c7890", "#4c9cb0", "#86c6d0", "#c8ecec", "#f6fffc"] as const;
export const GOLD = ["#5a3a1a", "#946224", "#c89232", "#eab848", "#f8dc7a", "#fff4c0"] as const;

const shadeAcross = (u: number, n = 4) => Math.max(0, Math.min(n, Math.round((0.45 + u * 0.4) * n)));

// ---------------------------------------------------------------- containers

/** A barrel: bulging staves lit from the right, two iron hoops, and its lid seen from above. */
export function barrel(c: Canvas, x: number, gy: number, w = 12, h = 14, fill?: (c: Canvas, cx: number, cy: number, rx: number, ry: number) => void) {
  const rx = w / 2;
  const cx = x + rx;
  const ry = Math.max(2.5, w * 0.28);
  const top = gy - h;
  for (let y = top; y <= gy; y++) {
    const t = (y - top) / h;
    const bulge = Math.sin(t * Math.PI) * 1.2;
    const half = rx + bulge;
    const sag = ry * Math.sqrt(1);
    for (let xx = Math.floor(cx - half); xx <= cx + half; xx++) {
      const u = (xx + 0.5 - cx) / half;
      if (Math.abs(u) > 1) continue;
      const bottomCurve = gy - ry * 0.5 + Math.sqrt(Math.max(0, 1 - u * u)) * ry * 0.5;
      if (y > bottomCurve) continue;
      const hoop = Math.abs(t - 0.22) < 0.07 || Math.abs(t - 0.78) < 0.07;
      const stave = Math.round((xx - cx) / 3) * 3 === Math.round(xx - cx) && Math.abs(u) < 0.9;
      let k = shadeAcross(u, 5);
      if (stave) k = Math.max(0, k - 1);
      if (hoop) c.px(xx, y, IRON[Math.min(4, Math.max(0, k - 1))]!);
      else c.px(xx, y, WOOD[k]!);
      void sag;
    }
  }
  // Lid.
  c.ellipse(cx, top, rx, ry, (_, yy, u, v) => {
    const rim = u * u + v * v > 0.62;
    if (rim) return v < 0 ? WOOD[5]! : WOOD[3]!;
    return (yy - Math.round(top)) % 3 === 0 ? WOOD[2]! : u > 0.2 ? WOOD[4]! : WOOD[3]!;
  });
  if (fill) fill(c, cx, top, rx - 1.5, ry - 1);
}

/** A wooden crate: lit top planks, a front face with a diagonal brace, nail heads. */
export function crate(c: Canvas, x: number, gy: number, w = 14, h = 10, d = 7, wood: Ramp = PALE_WOOD) {
  const top = gy - h;
  // Top face.
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < w; i++) {
      let k = j % 3 === 2 ? 2 : 4;
      if (i === w - 1) k = 5;
      c.px(x + i, top - d + j, wood[k]!);
    }
  }
  // Front face.
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const frame = i < 2 || i > w - 3 || j < 2 || j > h - 3;
      let k = frame ? 3 : j % 3 === 2 ? 1 : 2;
      if (!frame && Math.abs(i - 2 - (j - 2) * ((w - 4) / Math.max(1, h - 4))) < 1.2) k = 3; // brace
      if (i === w - 1) k = Math.min(5, k + 1);
      c.px(x + i, top + j, wood[k]!);
    }
  }
  for (const [i, j] of [
    [1, 1],
    [w - 2, 1],
    [1, h - 2],
    [w - 2, h - 2],
  ] as const)
    c.px(x + i, top + j, IRON[1]!);
}

/** A burlap sack, tied at the neck, slumped a little to one side. */
export function sack(c: Canvas, cx: number, gy: number, w = 11, h = 12, grain?: Color) {
  const rx = w / 2;
  for (let y = gy - h; y <= gy; y++) {
    const t = (y - (gy - h)) / h;
    const half = t < 0.25 ? rx * 0.45 + t * 2 : rx * Math.sin(Math.min(1, (t - 0.1) * 1.35) * Math.PI * 0.62 + 0.55);
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const u = (x + 0.5 - cx) / Math.max(1, half);
      let k = shadeAcross(u, 4);
      if (t > 0.88) k = Math.max(0, k - 1);
      if ((x + y) % 4 === 0) k = Math.max(0, k - 1); // weave
      c.px(x, y, BURLAP[k]!);
    }
  }
  // Tie and an open mouth with grain.
  c.hline(Math.round(cx - 2), Math.round(cx + 2), gy - h + 3, "#5a3a26");
  if (grain) c.ellipse(cx, gy - h, rx * 0.55, 1.6, grain);
}

/** A clay pot or amphora: dark mouth, round lit belly. */
export function pot(c: Canvas, cx: number, gy: number, r = 5, h = 10, clay: Ramp = CLAY) {
  const top = gy - h;
  for (let y = top; y <= gy; y++) {
    const t = (y - top) / h;
    const half = t < 0.18 ? r * 0.62 : r * Math.sin(0.35 + t * 2.4) * (t > 0.9 ? 0.85 : 1);
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const u = (x + 0.5 - cx) / Math.max(1, half);
      const v = t * 2 - 1;
      c.px(x, y, clay[Math.max(0, Math.min(5, Math.round(2.6 + u * 1.6 - v * 0.9)))]!);
    }
  }
  c.ellipse(cx, top, r * 0.62, 1.4, (_, __, u, v) => (v < 0 && u * u + v * v > 0.4 ? clay[5]! : "#2a1418"));
  c.hline(Math.round(cx - r * 0.5), Math.round(cx + r * 0.5), Math.round(top + h * 0.3), clay[1]!); // painted band
}

/** A woven basket with something in it. */
export function basket(c: Canvas, cx: number, gy: number, w = 14, h = 6, contents?: (c: Canvas, cx: number, cy: number, rx: number) => void) {
  const rx = w / 2;
  const top = gy - h;
  if (contents) contents(c, cx, top, rx - 1);
  for (let y = top; y <= gy; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const u = (x + 0.5 - cx) / rx;
      if (y > gy - 1 && Math.abs(u) > 0.8) continue;
      const weave = (x + (y % 2) * 2) % 4 < 2;
      let k = shadeAcross(u, 3) + (weave ? 1 : 0);
      if (y === top) k = 4;
      c.px(x, y, PALE_WOOD[Math.min(5, k)]!);
    }
  }
}

/** A heap of round fruit (apples, oranges, plums) with highlights, piled in rows. */
export function fruitPile(colors: Ramp) {
  return (c: Canvas, cx: number, cy: number, rx: number) => {
    const r = rng(Math.round(cx * 7 + cy));
    for (let row = 0; row < 3; row++) {
      const y = cy - row * 2;
      const span = rx - row * 2;
      for (let x = cx - span; x <= cx + span; x += 3) {
        const fx = Math.round(x + r.int(0, 1));
        c.px(fx, y, colors[2]!);
        c.px(fx + 1, y, colors[1]!);
        c.px(fx, y - 1, colors[3]!);
        c.px(fx + 1, y - 1, colors[2]!);
        c.px(fx - 1, y, colors[1]!);
        if (r.chance(0.5)) c.px(fx, y - 1, colors[4]!);
      }
    }
  };
}

export const APPLES = ["#4a1418", "#8a2226", "#c43a34", "#e8664e", "#ffc0a0"] as const;
export const ORANGES = ["#5a2a10", "#a4501a", "#e08028", "#f8a840", "#ffe0a0"] as const;
export const PLUMS = ["#241230", "#4a2260", "#6e3a8a", "#9a5ab8", "#d0a0e8"] as const;
export const GREENS = ["#1e3a1e", "#3a6a2a", "#5a9a3a", "#86c24a", "#c4e88a"] as const;

// ---------------------------------------------------------------- lights and fixtures

/**
 * A street lamp in the game's manner: a stout iron post on a stone foot, a scrolled bracket, and a lantern hanging
 * from it with a pyramid cap and a glowing belly. Returns where the flame is.
 */
export function lampPost(c: Canvas, x: number, gy: number, h = 46, night = false): { x: number; y: number } {
  // Stone foot.
  for (let j = 0; j < 6; j++) {
    const half = j < 2 ? 5 : 4;
    for (let i = -half; i <= half; i++) {
      let k = i > 1 ? 4 : i > -2 ? 3 : 2;
      if (j === 5) k = 5;
      if (j === 0) k = 1;
      c.px(x + i, gy - j, STONE[k]!);
    }
  }
  // Post: three pixels wide, lit on the right, with collars.
  for (let y = gy - h; y < gy - 5; y++) {
    c.px(x - 1, y, IRON[1]!);
    c.px(x, y, IRON[2]!);
    c.px(x + 1, y, IRON[3]!);
  }
  for (const cy of [gy - 9, gy - h + 6]) {
    c.hline(x - 2, x + 2, cy, IRON[3]!);
    c.hline(x - 2, x + 2, cy + 1, IRON[1]!);
  }
  // Finial and a scrolled bracket reaching right.
  c.rect(x - 1, gy - h - 3, 3, 3, IRON[2]!);
  c.px(x + 1, gy - h - 3, IRON[4]!);
  const top = gy - h + 2;
  for (let i = 1; i <= 8; i++) c.px(x + 1 + i, top, IRON[i > 6 ? 3 : 2]!);
  c.px(x + 2, top + 1, IRON[2]!);
  c.px(x + 3, top + 2, IRON[2]!);
  c.px(x + 4, top + 2, IRON[3]!);
  c.px(x + 5, top + 1, IRON[2]!);
  // The lantern hangs from the bracket's end.
  const lx = x + 9;
  const ly = top + 2;
  c.px(lx, top + 1, IRON[1]!);
  for (let j = 0; j < 3; j++) c.hline(lx - 1 - j, lx + 1 + j, ly + j, j === 2 ? IRON[1]! : j === 0 ? IRON[4]! : IRON[3]!);
  for (let j = 3; j < 10; j++) {
    for (let i = -3; i <= 3; i++) {
      const frame = Math.abs(i) === 3 || i === 0 && j === 6;
      const glass = night ? (j < 6 ? "#fff4c8" : "#ffc864") : i > 0 ? "#cfe6f2" : j < 5 ? "#a8c8dc" : "#86a8c4";
      c.px(lx + i, ly + j, frame ? IRON[1]! : glass);
    }
  }
  c.hline(lx - 3, lx + 3, ly + 10, IRON[2]!);
  c.hline(lx - 1, lx + 1, ly + 11, IRON[1]!);
  if (!night) c.px(lx + 2, ly + 4, "#ffffff"); // a glint on the glass
  return { x: lx, y: ly + 6 };
}

/** The wooden railing along the edge of the square: log posts with ringed tops, two rails, a sagging rope. */
export function railing(c: Canvas, x0: number, x1: number, gy: number, seed: number) {
  const r = rng(seed);
  const posts: number[] = [];
  for (let x = x0 + 4; x < x1; x += r.int(26, 32)) posts.push(x);
  // Rails, behind the posts.
  for (const [hgt, thick] of [
    [15, 3],
    [8, 2],
  ] as const) {
    for (let x = x0; x < x1; x++) {
      for (let j = 0; j < thick; j++) c.px(x, gy - hgt + j, WOOD[j === 0 ? 4 : j === thick - 1 ? 2 : 3]!);
    }
  }
  // Rope swags between posts.
  for (let k = 0; k + 1 < posts.length; k++) {
    const a = posts[k]!;
    const b = posts[k + 1]!;
    for (let x = a; x <= b; x++) {
      const t = (x - a) / (b - a);
      const y = Math.round(gy - 18 + Math.sin(t * Math.PI) * 4);
      c.px(x, y, (x & 1) === 0 ? "#c8a878" : "#8a6a48");
    }
  }
  for (const px of posts) {
    for (let y = gy - 20; y <= gy; y++) {
      for (let i = -2; i <= 2; i++) c.px(px + i, y, WOOD[[1, 2, 3, 4, 3][i + 2]!]!);
    }
    c.ellipse(px, gy - 21, 2.5, 1.4, (_, __, u, v) => (u * u + v * v < 0.35 ? PALE_WOOD[3]! : PALE_WOOD[5]!));
    c.px(px, gy - 21, PALE_WOOD[2]!);
    // Rope lashing.
    for (let j = 0; j < 3; j++) c.hline(px - 2, px + 2, gy - 17 + j, j === 1 ? "#8a6a48" : "#c8a878");
  }
}

/** A plank bench seen from above: seat boards on two stout legs. */
export function bench(c: Canvas, x: number, gy: number, w = 26) {
  for (let i = 0; i < w; i++) {
    c.px(x + i, gy - 9, PALE_WOOD[5]!);
    c.px(x + i, gy - 8, PALE_WOOD[4]!);
    c.px(x + i, gy - 7, (i & 7) === 7 ? PALE_WOOD[2]! : PALE_WOOD[4]!);
    c.px(x + i, gy - 6, PALE_WOOD[2]!);
  }
  for (const lx of [x + 2, x + w - 4]) for (let j = -5; j <= 0; j++) c.rect(lx, gy + j, 2, 1, j === 0 ? WOOD[1]! : WOOD[2]!);
}

// ---------------------------------------------------------------- the fountain

/**
 * The fountain, the square's centrepiece: a round stone basin seen from above (a dressed rim, the inner wall, water
 * with ripple rings and a bright sky reflection), a carved pedestal rising from the water to a flared upper bowl,
 * a golden sun on top. Jets arc from the sun into the bowl, which spills over its lip in thin curtains that foam
 * where they land. `frame` (0-3) moves the water.
 */
export function fountain(c: Canvas, cx: number, cy: number, rx: number, ry: number, seed: number, frame = 0) {
  const r = rng(seed + frame * 101);
  const wallH = 7;
  // Outer wall of the basin (the part that faces us), below the rim: dressed blocks.
  for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const u = (x + 0.5 - cx) / rx;
    const yRim = cy + Math.sqrt(Math.max(0, 1 - u * u)) * ry;
    for (let y = Math.floor(yRim); y <= yRim + wallH; y++) {
      const seam = (x - cx + 200) % 8 === 0;
      let k = shadeAcross(u, 5);
      if (seam) k = Math.max(0, k - 2);
      if (y > yRim + wallH - 1) k = 0;
      else if (y > yRim + wallH - 3) k = Math.max(0, k - 1);
      c.px(x, y, STONE[Math.min(5, k)]!);
    }
  }
  // Rim top: a ring of dressed stones with a moulded edge.
  c.ellipse(cx, cy, rx, ry, (_, __, u, v) => {
    const d = u * u + v * v;
    if (d < 0.68) return null;
    const a = Math.atan2(v, u);
    const seam = Math.abs(((a / (Math.PI * 2)) * 24 + 24) % 1) < 0.07;
    const lit = v < -0.2 ? 5 : u > 0.3 ? 4 : v > 0.5 ? 2 : 3;
    if (seam) return STONE[1]!;
    return d > 0.94 ? STONE[Math.max(1, lit - 2)]! : d < 0.74 ? STONE[Math.max(1, lit - 1)]! : STONE[lit]!;
  });
  // Inner wall (visible at the back) and the water.
  const irx = rx * 0.83;
  const iry = ry * 0.8;
  const px0 = cx;
  const py0 = cy + 1;
  c.ellipse(cx, cy, irx, iry, (x, y, u, v) => {
    const d = u * u + v * v;
    if (v < 0 && d > 0.55) return d > 0.82 ? STONE[1]! : STONE[2]!; // the inner wall, in shade
    // Water: ripple rings travelling out from the pedestal, the sky's reflection at the back, glints.
    const ring = Math.hypot((x - px0) / irx, ((y - py0) / iry) * 1.1);
    const phase = (ring * 7 - frame * 0.25 + 8) % 1;
    const ripple = ring > 0.28 && Math.abs(phase - 0.5) < 0.08;
    let k = v < -0.35 ? 3 : v < 0.25 ? 2 : 3;
    if (v < -0.2 && v > -0.45 && Math.abs(u) < 0.6) k = 4; // sky reflection
    if (ripple) k += 1;
    if (d > 0.9) k = Math.max(1, k - 1); // shade under the rim
    if (noise(x, y, seed + 1 + frame) < 0.018) k = 6;
    return WATER[Math.min(6, k)]!;
  });
  // Pedestal: a round plinth in the water, a column with a carved band, then the upper bowl.
  c.ellipse(cx, cy + 1, 9, 3.5, (_, __, u, v) => STONE[v < -0.3 ? 5 : u > 0.2 ? 4 : 3]!);
  const colTop = cy - 18;
  for (let y = colTop; y <= cy; y++) {
    const half = y > cy - 4 ? 5 : y < colTop + 3 ? 4 : 3;
    for (let i = -half - 1; i <= half + 1; i++) {
      if (Math.abs(i) === half + 1) {
        c.px(cx + i, y, "#2a2436"); // outline the column against the water
        continue;
      }
      let k = shadeAcross(i / half, 5);
      if (y === cy - 9 || y === cy - 8) k = Math.min(5, k + 1); // carved band
      if (y === cy - 7) k = Math.max(0, k - 2);
      c.px(cx + i, y, STONE[k]!);
    }
  }
  // Splash ring where the curtains hit the basin water around the plinth.
  c.ellipse(cx, cy + 2, 13, 4, (x, y, u, v) => {
    const d = u * u + v * v;
    if (d < 0.55) return null;
    return noise(x + frame * 3, y, seed + 9) < 0.55 ? WATER[6]! : WATER[5]!;
  });
  // Upper bowl: flared, with a lit lip and water inside.
  const by = colTop - 3;
  for (let x = Math.floor(cx - 15); x <= cx + 15; x++) {
    const u = (x + 0.5 - cx) / 15;
    const depth = 3 + Math.sqrt(Math.max(0, 1 - u * u)) * 5;
    for (let y = by; y <= by + depth + 1; y++) {
      const edge = y > by + depth || Math.abs(u) > 0.94;
      c.px(x, y, edge ? "#2a2436" : STONE[Math.max(1, shadeAcross(u, 5) - (y > by + depth - 2 ? 1 : 0))]!);
    }
  }
  c.ellipse(cx, by, 15, 4.5, (_, __, u, v) => {
    const d = u * u + v * v;
    if (d > 0.9) return "#2a2436";
    if (d > 0.58) return STONE[v < 0 ? 5 : 4]!;
    return WATER[v < -0.25 ? 5 : u > 0.25 ? 4 : 3]!;
  });
  // The golden sun on its stem.
  c.rect(cx - 1, by - 7, 3, 7, STONE[3]!);
  c.px(cx + 1, by - 7, STONE[5]!);
  c.px(cx - 2, by - 3, "#2a2436");
  c.px(cx + 2, by - 3, "#2a2436");
  const sy = by - 12;
  // Rays: short gold spikes all round, lit on the upper right.
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    for (let t = 5; t <= 7; t++) {
      const x = Math.round(cx + Math.cos(a) * t);
      const y = Math.round(sy + Math.sin(a) * t * 0.9);
      c.px(x, y, t === 7 ? GOLD[2]! : Math.cos(a) - Math.sin(a) > 0 ? GOLD[4]! : GOLD[3]!);
    }
  }
  c.ellipse(cx, sy, 4.5, 4.5, (_, __, u, v) => (u * u + v * v > 0.8 ? GOLD[1]! : GOLD[u - v > 0.6 ? 5 : u - v > -0.2 ? 4 : 3]!));
  c.px(cx + 2, sy - 2, "#ffffff");
  // Jets arcing from the sun down into the bowl.
  for (const dir of [-1, 1]) {
    for (let s = 0; s <= 10; s++) {
      const t = s / 10;
      const x = Math.round(cx + dir * (3 + t * 9));
      const y = Math.round(sy - 2 - Math.sin(t * Math.PI) * 6 + t * 10);
      c.px(x, y, WATER[(s + frame) % 3 === 0 ? 6 : 5]!);
    }
  }
  // Curtains spilling over the bowl's lip into the basin.
  for (const dx of [-13, -8, 8, 13]) {
    for (let y = by + 3; y < cy + 1; y++) {
      const x = cx + dx + (y > cy - 4 ? Math.sign(dx) : 0);
      c.px(x, y, WATER[(y + frame) % 4 === 0 ? 6 : 5]!);
      if ((y + frame * 2) % 5 === 0) c.px(x + Math.sign(dx), y, WATER[4]!);
    }
  }
  // Droplets and foam where the water lands.
  const sparkles: [number, number][] = [];
  for (let k = 0; k < 12; k++) {
    const x = cx + r.int(-16, 16);
    const y = cy + r.int(-1, 4);
    if (Math.abs(x - cx) < 5) continue;
    c.px(x, y, WATER[r.chance(0.5) ? 6 : 5]!);
    sparkles.push([x, y]);
  }
  return sparkles;
}

export const tone = (color: Color, t: number) => mix(color, "#000000", clamp(t));

// ---------------------------------------------------------------- square furniture

/** The notice board, a little roofed board on two posts with papers pinned to it. */
export function noticeBoard(c: Canvas, x: number, gy: number, seed: number) {
  const r = rng(seed);
  const w = 26;
  for (const px of [x + 2, x + w - 5]) for (let y = gy - 30; y <= gy; y++) for (let i = 0; i < 3; i++) c.px(px + i, y, WOOD[[2, 4, 3][i]!]!);
  // Board and frame.
  for (let y = gy - 26; y < gy - 10; y++) {
    for (let i = 0; i < w; i++) {
      const frame = i < 2 || i > w - 3 || y < gy - 24 || y > gy - 13;
      c.px(x + i, y, frame ? WOOD[frame && (i === w - 1 || y === gy - 26) ? 4 : 2]! : (i + y) % 7 === 0 ? PALE_WOOD[2]! : PALE_WOOD[3]!);
    }
  }
  // Papers with scribbles and red pins.
  for (let k = 0; k < 4; k++) {
    const px = x + 3 + k * 5 + r.int(0, 1);
    const py = gy - 24 + r.int(0, 3);
    const h = r.int(6, 8);
    for (let j = 0; j < h; j++) for (let i = 0; i < 4; i++) c.px(px + i, py + j, j === 0 ? "#fffaf0" : i === 3 ? "#d8ccb0" : "#f2e8d0");
    for (let j = 2; j < h - 1; j += 2) c.hline(px + 1, px + 2 - (j % 4 === 0 ? 1 : 0), py + j, "#8a8070");
    c.px(px + 1, py, r.pick(["#d83a3a", "#3a6ad8", "#e8b83a"]));
  }
  // A little roof of two planks.
  for (let i = -2; i < w + 2; i++) {
    c.px(x + i, gy - 30, WOOD[4]!);
    c.px(x + i, gy - 29, WOOD[3]!);
    c.px(x + i, gy - 28, WOOD[1]!);
  }
}

/** A round tavern table with two stools and mugs of ale. */
export function tavernTable(c: Canvas, cx: number, gy: number) {
  for (const sx of [cx - 13, cx + 10]) {
    for (let j = 0; j < 5; j++) c.hline(sx, sx + 2, gy - j, WOOD[j === 4 ? 4 : 2]!);
    c.ellipse(sx + 1, gy - 6, 3, 1.5, (_, __, _u, v) => (v < 0 ? PALE_WOOD[5]! : PALE_WOOD[3]!));
  }
  c.rect(cx - 1, gy - 9, 3, 9, WOOD[2]!);
  c.px(cx + 1, gy - 9, WOOD[4]!);
  c.hline(cx - 4, cx + 4, gy, WOOD[1]!);
  c.ellipse(cx, gy - 11, 9, 3.5, (x, y, u, v) => (u * u + v * v > 0.75 ? (v < 0 ? PALE_WOOD[5]! : PALE_WOOD[2]!) : (x + y) % 5 === 0 ? PALE_WOOD[3]! : PALE_WOOD[4]!));
  for (const [mx, my] of [
    [cx - 4, gy - 12],
    [cx + 3, gy - 11],
  ] as const) {
    c.rect(mx, my - 3, 3, 3, "#c89a4a");
    c.px(mx + 2, my - 3, "#f0c870");
    c.hline(mx, mx + 2, my - 4, "#fff6e0");
    c.px(mx + 3, my - 2, "#8a6a3a");
  }
}

/** A two-wheeled handcart heaped with pumpkins. */
export function handcart(c: Canvas, x: number, gy: number) {
  // Handles.
  c.line(x - 10, gy - 6, x, gy - 9, WOOD[3]!);
  c.line(x - 10, gy - 5, x, gy - 8, WOOD[1]!);
  // Load: pumpkins piled in the bed.
  const pumpkin = ["#5a2410", "#a4501a", "#d8742a", "#f49a44", "#ffc47a"];
  for (const [px, py, r] of [
    [x + 6, gy - 16, 4],
    [x + 14, gy - 16, 4.5],
    [x + 22, gy - 15, 4],
    [x + 10, gy - 20, 4],
    [x + 18, gy - 20, 3.5],
  ] as const) {
    c.ellipse(px, py, r, r * 0.8, (_, __, u, v) => {
      const rib = Math.abs(((u + 1) * 2.5) % 1 - 0.5) < 0.12;
      const k = Math.max(0, Math.min(4, Math.round(2.2 + u * 1.4 - v * 1.2 - (rib ? 1 : 0))));
      return pumpkin[k]!;
    });
    c.px(px, py - r * 0.8 - 1, "#4a7a2a");
  }
  // Bed: a plank box, top rim lit.
  for (let y = gy - 13; y <= gy - 5; y++) {
    for (let i = 0; i < 28; i++) {
      let k = (y - (gy - 13)) % 3 === 2 ? 1 : 3;
      if (y === gy - 13) k = 5;
      if (i === 27) k = 4;
      c.px(x + i, y, PALE_WOOD[k]!);
    }
  }
  // The wheel facing us: rim, spokes, hub.
  const wx = x + 18;
  const wy = gy - 6;
  c.ellipse(wx, wy, 6, 6, (_, __, u, v) => {
    const d = u * u + v * v;
    if (d > 0.62) return u + v < 0 ? WOOD[4]! : WOOD[1]!;
    const a = Math.atan2(v, u);
    const spoke = Math.abs(((a / Math.PI) * 3 + 6) % 1 - 0.5) > 0.38;
    if (d < 0.08) return IRON[3]!;
    return spoke ? WOOD[3]! : null;
  });
}

/** A planter box of flowers. */
export function planter(c: Canvas, x: number, gy: number, w: number, seed: number, blooms: readonly Color[] = ["#e24a5a", "#f4a0b0", "#ffd65a", "#ffffff"]) {
  const r = rng(seed);
  for (let y = gy - 7; y <= gy; y++) for (let i = 0; i < w; i++) c.px(x + i, y, WOOD[y === gy - 7 ? 5 : i === w - 1 ? 4 : (y - gy) % 3 === 0 ? 2 : 3]!);
  for (let i = 0; i < w; i++) c.px(x + i, gy - 8, "#4a3024");
  for (let k = 0; k < w * 1.4; k++) {
    const px = x + r.int(0, w - 1);
    const py = gy - 9 - r.int(0, 5);
    c.px(px, py, r.pick(["#3e6a2c", "#5e9434", "#86ba44"]));
    if (r.chance(0.45)) c.px(px + r.int(-1, 1), py - 1, r.pick(blooms));
  }
}

/** A brass spyglass on a tripod, aimed at the sea. */
export function spyglass(c: Canvas, x: number, gy: number) {
  c.line(x, gy - 12, x - 4, gy, WOOD[2]!);
  c.line(x, gy - 12, x + 4, gy, WOOD[3]!);
  c.line(x, gy - 12, x + 1, gy + 1, WOOD[1]!);
  for (let s = 0; s < 12; s++) {
    const px = x - 5 + s;
    const py = gy - 13 - Math.round(s * 0.45);
    c.px(px, py, s > 8 ? GOLD[4]! : GOLD[3]!);
    c.px(px, py + 1, GOLD[1]!);
  }
  c.px(x + 7, gy - 19, "#bfe6ff");
}

/** A wooden signpost with two arrow boards. */
export function signpost(c: Canvas, x: number, gy: number) {
  for (let y = gy - 30; y <= gy; y++) {
    c.px(x, y, WOOD[2]!);
    c.px(x + 1, y, WOOD[4]!);
  }
  for (const [y, dir, len] of [
    [gy - 27, 1, 16],
    [gy - 20, -1, 14],
  ] as const) {
    for (let j = 0; j < 5; j++) {
      for (let i = 0; i < len; i++) {
        const tip = i >= len - 3 ? i - (len - 3) : 0;
        if (j < tip || j > 4 - tip) continue;
        const px = dir > 0 ? x + 2 + i : x - 1 - i;
        c.px(px, y + j, j === 0 ? PALE_WOOD[5]! : j === 4 ? PALE_WOOD[2]! : PALE_WOOD[4]!);
      }
    }
    for (let i = 3; i < len - 4; i += 2) c.px(dir > 0 ? x + 2 + i : x - 1 - i, y + 2, WOOD[1]!);
  }
}

// ---------------------------------------------------------------- critters

/** A pigeon pecking at the ground; `dir` 1 faces right. */
export function pigeon(c: Canvas, x: number, gy: number, dir = 1, peck = false) {
  const body = ["#4a4a5e", "#7a7a90", "#a8a8bc", "#d0d0de"];
  const P = peck ? ["..ooo.", ".o2230", "o21110", ".o1110", "..o.o."] : ["...oo.", "..o33o", ".o221o", "o2111o", ".o1110", "..o.o."];
  P.forEach((row, j) =>
    [...row].forEach((k, i) => {
      if (k === ".") return;
      const color = k === "o" ? "#2a2436" : k === "0" ? "#6a8a7a" : body[Number(k)]!;
      c.px(dir > 0 ? x + i : x + 5 - i, gy - P.length + j + 1, color);
    }),
  );
  c.px(dir > 0 ? x + 5 : x, gy - P.length + 2 + (peck ? 1 : 0), "#e89a3a"); // beak
}

/** A seagull perched (on a railing) or gliding. */
export function gull(c: Canvas, x: number, y: number, flying: boolean) {
  if (flying) {
    const G = ["o.....o", ".ow.wo.", "..owo.."];
    G.forEach((row, j) => [...row].forEach((k, i) => k !== "." && c.px(x + i - 3, y + j, k === "o" ? "#5a5a6a" : "#ffffff")));
    return;
  }
  const G = ["..oo.", ".owwy", "owwww", ".ogwo", "..o.."];
  G.forEach((row, j) => [...row].forEach((k, i) => k !== "." && c.px(x + i - 2, y + j - 4, k === "o" ? "#3a3444" : k === "y" ? "#f0b030" : k === "g" ? "#a8acc0" : "#ffffff")));
}

/** A cat sitting upright with its tail curled round. */
export function cat(c: Canvas, x: number, gy: number, coat: readonly [Color, Color, Color] = ["#5a3018", "#c8702a", "#f0a050"]) {
  const C = ["o...o.", "oo.oo.", "o1s1o.", "o2222o", ".o221o", ".o2221o", "o22221o", "o22211oo", ".oooooo1o", "........o"];
  C.forEach((row, j) =>
    [...row].forEach((k, i) => {
      if (k === ".") return;
      const color = k === "o" ? "#2a1a1a" : k === "s" ? "#f4d060" : coat[Number(k)]!;
      c.px(x + i - 3, gy - C.length + j + 1, color);
    }),
  );
  c.px(x - 2, gy - 7, "#1a1a2a");
  c.px(x, gy - 7, "#1a1a2a");
}

/** A dog lying down, dozing. */
export function dog(c: Canvas, x: number, gy: number) {
  const coat = ["#3a2418", "#7a5030", "#a87444", "#d0a06a"];
  const D = ["..oo.........", ".o32o........", "o3322ooooooo.", "o2d22222223o.", ".o21222222233o", "..oo111111oo.o", "....oo..oo...."];
  D.forEach((row, j) =>
    [...row].forEach((k, i) => {
      if (k === ".") return;
      const color = k === "o" ? "#24181a" : k === "d" ? "#1a1216" : coat[Number(k)]!;
      c.px(x + i - 6, gy - D.length + j + 1, color);
    }),
  );
}

// ---------------------------------------------------------------- overhead

/**
 * A string of paper lanterns sagging between two points. Returns each lantern's centre, so the night pass can
 * light them.
 */
export function lanternString(c: Canvas, x0: number, y0: number, x1: number, y1: number, sag: number, seed: number, night = false) {
  const r = rng(seed);
  const colors: Ramp[] = [
    ["#6a1a22", "#b83e3e", "#e8745e"],
    ["#1e5c5c", "#3e9c90", "#8ad6c4"],
    ["#8a7a66", "#e4d6ba", "#fffaf0"],
    ["#a86c1e", "#f0bc4a", "#fce8a0"],
  ];
  const at = (t: number): [number, number] => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag];
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let s = 0; s <= steps; s++) {
    const [x, y] = at(s / steps);
    c.px(Math.round(x), Math.round(y), "#3a2a2a");
  }
  const lamps: { x: number; y: number }[] = [];
  const n = Math.max(2, Math.floor(steps / 9));
  for (let k = 1; k < n; k++) {
    const [lx, ly] = at(k / n);
    const x = Math.round(lx);
    const y = Math.round(ly) + 1;
    const [d, m, l] = r.pick(colors);
    const lit = night ? ["#c86a2a", "#ffb44a", "#fff0b0"] : [d!, m!, l!];
    c.px(x, y, "#2a2030");
    for (let j = 1; j <= 4; j++) {
      c.px(x - 1, y + j, j === 1 || j === 4 ? lit[0]! : lit[1]!);
      c.px(x, y + j, j === 2 ? lit[2]! : lit[1]!);
      c.px(x + 1, y + j, lit[0]!);
    }
    c.px(x, y + 5, "#2a2030");
    lamps.push({ x, y: y + 2 });
  }
  return lamps;
}

// ---------------------------------------------------------------- the harbour

/** A rowing boat on the water, seen from above: a pointed hull of planks, thwarts, oars shipped inside. */
export function rowboat(c: Canvas, cx: number, cy: number, len: number, beam: number) {
  const hull = ["#2a1618", "#5a3024", "#7e4630", "#a0603c", "#c07e50", "#dca070"];
  const halfL = len / 2;
  const halfB = beam / 2;
  const inside = (x: number, y: number, shrink = 0) => {
    const u = (x + 0.5 - cx) / (halfL - shrink);
    const v = (y + 0.5 - cy) / (halfB - shrink * 0.6);
    return Math.abs(v) <= Math.sqrt(Math.max(0, 1 - u ** 4)) * (1 - Math.abs(u) ** 6 * 0.3);
  };
  // Wake and the boat's dark reflection.
  for (let x = Math.floor(cx - halfL - 3); x <= cx + halfL + 3; x++) {
    for (let y = Math.floor(cy + halfB - 1); y <= cy + halfB + 3; y++) {
      const base = c.get(x, y);
      if (base && !inside(x, y)) c.px(x, y, mix(base, "#0a2030", 0.35));
    }
  }
  for (let y = Math.floor(cy - halfB - 1); y <= cy + halfB + 1; y++) {
    for (let x = Math.floor(cx - halfL - 1); x <= cx + halfL + 1; x++) {
      if (!inside(x, y)) continue;
      const rim = !inside(x, y, 1.6);
      const u = (x + 0.5 - cx) / halfL;
      const v = (y + 0.5 - cy) / halfB;
      let color: Color;
      if (rim) color = v < 0 ? hull[5]! : v > 0.4 ? hull[2]! : hull[4]!; // gunwale, lit along the far side
      else {
        const plank = Math.floor((v + 1) * 3.2) % 2 === 0;
        color = hull[plank ? 3 : 2]!;
        if (Math.abs(u - 0.3) < 0.05 || Math.abs(u + 0.25) < 0.05) color = PALE_WOOD[4]!; // thwarts
      }
      c.px(x, y, color);
    }
  }
  // Oars laid along the boat.
  c.line(cx - halfL * 0.6, cy - 1, cx + halfL * 0.5, cy - 2, PALE_WOOD[5]!);
  c.line(cx - halfL * 0.55, cy + 1, cx + halfL * 0.55, cy, PALE_WOOD[3]!);
  // A coil of rope in the bow.
  c.ellipse(cx + halfL * 0.62, cy, 2, 1.5, (_, __, u, v) => (u * u + v * v < 0.3 ? hull[1]! : "#c8a878"));
}

/** A wooden jetty seen from above: deck planks on posts standing in the water. */
export function jetty(c: Canvas, x: number, y: number, w: number, d: number) {
  // Posts under the deck front.
  for (let px = x + 2; px < x + w; px += 12) {
    for (let j = 0; j < 6; j++) {
      c.px(px, y + d + j, WOOD[1]!);
      c.px(px + 1, y + d + j, WOOD[3]!);
      c.px(px + 2, y + d + j, WOOD[2]!);
    }
    c.hline(px - 1, px + 3, y + d + 6, "#e6f4ee");
  }
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < w; i++) {
      const board = Math.floor(i / 5);
      const seam = i % 5 === 4;
      let k = seam ? 1 : noise(board, 0, 7) > 0.5 ? 4 : 3;
      if (j === 0) k = 5;
      c.px(x + i, y + j, PALE_WOOD[k]!);
    }
  }
  for (let i = 0; i < w; i++) {
    c.px(x + i, y + d, WOOD[2]!);
    c.px(x + i, y + d + 1, WOOD[1]!);
  }
}
