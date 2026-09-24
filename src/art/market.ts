import { bayer, Canvas, type Color, hex, mix, rgb, rng } from "./canvas";
import { bricks, clamp, cloud, cylinder, fill, foliage, noise, planks, RAMPS, ramp, shadow, shingles, smooth } from "./paint";
import {
  apples,
  barrel,
  books,
  bottle,
  candle,
  cat,
  crate,
  crystalBall,
  type Glow,
  visibleGlow,
  garlic,
  herbs,
  LIQUIDS,
  lantern,
  openBook,
  pigeon,
  puddle,
  pumpkin,
  sack,
  scroll,
  shopSign,
  wizard,
} from "./props";
import { FONT } from "./sprites";

// The hero scene: a market square by day or by night.
// The scene is painted once in daylight colors; the night version is color-graded to moonlight,
// then every light source (windows, lanterns, candles, orbs) is drawn on top as a glow.

export const MARKET_WIDTH = 640;
export const MARKET_HEIGHT = 320;

export type TimeOfDay = "day" | "night";

/** Where the sun (day) or moon (night) sits; the site makes it clickable. */
export const CELESTIAL = { x: 588, y: 44, r: 18 };

const W = MARKET_WIDTH;
const H = MARKET_HEIGHT;
const GROUND = 228;

const SKY: Record<TimeOfDay, Color[]> = {
  day: ["#2a5cc0", "#3a6cd0", "#4c80dc", "#6094e4", "#78aaec", "#94c0f2", "#b4d4f6", "#d4e8f8"],
  night: ["#08051a", "#0e0826", "#160c34", "#221244", "#321a54", "#4a2262", "#6a2c6a"],
};
const HAZE = "#c4daf0";

type Stall = { x: number; w: number; awning: readonly (readonly Color[])[]; goods: "potions" | "wizard" | "books" };

export function paintMarket(time: TimeOfDay, seed = 7): Canvas {
  const r = rng(seed);
  const glows: Glow[] = [];
  const scene = new Canvas(W, H);

  mountains(scene);
  castle(scene, glows);
  trees(scene);
  wizardTower(scene, 500, glows);
  houses(scene, r, glows);
  bunting(scene, -6, 92, W + 6, 100, 18, r);
  signboard(scene, W / 2, 110, "MARKTPLATZ");
  pigeon(scene, W / 2 + 48, 109);
  cobbles(scene, time);

  const stalls: Stall[] = [
    { x: 22, w: 168, awning: [RAMPS.cloth.red, RAMPS.cloth.cream], goods: "potions" },
    { x: 236, w: 168, awning: [RAMPS.cloth.purple, RAMPS.cloth.gold], goods: "wizard" },
    { x: 450, w: 168, awning: [RAMPS.cloth.green, RAMPS.cloth.cream], goods: "books" },
  ];
  for (const s of stalls) stall(scene, s, glows, time);
  bunting(scene, 190, 152, 236, 152, 8, r);
  bunting(scene, 404, 152, 450, 152, 8, r);
  lamppost(scene, 213, glows);
  lamppost(scene, 427, glows);
  foreground(scene, glows, time);

  const c = new Canvas(W, H);
  if (time === "day") daySky(c);
  else nightSky(c);

  const daylight = new Canvas(W, H);
  daylight.data.set(scene.data);
  if (time === "night") grade(scene);
  composite(c, scene);

  if (time === "night") {
    for (const g of glows) g(c, daylight);
    // Vignette toward deep indigo.
    c.tint(0, 0, W, H, "#08051a", (x, y) => Math.max(0, Math.hypot(((x - W / 2) / (W / 2)) * 0.9, (y - H / 2) / (H / 2)) - 0.7) * 2);
  }
  return c;
}

// ---------------------------------------------------------------- sky

function daySky(c: Canvas) {
  c.gradient(0, 0, W, GROUND, SKY.day);
  const { x, y, r } = CELESTIAL;
  // Soft halo rings.
  for (const [rad, amt] of [
    [58, 0.25],
    [40, 0.45],
    [28, 0.7],
  ] as const) {
    c.light(x, y, rad, "#fff8d8", amt);
  }
  // Rays: long and short, alternating.
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + 0.1;
    const len = k % 2 ? 7 : 12;
    for (let d = r + 4; d < r + 4 + len; d++) {
      const px = Math.round(x + Math.cos(a) * d);
      const py = Math.round(y + Math.sin(a) * d);
      c.px(px, py, d < r + 7 ? "#ffe066" : "#fff4c2");
      if (k % 2 === 0 && d < r + 10) c.px(px + 1, py, "#fff0a0");
    }
  }
  c.ellipse(x, y, r, r, (i, j, u, v) => {
    if (u * u + v * v > 0.85) return "#e8a020";
    return ramp(["#f0b030", "#ffd040", "#ffe066", "#fff4a8", "#fffbe0"], clamp(0.75 - (u + v) * 0.35), i, j);
  });
  // A friendly face.
  for (const ex of [-6, 5]) {
    c.rect(x + ex, y - 5, 2, 3, "#9a5a08");
    c.px(x + ex, y - 5, "#fff4c2");
  }
  for (let i = -6; i <= 6; i++) c.px(x + i, y + 3 + Math.round((36 - i * i) / 14), "#9a5a08");
  c.ellipse(x - 10, y + 2, 2, 1.2, "#ffb060");
  c.ellipse(x + 10, y + 2, 2, 1.2, "#ffb060");

  const white = ["#8aa0c8", "#b0c4e0", "#d4e2f2", "#f0f6fc", "#ffffff"];
  cloud(c, 40, 46, 110, 1, white);
  cloud(c, 250, 28, 80, 2, white);
  cloud(c, 380, 62, 130, 3, white);
  cloud(c, 150, 84, 60, 4, white);
  // Birds.
  for (const [bx, by] of [
    [300, 50],
    [312, 44],
    [322, 52],
  ] as const) {
    for (const [dx, dy] of [
      [-2, -1],
      [-1, -1],
      [0, 0],
      [1, -1],
      [2, -1],
    ] as const) {
      c.px(bx + dx, by + dy, "#2a2a3a");
    }
  }
}

