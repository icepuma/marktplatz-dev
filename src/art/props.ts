import { type Canvas, type Color, mix } from "./canvas";
import { clamp, fill, noise, planks, RAMPS, ramp, shadow, smooth } from "./paint";

// Detailed props for the market scene. Light sources register a glow via `glow`, drawn only at night.

/** Drawn at night on the graded image; `scene` is the finished daylight scene, for occlusion checks. */
export type Glow = (c: Canvas, scene: Canvas) => void;

/**
 * A glow that only lights the pixels of a region that are still visible in the finished scene,
 * so windows hidden behind stalls stay dark. Snapshots the region when called.
 */
export function visibleGlow(
  c: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  draw: (g: Canvas, visible: (i: number, j: number) => boolean) => void,
): Glow {
  const snap: (Color | null)[] = [];
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) snap.push(c.get(i, j));
  return (g, scene) => {
    const visible = (i: number, j: number) =>
      i >= x && j >= y && i < x + w && j < y + h && snap[(j - y) * w + (i - x)] !== null && scene.get(i, j) === snap[(j - y) * w + (i - x)];
    let seen = 0;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (visible(i, j)) seen++;
    if (seen / (w * h) < 0.5) return;
    draw(g, visible);
  };
}

const OUTLINE = "#1a1020";

export const LIQUIDS: [Color, Color, Color][] = [
  ["#6a1010", "#c02828", "#ff6a5a"],
  ["#10501e", "#28a040", "#7ae88a"],
  ["#10286a", "#2a60d0", "#7aaaff"],
  ["#3a1060", "#8040c0", "#c890ff"],
  ["#6a4a08", "#d0a020", "#ffe070"],
  ["#085050", "#20a8a8", "#80f0f0"],
];

/** A potion bottle in one of several shapes; returns the height drawn. `x, y` is the bottom-left. */
export function bottle(c: Canvas, x: number, y: number, shape: number, liquid: [Color, Color, Color], glows: Glow[]) {
  const glass = ["#2a2440", mix(liquid[0], "#8aa0c8", 0.6), "#d8e8ff"];
  const kinds = [
    { w: 9, h: 11, neck: 3, round: true },
    { w: 6, h: 13, neck: 4, round: false },
    { w: 8, h: 9, neck: 2, round: false },
    { w: 11, h: 12, neck: 3, round: true },
    { w: 5, h: 10, neck: 5, round: false },
  ];
  const k = kinds[shape % kinds.length]!;
  const bodyH = k.h - k.neck - 2;
  const cx = x + k.w / 2 - 0.5;
  const level = 0.15 + noise(x, y, 4) * 0.25;
  // Body.
  for (let j = 0; j < bodyH; j++) {
    for (let i = 0; i < k.w; i++) {
      const u = (i - (k.w - 1) / 2) / (k.w / 2);
      const v = (j - (bodyH - 1) / 2) / (bodyH / 2);
      if (k.round && u * u + v * v > 1.05) continue;
      if (!k.round && (j === 0 || j === bodyH - 1) && (i === 0 || i === k.w - 1)) continue;
      const px = x + i;
      const py = y - bodyH + j;
      const edge = k.round ? u * u + v * v > 0.7 : i === 0 || i === k.w - 1 || j === bodyH - 1;
      const filled = j / bodyH > level;
      let color: Color;
      if (edge) color = glass[0]!;
      else if (filled) color = ramp(liquid, clamp(0.75 - u * 0.4 - (j / bodyH - level) * 0.6), px, py);
      else color = glass[1]!;
      c.px(px, py, color);
    }
  }
  // Surface line, highlight and a label.
  const surf = y - bodyH + Math.ceil(level * bodyH);
  for (let i = 1; i < k.w - 1; i++) if (!k.round || Math.abs(i - (k.w - 1) / 2) < k.w / 2 - 1) c.px(x + i, surf, liquid[2]);
  c.px(x + 1 + (k.round ? 1 : 0), y - bodyH + 2, "#ffffff");
  c.px(x + 1 + (k.round ? 1 : 0), y - bodyH + 3, glass[2]!);
  if (!k.round && k.w >= 6) fill(c, x + 1, y - Math.floor(bodyH / 2) - 1, k.w - 2, 3, (i) => (i === x + 1 ? "#d8c8a0" : "#f0e4c4"));
  // Neck and cork.
  const nw = Math.max(2, Math.round(k.w / 3));
  const nx = Math.round(cx - nw / 2 + 0.5);
  fill(c, nx, y - bodyH - k.neck, nw, k.neck, (i) => (i === nx ? glass[2]! : glass[1]!));
  fill(c, nx - 1, y - bodyH - k.neck - 2, nw + 2, 2, (i) => (i === nx - 1 ? "#b8804a" : "#7a4a2a"));
  glows.push((g) => g.light(cx, y - bodyH / 2, k.w + 3, liquid[2], 0.35));
  return k.h;
}