function nightSky(c: Canvas) {
  c.gradient(0, 0, W, GROUND, SKY.night);
  // Milky way: a faint diagonal band of dust and dense stars.
  fill(c, 0, 0, W, 170, (x, y) => {
    const band = Math.abs(y - (130 - x * 0.18)) / 26;
    const dust = smooth(x, y, 9, 21) * (1 - band);
    if (dust > 0.35 && dust - 0.35 > bayer(x, y) * 0.9) return mix(c.get(x, y) ?? SKY.night[2]!, "#8a6ab8", 0.3);
    return null;
  });
  const r = rng(99);
  for (let k = 0; k < 420; k++) {
    const x = r.int(0, W - 1);
    const y = r.int(0, 170);
    const band = Math.abs(y - (130 - x * 0.18)) < 26;
    if (!band && r.chance(0.35)) continue;
    const b = r.next();
    c.px(x, y, b > 0.8 ? "#fff8e0" : b > 0.4 ? "#c8b8f0" : "#7e6ab8");
    if (b > 0.97) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        c.px(x + dx, y + dy, "#a898d8");
      }
    }
  }
  const { x, y, r: rad } = CELESTIAL;
  for (const [hr, amt] of [
    [60, 0.2],
    [40, 0.4],
    [28, 0.6],
  ] as const) {
    c.light(x, y, hr, "#b8a8ff", amt);
  }
  c.ellipse(x, y, rad, rad, (i, j, u, v) => {
    const crater = smooth(i, j, 4, 5) > 0.62 ? -0.2 : 0;
    return ramp(["#a89868", "#cdb886", "#e8d8a8", "#fff1c8", "#fffbe8"], clamp(0.75 - (u + v) * 0.3 + crater), i, j);
  });
  // Thin clouds lit by the moon.
  fill(c, 0, 20, W, 120, (i, j) => {
    const s = smooth(i * 0.35, j * 1.6, 8, 31);
    if (s < 0.68) return null;
    if (Math.hypot(i - x, j - y) < rad + 1) return null;
    const lit = Math.hypot(i - x, j - y) < 140;
    return s - 0.68 > bayer(i, j) * 0.3 ? (lit ? "#8a6aa8" : "#3a2458") : null;
  });
}

/** Moonlight grade: darker, bluer, a little desaturated. */
function grade(c: Canvas) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const col = c.get(x, y);
      if (!col) continue;
      const [r, g, b] = rgb(col);
      const l = r * 0.3 + g * 0.59 + b * 0.11;
      c.px(x, y, hex([r * 0.2 + l * 0.1 + 12, g * 0.22 + l * 0.11 + 12, b * 0.3 + l * 0.2 + 36]));
    }
  }
}

function composite(dest: Canvas, src: Canvas) {
  for (let i = 0; i < src.data.length; i += 4) if (src.data[i + 3]) dest.data.set(src.data.subarray(i, i + 4), i);
}

// ---------------------------------------------------------------- landscape

function mountains(c: Canvas) {
  const far = (x: number) => 112 + (smooth(x, 0, 46, 1) - 0.5) * 70 + (smooth(x, 0, 11, 2) - 0.5) * 16;
  const farRamp = ["#46557e", "#56688f", "#6a7ca2", "#8092b4", "#98a8c6"];
  for (let x = 0; x < W; x++) {
    const top = Math.round(far(x));
    const slope = far(x + 2) - far(x - 2);
    for (let y = top; y < 190; y++) {
      const snow = y < 104 && y - top < 10 - (104 - top) * 0.02;
      const t = 0.55 + (slope > 0 ? 0.25 : -0.2) + (smooth(x, y, 5, 3) - 0.5) * 0.3 - (y - top) * 0.004;
      const color = snow ? ramp(["#8a9ac0", "#c8d4ec", "#f4f8ff"], clamp(t + 0.1), x, y) : ramp(farRamp, clamp(t), x, y);
      c.px(x, y, mix(color, HAZE, 0.35));
    }
  }
  // Nearer green hills with a conifer treeline.
  const near = (x: number) => 156 + (smooth(x, 0, 34, 5) - 0.5) * 36;
  for (let x = 0; x < W; x++) {
    const top = Math.round(near(x));
    for (let y = top; y < GROUND; y++) {
      const t = 0.6 - (y - top) * 0.012 + (smooth(x, y, 4, 6) - 0.5) * 0.35;
      c.px(x, y, mix(ramp(RAMPS.grass, clamp(t), x, y), HAZE, 0.25));
    }
  }
  for (let x = 2; x < W; x += 5) {
    const base = Math.round(near(x)) + 3;
    const h = 8 + Math.floor(noise(x, 0, 8) * 10);
    for (let j = 0; j < h; j++) {
      const half = Math.round((j / h) * 3.5 + (j % 3 === 0 ? 0.5 : 0));
      for (let i = -half; i <= half; i++) {
        c.px(x + i, base - h + j, mix(ramp(["#1a3a2a", "#244a32", "#30603c"], i < 0 ? 0.8 : 0.3, x + i, j), HAZE, 0.2));
      }
    }
  }
}