export function book(c: Canvas, x: number, y: number, w: number, h: number, cover: readonly Color[], seed: number) {
  fill(c, x, y - h, w, h, (i, j) => {
    const u = (i - x) / Math.max(1, w - 1);
    if (i === x || i === x + w - 1 || j === y - h) return cover[0]!;
    const band = (j - (y - h)) % Math.max(4, Math.floor(h / 3)) === 1;
    if (band) return RAMPS.gold[3]!;
    return ramp(cover, clamp(0.8 - u * 0.6 + (noise(i, j, seed) - 0.5) * 0.15), i, j);
  });
}

export function books(c: Canvas, x: number, y: number, count: number, seed: number) {
  const covers = [RAMPS.cloth.red, RAMPS.cloth.blue, RAMPS.cloth.green, RAMPS.cloth.purple, RAMPS.roofBrown];
  let bx = x;
  for (let k = 0; k < count; k++) {
    const w = 3 + Math.floor(noise(k, 0, seed) * 3);
    const h = 9 + Math.floor(noise(k, 1, seed) * 6);
    book(c, bx, y, w, h, covers[Math.floor(noise(k, 2, seed) * covers.length)]!, seed + k);
    bx += w;
  }
  return bx - x;
}

/** An open book lying on a counter. */
export function openBook(c: Canvas, x: number, y: number) {
  fill(c, x, y - 3, 22, 3, (i) => (i === x + 10 || i === x + 11 ? "#5a2a1a" : "#7a3a24"));
  for (const [px, dir] of [
    [x + 1, 1],
    [x + 11, -1],
  ] as const) {
    fill(c, px, y - 6, 10, 4, (i, j) => {
      const t = dir > 0 ? (i - px) / 9 : 1 - (i - px) / 9;
      if (j === y - 6 && ((dir > 0 && i === px) || (dir < 0 && i === px + 9))) return null;
      return (i + j) % 3 === 0 && j > y - 5 && i > px && i < px + 9 ? "#8a7a60" : ramp(RAMPS.cloth.cream, 0.6 + t * 0.3, i, j);
    });
  }
}

export function scroll(c: Canvas, x: number, y: number, len: number, seal: Color) {
  fill(c, x, y - 4, len, 4, (i, j) => ramp(RAMPS.cloth.cream, clamp(0.95 - (j - (y - 4)) * 0.2), i, j));
  c.px(x, y - 3, "#8a7a5a");
  c.px(x + len - 1, y - 3, "#8a7a5a");
  fill(c, x + Math.floor(len / 2) - 1, y - 4, 2, 4, () => seal);
}

export function candle(c: Canvas, x: number, y: number, h: number, glows: Glow[]) {
  fill(c, x, y - h, 3, h, (i) => (i === x ? "#fff6e0" : i === x + 1 ? "#f0e2c0" : "#c8b890"));
  c.px(x + 1, y - h - 1, "#2a1a10");
  c.px(x + 1, y - h - 2, "#ffe070");
  c.px(x + 1, y - h - 3, "#fff4c2");
  glows.push((g) => {
    g.light(x + 1, y - h - 2, 14, "#ffd27a", 0.6);
    g.px(x + 1, y - h - 2, "#ffe070");
    g.px(x + 1, y - h - 3, "#ffffff");
    g.px(x + 1, y - h - 4, "#ffe070");
  });
}

export function crystalBall(c: Canvas, x: number, y: number, r: number, glows: Glow[]) {
  fill(c, x - r, y - 3, 2 * r + 1, 3, (i) => ramp(RAMPS.gold, 0.8 - ((i - x + r) / (2 * r)) * 0.6, i, y));
  const cy = y - 3 - r;
  c.ellipse(x, cy, r, r, (i, j, u, v) => {
    const swirl = Math.sin(u * 5 + v * 7 + Math.hypot(u, v) * 6);
    if (u < -0.35 && v < -0.35 && u > -0.7) return "#ffffff";
    const t = 0.7 - (u + v) * 0.3 + swirl * 0.12;
    return ramp(["#1a3a6a", "#2a6aa8", "#4aa8d8", "#8ae0ff", "#d8faff"], clamp(t), i, j);
  });
  glows.push((g) => g.light(x, cy, r * 3.2, "#7ad8ff", 0.7));
}

export function barrel(c: Canvas, x: number, y: number, w: number, h: number) {
  for (let j = 0; j < h; j++) {
    const bulge = Math.round(Math.sin((j / (h - 1)) * Math.PI) * 2);
    for (let i = -bulge; i < w + bulge; i++) {
      const u = (i + bulge) / (w + 2 * bulge - 1);
      const stave = (i + 20) % 4 === 0;
      const t = clamp(0.95 - Math.abs(u - 0.3) * 1.3 + (smooth(i * 3, j, 4, 11) - 0.5) * 0.2);
      c.px(x + i, y + j, stave ? RAMPS.wood[0]! : ramp(RAMPS.wood, t, x + i, y + j));
    }
  }
  for (const jj of [Math.round(h * 0.18), Math.round(h * 0.82)]) {
    const bulge = Math.round(Math.sin((jj / (h - 1)) * Math.PI) * 2);
    for (let i = -bulge; i < w + bulge; i++) {
      const u = (i + bulge) / (w + 2 * bulge - 1);
      c.px(x + i, y + jj, ramp(RAMPS.iron, clamp(1 - Math.abs(u - 0.3) * 1.5), x + i, y + jj));
      c.px(x + i, y + jj + 1, RAMPS.iron[1]!);
    }
  }
  c.ellipse(x + (w - 1) / 2, y, w / 2, 2, (i, j, u) => (Math.abs(u) > 0.85 ? RAMPS.wood[0]! : ramp(RAMPS.wood, 0.55 - u * 0.2, i, j)));
}

export function crate(c: Canvas, x: number, y: number, s: number) {
  planks(c, x, y, s, s, RAMPS.wood, { size: 5, seed: x * 7 + y });
  fill(c, x, y, s, s, (i, j) => {
    const edge = i - x < 2 || x + s - 1 - i < 2 || j - y < 2 || y + s - 1 - j < 2;
    const diag = Math.abs(i - x - (j - y)) < 1.5;
    if (edge || diag) return ramp(RAMPS.wood, i - x < 2 || j - y < 2 ? 0.95 : 0.35, i, j);
    return null;
  });
  for (const [px, py] of [
    [x + 1, y + 1],
    [x + s - 2, y + 1],
    [x + 1, y + s - 2],
    [x + s - 2, y + s - 2],
  ]) {
    c.px(px!, py!, RAMPS.iron[2]!);
  }
}