function castle(c: Canvas, glows: Glow[]) {
  // Hill.
  const hill = (x: number) => 150 - Math.max(0, 1 - ((x - 130) / 130) ** 2) * 34 + (smooth(x, 0, 9, 12) - 0.5) * 6;
  for (let x = 0; x < 270; x++) {
    const top = Math.round(hill(x));
    for (let y = top; y < GROUND; y++) {
      const t = 0.72 - (y - top) * 0.01 + (smooth(x, y, 3, 13) - 0.5) * 0.4 + (x < 130 ? 0.08 : -0.08);
      c.px(x, y, ramp(RAMPS.grass, clamp(t), x, y));
    }
  }
  // Winding path up to the gate.
  for (let y = 118; y < 190; y++) {
    const px = 128 + Math.round(Math.sin(y / 9) * 10);
    const w = 3 + Math.floor((y - 118) / 18);
    fill(c, px - w, y, 2 * w, 1, (i) => ramp(RAMPS.warmStone, 0.55 + (noise(i, y, 4) - 0.5) * 0.4, i, y));
  }
  const stone = RAMPS.stone;
  // Curtain wall with merlons.
  bricks(c, 60, 86, 140, 34, stone, { bw: 8, bh: 4, seed: 21, shade: (x) => 0.65 - (x - 60) / 280 });
  for (let x = 60; x < 200; x += 8) {
    bricks(c, x, 80, 5, 6, stone, { bw: 5, bh: 3, seed: x, shade: () => 0.7 });
    shadow(c, x + 5, 82, 3, 4, () => 0.6);
  }
  shadow(c, 60, 86, 140, 2, () => 0.7);
  // Hanging banners.
  for (const bx of [84, 170]) {
    fill(c, bx, 88, 9, 20, (i, j) => {
      if (j > 104 && Math.abs(i - bx - 4) < j - 104) return null;
      return ramp(RAMPS.cloth.red, clamp(0.7 - (i - bx) / 14 + Math.sin(j * 0.5) * 0.08), i, j);
    });
    c.ellipse(bx + 4, 95, 2, 2, RAMPS.gold[3]!);
    c.hline(bx - 1, bx + 9, 87, RAMPS.wood[1]!);
  }
  // Gate with portcullis.
  fill(c, 120, 100, 18, 20, (i, j) => {
    if (j < 106 && Math.hypot(i - 128.5, j - 106) > 9) return null;
    return (i - 120) % 4 === 1 || (j - 100) % 4 === 2 ? RAMPS.iron[2]! : "#0e0a14";
  });
  // Round towers with conical shingle roofs, arrow slits and waving flags.
  for (const [x, top, w, h] of [
    [48, 60, 20, 62],
    [104, 38, 26, 84],
    [196, 64, 18, 58],
  ] as const) {
    bricks(c, x, top, w, h, stone, { bw: 6, bh: 4, seed: x, shade: (px) => cylinder(px, x, w) });
    for (let k = 0; k < 3; k++) {
      const sy = top + 10 + k * 16;
      if (sy > top + h - 8) break;
      const sx = x + Math.floor(w / 2);
      fill(c, sx, sy, 2, 6, () => "#0e0a14");
      glows.push(visibleGlow(c, sx, sy + 1, 2, 4, (g, visible) => fill(g, sx, sy + 1, 2, 4, (i, j) => (visible(i, j) ? (k % 2 ? "#ffd27a" : "#f0a640") : null))));
    }
    for (let i = 0; i < w; i += 5) bricks(c, x + i - 1, top - 5, 4, 5, stone, { bw: 4, bh: 5, seed: i, shade: () => cylinder(x + i, x, w) });
    const roofH = Math.round(w * 1.3);
    const peak = top - 6 - roofH;
    const inside = (i: number, j: number) => j >= peak && j <= top - 5 && Math.abs(i - (x + w / 2 - 0.5)) <= ((j - peak) / roofH) * (w / 2 + 3);
    shingles(c, inside, [x - 4, peak, w + 8, roofH + 2], RAMPS.roofSlate, (i) => cylinder(i, x - 3, w + 6), x);
    const fx = Math.round(x + w / 2 - 0.5);
    c.vline(fx, peak - 14, peak, RAMPS.iron[1]!);
    for (let i = 1; i < 12; i++) {
      const wave = Math.round(Math.sin(i * 0.7) * 1.5);
      for (let j = 0; j < 6; j++) c.px(fx + i, peak - 13 + j + wave, ramp(RAMPS.cloth.red, clamp(0.8 - j * 0.1 + (wave > 0 ? -0.2 : 0.1)), fx + i, j));
    }
  }
}

function trees(c: Canvas) {
  for (const [x, y, rx, ry, seed] of [
    [266, 126, 30, 24, 41],
    [290, 138, 22, 18, 42],
    [462, 118, 34, 28, 43],
    [612, 128, 30, 26, 44],
  ] as const) {
    fill(c, x - 3, y + ry - 6, 6, 40, (i, j) => ramp(RAMPS.darkWood, i < x ? 0.8 : 0.3, i, j));
    foliage(c, x, y, rx, ry, seed);
  }
}