export function sack(c: Canvas, x: number, y: number, w: number, h: number, seed: number) {
  const burlap = ["#5a4428", "#7a5e3a", "#9a7c50", "#b89a6a", "#d0b684"];
  for (let j = 0; j < h; j++) {
    const t = j / (h - 1);
    const half = (w / 2) * (t < 0.25 ? 0.55 + t * 1.6 : 1 - (t - 0.25) * 0.15);
    for (let i = Math.floor(-half); i <= half; i++) {
      const u = i / half;
      const weave = (x + i + (y + j)) % 2 === 0 ? 0.05 : -0.05;
      const tone = 0.75 - u * 0.35 - t * 0.2 + weave + (smooth(x + i, y + j, 3, seed) - 0.5) * 0.3;
      c.px(x + i, y + j, ramp(burlap, clamp(tone), x + i, y + j));
    }
  }
  c.hline(x - 2, x + 2, y + Math.round(h * 0.2), "#3a2a18");
  c.px(x, y - 1, "#9a7c50");
  c.px(x - 1, y - 2, "#b89a6a");
  c.px(x + 1, y - 2, "#9a7c50");
}

export function pumpkin(c: Canvas, x: number, y: number, r: number) {
  c.ellipse(x, y, r, r * 0.75, (i, j, u, v) => {
    const rib = Math.abs(Math.sin(u * 4.5)) < 0.25;
    const t = 0.8 - u * 0.3 - v * 0.35 - (rib ? 0.25 : 0);
    return ramp(["#6a2808", "#a04810", "#d06a18", "#f08c28", "#ffb050"], clamp(t), i, j);
  });
  c.rect(x, y - Math.round(r * 0.75) - 2, 2, 3, "#3a5a1e");
}

export function apples(c: Canvas, x: number, y: number, n: number) {
  for (let k = 0; k < n; k++) {
    const row = k < 4 ? 0 : 1;
    const ax = x + (k % 4) * 5 + row * 2;
    const ay = y - row * 4;
    c.ellipse(ax + 2, ay - 2, 2, 2, (i, j, u, v) => ramp(["#5a0a0a", "#9a1a14", "#d0301e", "#ff6a4a"], clamp(0.7 - u * 0.3 - v * 0.4), i, j));
    c.px(ax + 1, ay - 3, "#ffc8a8");
    c.px(ax + 2, ay - 5, "#3a2a10");
  }
}

export function herbs(c: Canvas, x: number, y: number, len: number, seed: number) {
  c.vline(x, y, y + 2, "#5a3a20");
  for (let j = 2; j < len; j++) {
    const spread = Math.min(3, Math.floor(j / 2));
    for (let i = -spread; i <= spread; i++) {
      if (noise(x + i, y + j, seed) < 0.35) continue;
      c.px(x + i, y + j, ramp(RAMPS.leaf, 0.3 + noise(i, j, seed + 1) * 0.6 - j / len * 0.3, x + i, y + j));
    }
  }
  c.hline(x - 1, x + 1, y + 2, "#c8a060");
}

export function garlic(c: Canvas, x: number, y: number, n: number) {
  c.vline(x, y, y + n * 3, "#8a6a3a");
  for (let k = 0; k < n; k++) {
    const gy = y + 2 + k * 3;
    const gx = x + (k % 2 ? 1 : -2);
    c.ellipse(gx + 1, gy + 1, 1.6, 1.4, (i, j, u, v) => (u + v > 0.4 ? "#c8bca0" : "#f4eedc"));
  }
}