function wizardTower(c: Canvas, x: number, glows: Glow[]) {
  const top = 70;
  const w = 32;
  bricks(c, x, top, w, GROUND - top, ["#2e2640", "#4a3e62", "#5e5078", "#74668e", "#8a7ea4"], {
    bw: 6,
    bh: 4,
    seed: 77,
    shade: (px) => cylinder(px, x, w),
  });
  // Spiral band.
  fill(c, x, top, w, GROUND - top, (i, j) => ((j * 1.2 + (i - x) * 1.8) % 48 < 4 ? ramp(RAMPS.cloth.purple, cylinder(i, x, w) * 0.9, i, j) : null));
  // Ivy on the lower tower.
  fill(c, x, 150, w, 70, (i, j) => (smooth(i, j, 3, 78) > 0.6 - (j - 150) / 260 ? ramp(RAMPS.leaf, smooth(i, j, 2, 79), i, j) : null));
  // Balcony with a railing and a brass telescope.
  fill(c, x - 6, 112, w + 12, 4, (i) => ramp(RAMPS.stone, cylinder(i, x - 6, w + 12), i, 112));
  for (let i = x - 6; i < x + w + 6; i += 3) c.vline(i, 104, 111, RAMPS.iron[2]!);
  c.hline(x - 6, x + w + 5, 104, RAMPS.iron[3]!);
  for (let k = 0; k < 14; k++) {
    fill(c, x + w + 1 + k, 100 - Math.floor(k * 0.6), 2, 3 - (k > 10 ? 1 : 0), (i, j) => ramp(RAMPS.gold, j % 2 ? 0.5 : 0.9, i, j));
  }
  // Arched windows.
  for (const wy of [84, 130, 176]) {
    fill(c, x + 12, wy, 8, 12, (i, j) => (j < wy + 3 && Math.hypot(i - (x + 15.5), j - (wy + 3)) > 4 ? null : "#1a1430"));
    fill(c, x + 11, wy + 12, 10, 2, (i) => ramp(RAMPS.stone, 0.8 - (i - x) / 40, i, wy));
    glows.push(
      visibleGlow(c, x + 13, wy + 1, 6, 10, (g, visible) => {
        fill(g, x + 13, wy + 1, 6, 10, (i, j) =>
          !visible(i, j) || (j < wy + 3 && Math.hypot(i - (x + 15.5), j - (wy + 3)) > 3) ? null : j === wy + 6 || i === x + 15 ? "#b06a20" : "#ffd27a",
        );
        g.light(x + 16, wy + 6, 22, "#ffcf6a", 0.5);
      }),
    );
  }
  // Conical roof with stars, and a glowing orb on the spire.
  const peak = top - 50;
  const inside = (i: number, j: number) => j >= peak && j <= top && Math.abs(i - (x + w / 2 - 0.5)) <= ((j - peak) / 50) * (w / 2 + 6);
  shingles(c, inside, [x - 8, peak, w + 16, 52], RAMPS.cloth.blue, (i) => cylinder(i, x - 6, w + 12), 88);
  for (const [sx, sy] of [
    [x + 10, top - 12],
    [x + 20, top - 24],
    [x + 13, top - 34],
    [x + 22, top - 6],
  ] as const) {
    c.px(sx, sy, RAMPS.gold[4]!);
    c.px(sx - 1, sy, RAMPS.gold[3]!);
    c.px(sx + 1, sy, RAMPS.gold[3]!);
    c.px(sx, sy - 1, RAMPS.gold[3]!);
    c.px(sx, sy + 1, RAMPS.gold[3]!);
  }
  const ox = x + w / 2 - 0.5;
  c.vline(Math.round(ox), peak - 6, peak, RAMPS.gold[2]!);
  const orb = (g: Canvas, colors: string[]) =>
    g.ellipse(ox, peak - 10, 4, 4, (i, j, u, v) => (u < -0.3 && v < -0.3 ? "#ffffff" : ramp(colors, clamp(0.7 - (u + v) * 0.3), i, j)));
  orb(c, ["#2a8ab8", "#5ac8f0", "#bff4ff"]);
  glows.push((g) => {
    g.light(ox, peak - 10, 34, "#7ad8ff", 0.9);
    orb(g, ["#5ac8f0", "#bff4ff", "#ffffff"]);
  });
}

// ---------------------------------------------------------------- houses

function houses(c: Canvas, r: ReturnType<typeof rng>, glows: Glow[]) {
  let x = -14;
  let k = 0;
  while (x < W) {
    const w = r.int(58, 80);
    const h = r.int(78, 104);
    if (x + w > 494 && x < 536) {
      x = 536;
      continue;
    }
    house(c, r, x, w, h, k++, glows);
    x += w + r.int(-3, 2);
  }
}