/** A detailed iron lantern hanging from `y`; lights up at night. */
export function lantern(c: Canvas, x: number, y: number, glows: Glow[], size = 1) {
  const w = 5 + size * 2;
  const h = 7 + size * 2;
  c.vline(x, y, y + 1, RAMPS.iron[1]!);
  fill(c, x - Math.floor(w / 2) - 1, y + 2, w + 2, 2, (i) => ramp(RAMPS.iron, i === x - Math.floor(w / 2) - 1 ? 0.8 : 0.4, i, y));
  fill(c, x - Math.floor(w / 2), y + 4, w, h, (i, j) => {
    const bar = i === x - Math.floor(w / 2) || i === x + Math.floor(w / 2) || i === x || j === y + 4 + Math.floor(h / 2);
    return bar ? RAMPS.iron[1]! : ramp(["#6a5a3a", "#9a8a5a", "#c8b880"], 0.5 + (i < x ? 0.3 : -0.2), i, j);
  });
  fill(c, x - Math.floor(w / 2) - 1, y + 4 + h, w + 2, 2, () => RAMPS.iron[1]!);
  glows.push((g) => {
    fill(g, x - Math.floor(w / 2), y + 4, w, h, (i, j) => {
      const bar = i === x - Math.floor(w / 2) || i === x + Math.floor(w / 2) || i === x || j === y + 4 + Math.floor(h / 2);
      return bar ? "#2a1a10" : (i + j) % 3 === 0 ? "#fff4c2" : "#ffd27a";
    });
    g.light(x, y + 4 + h / 2, 20 + size * 10, "#ffcf6a", 0.8);
  });
}

/** The wizard merchant, drawn from shapes: hat, face, beard, robe, sleeves and a staff. `x` is the centre, `y` the waist. */
export function wizard(c: Canvas, x: number, y: number, glows: Glow[]) {
  const robe = RAMPS.cloth.purple;
  const hat = RAMPS.cloth.blue;
  // Robe and shoulders.
  for (let j = 0; j < 22; j++) {
    const half = 9 + Math.min(4, j / 3);
    for (let i = -Math.round(half); i <= Math.round(half); i++) {
      const u = i / half;
      const fold = Math.sin(i * 0.9 + j * 0.15) * 0.12;
      c.px(x + i, y - 22 + j, ramp(robe, clamp(0.7 - u * 0.45 + fold - j * 0.01), x + i, y - 22 + j));
    }
  }
  // Gold trim and stars on the robe.
  for (let j = 0; j < 22; j++) c.px(x, y - 22 + j, j % 3 === 0 ? RAMPS.gold[4]! : RAMPS.gold[3]!);
  for (const [sx, sy] of [
    [-6, -14],
    [5, -8],
    [-4, -4],
    [7, -17],
  ]) {
    c.px(x + sx!, y + sy!, RAMPS.gold[4]!);
  }
  // Sleeves and hands.
  for (const side of [-1, 1]) {
    for (let j = 0; j < 9; j++) {
      for (let i = 0; i < 6; i++) {
        const px = x + side * (8 + i);
        c.px(px, y - 17 + j + Math.floor(i / 2), ramp(robe, clamp(0.55 - side * 0.2 - j * 0.02), px, y - 17 + j));
      }
    }
    c.ellipse(x + side * 13, y - 7, 2, 2, (i, j, u, v) => ramp(RAMPS.skin, clamp(0.75 - u * 0.2 - v * 0.3), i, j));
  }
  // Staff in the right hand, with a glowing gem.
  for (let j = -42; j < 10; j++) c.px(x + 14, y + j, ramp(RAMPS.wood, j % 7 === 0 ? 0.3 : 0.65, x + 14, y + j));
  c.px(x + 15, y - 30, RAMPS.wood[2]!);
  c.ellipse(x + 14, y - 45, 2.5, 3, (i, j, u, v) => (u < -0.2 && v < -0.2 ? "#ffffff" : u + v > 0.5 ? "#2a8a6a" : "#5af0c0"));
  glows.push((g) => g.light(x + 14, y - 45, 18, "#5af0c0", 0.8));
  // Face.
  const fy = y - 30;
  c.ellipse(x, fy, 6, 6, (i, j, u, v) => ramp(RAMPS.skin, clamp(0.75 - u * 0.25 - v * 0.2), i, j));
  c.px(x - 3, fy - 1, OUTLINE);
  c.px(x + 2, fy - 1, OUTLINE);
  c.px(x - 3, fy - 2, "#ffffff");
  c.hline(x - 4, x - 2, fy - 3, "#e8e8f0");
  c.hline(x + 1, x + 3, fy - 3, "#e8e8f0");
  c.ellipse(x, fy + 1, 1.5, 1.5, (i, j, u) => ramp(RAMPS.skin, u < 0 ? 0.6 : 0.35, i, j));
  c.px(x - 5, fy + 1, "#e88a7a");
  c.px(x + 4, fy + 1, "#e88a7a");
  // Long white beard with strands.
  for (let j = 0; j < 20; j++) {
    const half = Math.max(1, 6 - j * 0.28 + Math.sin(j * 0.6) * 0.5);
    for (let i = -Math.round(half); i <= Math.round(half); i++) {
      const strand = (i + 20) % 3 === 0;
      const t = 0.85 - (i / half) * 0.3 - j * 0.015 - (strand ? 0.2 : 0);
      c.px(x + i, fy + 3 + j, ramp(["#8a8a9a", "#b8b8c8", "#dcdce8", "#f6f6fc", "#ffffff"], clamp(t), x + i, fy + 3 + j));
    }
  }
  // Mustache.
  fill(c, x - 4, fy + 2, 9, 2, (i) => ramp(["#b8b8c8", "#f6f6fc", "#ffffff"], i < x ? 0.9 : 0.5, i, fy));
  // Hat: wide brim and a tall, bent cone with stars and a moon.
  c.ellipse(x, fy - 6, 12, 2.5, (i, j, u, v) => ramp(hat, clamp(0.6 - u * 0.3 - v * 0.3), i, j));
  for (let j = 0; j < 26; j++) {
    const t = j / 25;
    const half = 7 * (1 - t) + 0.5;
    const lean = Math.round(t * t * 7);
    for (let i = -Math.round(half); i <= Math.round(half); i++) {
      const u = i / Math.max(1, half);
      const px = x + i + lean;
      const py = fy - 8 - j;
      c.px(px, py, ramp(hat, clamp(0.72 - u * 0.4 + (noise(px, py, 3) - 0.5) * 0.1), px, py));
    }
  }
  c.hline(x - 7, x + 7, fy - 9, RAMPS.gold[3]!);
  c.hline(x - 7, x + 7, fy - 8, RAMPS.gold[2]!);
  for (const [sx, sy] of [
    [-3, -14],
    [2, -20],
    [0, -26],
    [-1, -11],
  ]) {
    const px = x + sx! + Math.round(((-sy! - 8) / 25) ** 2 * 7);
    c.px(px, fy + sy!, RAMPS.gold[4]!);
    c.px(px - 1, fy + sy!, RAMPS.gold[3]!);
    c.px(px + 1, fy + sy!, RAMPS.gold[3]!);
    c.px(px, fy + sy! - 1, RAMPS.gold[3]!);
    c.px(px, fy + sy! + 1, RAMPS.gold[3]!);
  }
}

export function cat(c: Canvas, x: number, y: number, glows: Glow[]) {
  const fur = ["#0e0a14", "#1a1424", "#2a2236", "#3e3450"];
  // Body, sitting.
  c.ellipse(x + 5, y - 5, 5, 5, (i, j, u, v) => ramp(fur, clamp(0.6 - u * 0.3 - v * 0.3), i, j));
  // Head and ears.
  c.ellipse(x + 3, y - 12, 3.5, 3, (i, j, u, v) => ramp(fur, clamp(0.65 - u * 0.3 - v * 0.2), i, j));
  for (const ex of [0, 5]) {
    c.px(x + ex, y - 15, fur[2]!);
    c.px(x + ex, y - 16, fur[1]!);
    c.px(x + ex + 1, y - 15, fur[1]!);
  }
  c.px(x + 2, y - 12, "#e8e040");
  c.px(x + 5, y - 12, "#e8e040");
  glows.push((g) => {
    g.px(x + 2, y - 12, "#ffff80");
    g.px(x + 5, y - 12, "#ffff80");
  });
  // Tail curling up.
  for (let k = 0; k < 9; k++) c.px(x + 10 + Math.round(Math.sin(k / 3) * 2), y - 1 - k, fur[k % 2 ? 1 : 2]!);
}