function house(c: Canvas, r: ReturnType<typeof rng>, x: number, w: number, h: number, k: number, glows: Glow[]) {
  const base = GROUND;
  const top = base - h;
  const roofs = [RAMPS.roofRed, RAMPS.roofSlate, RAMPS.roofBrown][k % 3]!;
  const plasterTone = r.pick([0.62, 0.72, 0.52]);
  const timber = RAMPS.darkWood;
  const jetty = top + Math.floor(h * 0.45);

  // Stone plinth, plaster walls with texture, shaded toward the right and under the jetty.
  bricks(c, x, base - 10, w, 10, RAMPS.warmStone, { bw: 7, bh: 5, seed: k + 50, shade: (i) => 0.7 - (i - x) / (w * 2) });
  fill(c, x, top, w, h - 10, (i, j) => {
    const upper = j < jetty;
    const ox = upper ? 0 : 3;
    if (!upper && (i < x + ox || i >= x + w - ox)) return null;
    const t = plasterTone + (smooth(i, j, 4, k) - 0.5) * 0.18 - ((i - x) / w) * 0.25 - (j > jetty && j < jetty + 4 ? 0.3 : 0);
    return ramp(RAMPS.plaster, clamp(t), i, j);
  });

  // Timber frame.
  const beam = (x0: number, y0: number, x1: number, y1: number) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s <= steps; s++) {
      const px = Math.round(x0 + ((x1 - x0) * s) / steps);
      const py = Math.round(y0 + ((y1 - y0) * s) / steps);
      c.px(px, py, timber[3]!);
      c.px(px + 1, py, timber[1]!);
      c.px(px, py + 1, timber[2]!);
    }
  };
  beam(x, top, x + w - 2, top);
  beam(x - 1, jetty, x + w - 1, jetty);
  beam(x + 3, base - 11, x + w - 5, base - 11);
  for (const bx of [x, x + Math.floor(w / 2) - 1, x + w - 2]) beam(bx, top, bx, jetty);
  for (const bx of [x + 3, x + w - 5]) beam(bx, jetty, bx, base - 11);
  beam(x + 2, jetty - 1, x + Math.floor(w / 4), top + 2);
  beam(x + w - 3, jetty - 1, x + w - Math.floor(w / 4), top + 2);
  beam(x + Math.floor(w / 2) + 1, jetty - 1, x + Math.floor(w / 2) + Math.floor(w / 6), top + 2);
  shadow(c, x, jetty + 2, w, 3, () => 0.7);

  // Windows with shutters, glass reflections and flower boxes.
  const windowAt = (wx: number, wy: number, ww: number, wh: number) => {
    fill(c, wx - 1, wy - 1, ww + 2, wh + 2, (i, j) => (i === wx - 1 || j === wy - 1 ? timber[3]! : timber[1]!));
    fill(c, wx, wy, ww, wh, (i, j) => {
      if (i === wx + Math.floor(ww / 2) || j === wy + Math.floor(wh / 2)) return timber[2]!;
      const diag = i - wx - (j - wy);
      return diag > 1 && diag < 4 ? "#e8f4ff" : ramp(["#2a3a5a", "#4a6a9a", "#7aa0d0", "#b8d4f0"], clamp(0.9 - (j - wy) / wh), i, j);
    });
    const shutter = [RAMPS.cloth.green, RAMPS.cloth.blue, RAMPS.cloth.red][k % 3]!;
    for (const sx of [wx - 5, wx + ww + 1]) planks(c, sx, wy - 1, 4, wh + 2, shutter, { vertical: true, size: 2, seed: sx });
    if (noise(wx, wy, 7) < 0.5) {
      fill(c, wx - 2, wy + wh + 1, ww + 4, 3, (i, j) => ramp(RAMPS.wood, j === wy + wh + 1 ? 0.8 : 0.4, i, j));
      for (let i = wx - 2; i < wx + ww + 2; i++) {
        c.px(i, wy + wh, noise(i, wy, 3) < 0.5 ? ["#e84848", "#ff9ad0", "#ffe066", "#f0f0ff"][Math.floor(noise(i, 1, 4) * 4)]! : RAMPS.leaf[3]!);
      }
    }
    if (noise(wx, wy, 11) < 0.7) {
      glows.push(
        visibleGlow(c, wx, wy, ww, wh, (g, visible) => {
          fill(g, wx, wy, ww, wh, (i, j) =>
            !visible(i, j) ? null : i === wx + Math.floor(ww / 2) || j === wy + Math.floor(wh / 2) ? "#6a3a14" : (i + j) % 5 === 0 ? "#fff4c2" : "#ffcf6a",
          );
          g.light(wx + ww / 2, wy + wh / 2, 16, "#ffcf6a", 0.4);
        }),
      );
    }
  };
  const cols = w > 70 ? [0.22, 0.5, 0.78] : [0.28, 0.72];
  for (const f of cols) windowAt(Math.round(x + w * f) - 3, top + 8, 7, 10);
  windowAt(Math.round(x + w * 0.3) - 3, jetty + 8, 7, 9);

  // Door with planks, hinges, a handle and a step.
  const dx = Math.round(x + w * 0.68) - 5;
  const dy = jetty + 6;
  const dh = base - 10 - dy;
  planks(c, dx, dy, 11, dh, RAMPS.roofBrown, { vertical: true, size: 3, seed: dx });
  fill(c, dx, dy, 11, 4, (i, j) => (Math.hypot(i - (dx + 5), j - (dy + 4)) > 5.5 ? ramp(RAMPS.plaster, 0.5, i, j) : null));
  c.hline(dx, dx + 6, dy + 6, RAMPS.iron[1]!);
  c.hline(dx, dx + 6, dy + dh - 5, RAMPS.iron[1]!);
  c.px(dx + 8, dy + Math.floor(dh / 2), RAMPS.gold[3]!);
  fill(c, dx - 1, base - 10, 13, 2, (i) => ramp(RAMPS.stone, 0.8 - (i - dx) / 30, i, base));

  if (k % 2 === 0) shopSign(c, x + w - 4, jetty + 2, (["mug", "key", "boot", "bread"] as const)[(k / 2) % 4]!);
  if (k % 3 === 1) {
    fill(c, x, jetty, 14, base - jetty, (i, j) => (smooth(i, j, 3, k + 90) > 0.5 + (i - x) / 30 ? ramp(RAMPS.leaf, smooth(i, j, 2, k), i, j) : null));
  }

  // Steep gabled roof with shingles, an eave shadow and a dormer.
  const roofH = Math.round(w * 0.62);
  const peak = top - roofH;
  const cx = x + w / 2 - 0.5;
  const inside = (i: number, j: number) => j >= peak && j <= top + 2 && Math.abs(i - cx) <= ((j - peak) / roofH) * (w / 2 + 5);
  shingles(c, inside, [x - 6, peak, w + 12, roofH + 3], roofs, (i) => (i < cx ? 0.75 : 0.35), k + 30);
  shadow(c, x, top + 3, w, 3, () => 0.8);
  if (w > 64) {
    const ddx = Math.round(cx) - 6;
    const ddy = top - Math.round(roofH * 0.45);
    fill(c, ddx, ddy, 12, 12, (i, j) => (j < ddy + 4 && Math.abs(i - ddx - 5.5) > j - ddy + 2 ? null : ramp(RAMPS.plaster, 0.6 - (i - ddx) / 30, i, j)));
    windowAt(ddx + 3, ddy + 4, 6, 6);
  }
  // Brick chimney with a wisp of smoke.
  if (k % 2 === 1) {
    const chx = Math.round(x + w * 0.72);
    const chy = peak + Math.round(roofH * 0.35);
    bricks(c, chx, chy - 14, 8, 16, ["#3a1a14", "#6a3226", "#8a4432", "#a45a40", "#bc7050"], { bw: 4, bh: 3, seed: chx, shade: (i) => cylinder(i, chx, 8) });
    fill(c, chx - 1, chy - 16, 10, 2, (i) => ramp(RAMPS.stone, 0.8 - (i - chx) / 12, i, chy));
    for (let s = 0; s < 10; s++) {
      c.ellipse(chx + 4 + Math.round(Math.sin(s * 0.7) * 3) + s, chy - 20 - s * 4, 2 + s * 0.35, 1.5 + s * 0.15, (i, j) =>
        bayer(i, j) < 0.3 - s * 0.025 ? mix(c.get(i, j) ?? "#c8d8f0", "#eef2f8", 0.5) : null,
      );
    }
  }
}