export function pigeon(c: Canvas, x: number, y: number) {
  const g = ["#3a3a4a", "#5a5a6e", "#7e7e94", "#a4a4b8"];
  c.ellipse(x + 3, y - 3, 3.5, 2.5, (i, j, u, v) => ramp(g, clamp(0.6 - u * 0.2 - v * 0.4), i, j));
  c.ellipse(x + 6, y - 6, 1.8, 1.8, (i, j, u, v) => (v > 0.3 ? "#4a8a7a" : ramp(g, 0.7 - u * 0.2, i, j)));
  c.px(x + 7, y - 6, OUTLINE);
  c.px(x + 8, y - 6, "#c8a060");
  c.px(x, y - 3, g[0]!);
  c.px(x - 1, y - 2, g[0]!);
  c.px(x + 3, y, "#c85a4a");
  c.px(x + 4, y, "#c85a4a");
}

/** Hanging shop sign on an iron bracket, with a tiny icon. */
export function shopSign(c: Canvas, x: number, y: number, icon: "mug" | "key" | "boot" | "bread") {
  c.hline(x, x + 14, y, RAMPS.iron[1]!);
  c.px(x + 13, y + 1, RAMPS.iron[1]!);
  c.px(x + 12, y + 2, RAMPS.iron[1]!);
  c.vline(x + 3, y + 1, y + 2, RAMPS.iron[2]!);
  c.vline(x + 11, y + 1, y + 2, RAMPS.iron[2]!);
  planks(c, x + 1, y + 3, 13, 10, RAMPS.wood, { size: 5, seed: x });
  fill(c, x + 1, y + 3, 13, 10, (i, j) => (i === x + 1 || j === y + 3 ? RAMPS.wood[4]! : i === x + 13 || j === y + 12 ? RAMPS.wood[0]! : null));
  const gold = RAMPS.gold[3]!;
  const cx = x + 7;
  const cy = y + 8;
  if (icon === "mug") {
    fill(c, cx - 2, cy - 2, 4, 5, () => gold);
    c.vline(cx + 2, cy - 1, cy + 1, gold);
    c.hline(cx - 2, cx + 1, cy - 3, "#ffffff");
  } else if (icon === "key") {
    c.ellipse(cx - 2, cy, 1.5, 1.5, gold);
    c.hline(cx, cx + 3, cy, gold);
    c.px(cx + 3, cy + 1, gold);
    c.px(cx + 1, cy + 1, gold);
  } else if (icon === "boot") {
    fill(c, cx - 1, cy - 3, 3, 5, () => gold);
    fill(c, cx - 1, cy + 1, 5, 2, () => gold);
  } else {
    c.ellipse(cx, cy, 3.5, 2, gold);
    c.px(cx - 1, cy - 1, RAMPS.wood[1]!);
    c.px(cx + 1, cy - 1, RAMPS.wood[1]!);
  }
}

/** A puddle reflecting the sky. */
export function puddle(c: Canvas, x: number, y: number, w: number, h: number, sky: readonly Color[]) {
  c.ellipse(x, y, w, h, (i, j, u, v) => {
    const ripple = Math.sin(i * 0.8 + j * 2) > 0.7;
    return ramp(sky, clamp(0.5 + v * 0.4 + (ripple ? 0.3 : 0)), i, j);
  });
  shadow(c, x - w, y - h - 1, 2 * w, 2, () => 0.5, "#1a1430", 0.3);
}

export const tint = (color: Color, amount: number) => mix(color, "#1a1430", amount);