// ---------------------------------------------------------------- square

function bunting(c: Canvas, x0: number, y0: number, x1: number, y1: number, sag: number, r: ReturnType<typeof rng>) {
  const colors = [RAMPS.cloth.red, RAMPS.cloth.gold, RAMPS.cloth.blue, RAMPS.cloth.green, RAMPS.cloth.cream];
  let k = r.int(0, colors.length - 1);
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0);
    const y = Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t));
    c.px(x, y, "#2a1a10");
    if ((x - x0) % 11 === 5) {
      const cols = colors[k++ % colors.length]!;
      for (let j = 1; j <= 8; j++) {
        const half = Math.max(0, 4 - Math.floor(j / 2));
        for (let i = -half; i <= half; i++) c.px(x + i, y + j, ramp(cols, clamp(0.8 - (i + half) / 12 - j * 0.03), x + i, y + j));
      }
    }
  }
}

function signboard(c: Canvas, cx: number, y: number, text: string) {
  const w = text.length * 12 + 16;
  const x = Math.round(cx - w / 2);
  const h = 26;
  for (const px of [x + 8, x + w - 9]) for (let j = y - 12; j < y; j++) c.px(px, j, j % 3 ? RAMPS.iron[3]! : RAMPS.iron[1]!);
  planks(c, x, y, w, h, RAMPS.wood, { size: 6, seed: 5 });
  fill(c, x, y, w, h, (i, j) => {
    const edge = Math.min(i - x, x + w - 1 - i, j - y, y + h - 1 - j);
    if (edge === 0) return RAMPS.wood[0]!;
    if (edge === 1) return i - x <= 1 || j - y <= 1 ? RAMPS.wood[4]! : RAMPS.wood[1]!;
    return null;
  });
  for (const [px, py] of [
    [x + 3, y + 3],
    [x + w - 4, y + 3],
    [x + 3, y + h - 4],
    [x + w - 4, y + h - 4],
  ] as const) {
    c.px(px, py, RAMPS.iron[3]!);
  }
  [...text].forEach((ch, k) => {
    FONT[ch]?.forEach((row, j) => {
      [...row].forEach((bit, i) => {
        if (bit !== "#") return;
        const lx = x + 9 + k * 12 + i * 2;
        const ly = y + 6 + j * 2;
        fill(c, lx + 1, ly + 1, 2, 2, () => RAMPS.wood[0]!);
        fill(c, lx, ly, 2, 2, (_, jj) => (jj === ly && j < 3 ? RAMPS.gold[4]! : ramp(RAMPS.gold, 0.8 - j * 0.06, lx, jj)));
      });
    });
  });
}

function cobbles(c: Canvas, time: TimeOfDay) {
  fill(c, 0, GROUND, W, H - GROUND, () => "#2e2824");
  let y = GROUND;
  let row = 0;
  while (y < H) {
    const h = 3 + Math.floor((y - GROUND) / 11);
    const w = Math.round(h * 2.1) + 2;
    const off = row % 2 ? Math.floor(w / 2) : 0;
    for (let x = -off; x < W; x += w + 1) {
      const tone = noise(x, row, 17);
      for (let j = 0; j < h - 1; j++) {
        for (let i = 0; i < w; i++) {
          const u = (i - (w - 1) / 2) / (w / 2);
          const v = (j - (h - 2) / 2) / (h / 2);
          if (u * u + v * v > 1.15) continue;
          const moss = noise(x + i, y + j, 18) < 0.03 && v > 0.3;
          const t = 0.45 + tone * 0.25 - u * 0.18 - v * 0.3;
          c.px(x + i, y + j, moss ? RAMPS.grass[2]! : ramp(RAMPS.warmStone, clamp(t), x + i, y + j));
        }
      }
    }
    y += h;
    row++;
  }
  // A worn, lighter path through the middle, and puddles reflecting the sky.
  shadow(c, 0, GROUND, W, H - GROUND, (x) => Math.max(0, 0.5 - Math.abs(x - W / 2) / 260), "#e8dcc8", 0.12);
  const sky = time === "day" ? SKY.day.slice(2) : SKY.night.slice(2);
  puddle(c, 300, 304, 26, 5, sky);
  puddle(c, 116, 296, 14, 3, sky);
}

function stall(c: Canvas, s: Stall, glows: Glow[], time: TimeOfDay) {
  const { x, w, awning, goods } = s;
  const awningTop = 150;
  const awningBottom = 172;
  const counterTop = goods === "wizard" ? 246 : 240;
  const counterBottom = 276;

  // Back wall: draped cloth with a diamond pattern, shaded under the awning.
  const cloth = awning[0]!;
  fill(c, x + 4, awningBottom, w - 8, counterTop - awningBottom, (i, j) => {
    const fold = Math.sin((i - x) * 0.45) * 0.15;
    const diamond = Math.abs(((i - x) % 12) - 6) + Math.abs(((j - awningBottom) % 12) - 6) === 5;
    return ramp(cloth, clamp(0.35 + fold - (diamond ? 0.2 : 0)), i, j);
  });
  shadow(c, x + 4, awningBottom, w - 8, 14, (_, j) => 1 - (j - awningBottom) / 14, "#0e0a14", 0.45);

  // Two shelves of goods.
  for (const sy of [awningBottom + 26, awningBottom + 50]) {
    fill(c, x + 8, sy, w - 16, 3, (i, j) => ramp(RAMPS.wood, j === sy ? 0.9 : 0.35, i, j));
    for (const bx of [x + 12, x + w - 14]) fill(c, bx, sy + 3, 2, 4, () => RAMPS.wood[1]!);
    let gx = x + 12;
    let n = 0;
    while (gx < x + w - 20) {
      if (goods === "wizard" && Math.abs(gx - (x + w / 2)) < 24 && sy > awningBottom + 30) {
        gx += 6;
        continue;
      }
      if (goods === "books") {
        gx += books(c, gx, sy, 4 + (n % 3), gx + sy) + 4;
      } else {
        const shape = Math.floor(noise(gx, sy, 5) * 5);
        bottle(c, gx, sy, shape, LIQUIDS[Math.floor(noise(gx, sy, 6) * LIQUIDS.length)]!, glows);
        gx += 11 + (shape === 3 ? 3 : 0);
      }
      n++;
    }
  }

  if (goods === "wizard") wizard(c, x + w / 2, counterTop + 2, glows);

  // Posts with wood grain and brass finials.
  for (const px of [x, x + w - 5]) {
    planks(c, px, awningTop - 4, 5, counterBottom + 8 - awningTop, RAMPS.wood, { vertical: true, size: 5, seed: px, light: 0.6 });
    fill(c, px, awningTop - 4, 5, counterBottom + 8 - awningTop, (i) => (i === px ? RAMPS.wood[4]! : i === px + 4 ? RAMPS.wood[0]! : null));
    c.ellipse(px + 2, awningTop - 7, 3, 3, (i, j, u, v) => ramp(RAMPS.gold, clamp(0.8 - (u + v) * 0.3), i, j));
  }

  // Hanging herbs, garlic and a small lantern from the awning frame.
  herbs(c, x + 16, awningBottom + 2, 12, x);
  garlic(c, x + 28, awningBottom + 1, 4);
  herbs(c, x + w - 20, awningBottom + 2, 10, x + 1);
  lantern(c, x + w - 34, awningBottom, glows, 0);

  // Counter: planks, a top edge, and a draped cloth with gold fringe.
  planks(c, x - 4, counterTop, w + 8, counterBottom - counterTop, RAMPS.wood, { size: 6, seed: x + 1 });
  fill(c, x - 6, counterTop - 3, w + 12, 3, (i, j) => ramp(RAMPS.wood, j === counterTop - 3 ? 1 : 0.55, i, j));
  const drape = awning[1]!;
  fill(c, x + 16, counterTop, w - 32, 22, (i, j) => {
    if (j - counterTop > 18 - Math.abs(Math.sin((i - x) * 0.2)) * 4) return null;
    const pattern = (i - x) % 10 === 0 ? -0.2 : 0;
    return ramp(drape, clamp(0.65 - (j - counterTop) * 0.015 + Math.sin((i - x) * 0.3) * 0.1 + pattern), i, j);
  });
  for (let i = x + 16; i < x + w - 16; i += 2) c.px(i, counterTop + 19 + Math.round(-Math.abs(Math.sin((i - x) * 0.2)) * 4), RAMPS.gold[3]!);

  // Goods on the counter.
  if (goods === "potions") {
    let gx = x + 8;
    for (let k = 0; k < 6; k++) {
      bottle(c, gx, counterTop - 3, (k * 2) % 5, LIQUIDS[k % LIQUIDS.length]!, glows);
      gx += 12;
    }
    fill(c, x + 84, counterTop - 5, 24, 2, (i) => ramp(RAMPS.wood, 0.6, i, counterTop));
    apples(c, x + 86, counterTop - 5, 7);
    pumpkin(c, x + 124, counterTop - 9, 7);
    pumpkin(c, x + 140, counterTop - 7, 5);
    candle(c, x + 152, counterTop - 3, 6, glows);
  } else if (goods === "wizard") {
    openBook(c, x + 14, counterTop - 3);
    candle(c, x + 42, counterTop - 3, 8, glows);
    candle(c, x + 47, counterTop - 3, 5, glows);
    crystalBall(c, x + w / 2 + 34, counterTop - 3, 8, glows);
    scroll(c, x + w - 44, counterTop - 3, 14, RAMPS.cloth.red[2]!);
    bottle(c, x + w - 26, counterTop - 3, 3, LIQUIDS[3]!, glows);
  } else {
    books(c, x + 8, counterTop - 3, 5, 71);
    openBook(c, x + 40, counterTop - 3);
    for (let k = 0; k < 3; k++) scroll(c, x + 70 + k * 3, counterTop - 3 - k * 4, 18, RAMPS.cloth.red[2]!);
    fill(c, x + 116, counterTop - 5, 10, 2, (i) => ramp(RAMPS.gold, 0.7, i, counterTop));
    c.ellipse(x + 121, counterTop - 12, 6, 6, (i, j, u, v) =>
      smooth(i * 2, j * 2, 3, 61) > 0.55 ? ramp(RAMPS.grass, clamp(0.7 - u * 0.3), i, j) : ramp(RAMPS.cloth.blue, clamp(0.8 - (u + v) * 0.3), i, j),
    );
    candle(c, x + 140, counterTop - 3, 7, glows);
    c.ellipse(x + 152, counterTop - 5, 3, 2.5, RAMPS.iron[1]!);
    c.line(x + 152, counterTop - 7, x + 158, counterTop - 20, "#f4f4fc");
    c.line(x + 153, counterTop - 8, x + 158, counterTop - 18, "#c8c8d8");
  }

  // Awning: stripes with fabric shading, a scalloped valance with fringe.
  for (let i = x - 8; i < x + w + 8; i++) {
    const stripeW = 12;
    const k = Math.floor((i - x + 8) / stripeW);
    const colors = awning[k % 2]!;
    const within = ((i - x + 8) % stripeW) / (stripeW - 1);
    for (let j = awningTop; j < awningBottom; j++) {
      const sag = (j - awningTop) / (awningBottom - awningTop);
      c.px(i, j, ramp(colors, clamp(0.85 - sag * 0.35 - Math.abs(within - 0.35) * 0.35 + (within < 0.08 ? -0.25 : 0)), i, j));
    }
    const scallop = Math.round(Math.sin((((i - x + 8) % stripeW) / stripeW) * Math.PI) * 7);
    for (let j = awningBottom; j < awningBottom + scallop; j++) {
      c.px(i, j, ramp(colors, clamp(0.45 - (j - awningBottom) * 0.03 - Math.abs(within - 0.5) * 0.2), i, j));
    }
    if (scallop > 2) c.px(i, awningBottom + scallop, i % 2 ? RAMPS.gold[3]! : RAMPS.gold[1]!);
  }
  fill(c, x - 10, awningTop - 3, w + 20, 3, (i, j) => ramp(RAMPS.wood, j === awningTop - 3 ? 0.9 : 0.35, i, j));

  // Day: the stall casts a shadow on the cobbles. Night: a warm glow under the awning.
  if (time === "day") shadow(c, x - 10, counterBottom, w + 10, 12, (i, j) => (i - x + 10 < (j - counterBottom) * 1.4 ? 0 : 0.8), "#1a1430", 0.35);
  glows.push((g) => g.light(x + w / 2, counterTop - 20, w / 2 + 10, "#ffcf6a", 0.35, 40));
}

function lamppost(c: Canvas, x: number, glows: Glow[]) {
  fill(c, x - 1, 130, 4, H - 130 - 12, (i) => ramp(RAMPS.iron, i === x - 1 ? 0.8 : i === x + 2 ? 0.1 : 0.4, i, 0));
  fill(c, x - 5, H - 16, 12, 6, (i, j) => ramp(RAMPS.iron, clamp(0.8 - (i - x + 5) / 14 - (j - (H - 16)) * 0.05), i, j));
  // Scrollwork arms.
  for (let k = 0; k < 10; k++) {
    const dy = Math.round(Math.sin((k / 9) * Math.PI) * 3);
    c.px(x - 2 - k, 134 - dy, RAMPS.iron[2]!);
    c.px(x + 3 + k, 134 - dy, RAMPS.iron[2]!);
  }
  lantern(c, x + 1, 112, glows, 2);
  glows.push((g) => g.light(x + 1, H - 12, 34, "#ffcf6a", 0.5, 8));
}

function foreground(c: Canvas, glows: Glow[], time: TimeOfDay) {
  if (time === "day") {
    shadow(c, 0, 300, 60, 14, (i, j) => (i < 50 - (j - 300) ? 0.7 : 0), "#1a1430", 0.35);
    shadow(c, 560, 300, 80, 16, (i) => (i > 570 ? 0.7 : 0), "#1a1430", 0.35);
  }
  barrel(c, 4, 270, 18, 34);
  barrel(c, 26, 280, 16, 30);
  sack(c, 56, 292, 16, 22, 3);
  sack(c, 70, 296, 14, 18, 4);
  crate(c, 590, 278, 30);
  crate(c, 604, 250, 24);
  crate(c, 566, 292, 22);
  cat(c, 606, 250, glows);
  pumpkin(c, 548, 306, 8);
  pumpkin(c, 534, 310, 6);
}
