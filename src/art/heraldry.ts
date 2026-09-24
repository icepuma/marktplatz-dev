import { bayer, Canvas, type Color, hash, mix, rng } from "./canvas";
import { clamp, fill, RAMPS, ramp, smooth } from "./paint";
import { FONT } from "./sprites";

// Art derived from ids: a coat of arms per guild (role) and an item icon per ware (skill).

const TINCTURES = [RAMPS.cloth.red, RAMPS.cloth.blue, RAMPS.cloth.green, RAMPS.cloth.purple, ["#0a0a12", "#16141e", "#24202e", "#34303e", "#484456"]];
const METALS = [RAMPS.gold, ["#5a5a6a", "#8a8a9a", "#b8b8c8", "#dcdce8", "#ffffff"]];

export const SHIELD_WIDTH = 48;
export const SHIELD_HEIGHT = 56;

export function guildShield(id: string, name: string): Canvas {
  const c = new Canvas(SHIELD_WIDTH, SHIELD_HEIGHT);
  const r = rng(hash(id));
  const tincture = r.pick(TINCTURES);
  const metal = r.pick(METALS);
  const division = r.pick(["pale", "fess", "quarterly", "bend", "chevron", "plain", "saltire"] as const);

  const cx = 23.5;
  // Heater shield: straight sides, then a curved point.
  const edge = (x: number, y: number) => {
    if (y < 4 || y > 53) return -1;
    const u = Math.abs(x - cx) / 21.5;
    const limit = y < 28 ? 1 : 1 - ((y - 28) / 25.5) ** 1.8;
    return limit - u;
  };
  const inField = (x: number, y: number) => edge(x, y) > 0.1;
  const fieldIs = (x: number, y: number) => {
    const top = y < 25;
    const left = x < 24;
    switch (division) {
      case "pale":
        return left;
      case "fess":
        return top;
      case "quarterly":
        return top === left;
      case "bend":
        return x - y > -6;
      case "chevron":
        return !(y > 40 - Math.abs(x - cx) * 0.95 && y < 49 - Math.abs(x - cx) * 0.95);
      case "saltire":
        return !(Math.abs(x - cx - (y - 28)) < 3.5 || Math.abs(x - cx + (y - 28)) < 3.5);
      case "plain":
        return true;
    }
  };

  for (let y = 0; y < SHIELD_HEIGHT; y++) {
    for (let x = 0; x < SHIELD_WIDTH; x++) {
      const e = edge(x, y);
      if (e < 0) continue;
      // Light from the upper left: a soft curved-surface falloff.
      const light = clamp(0.78 - (x - cx) / 40 - (y - 20) / 70 - Math.max(0, 0.15 - e) * 2);
      if (e <= 0.1) {
        // Bevelled metal rim.
        const inner = e > 0.05;
        c.px(x, y, ramp(RAMPS.gold, clamp(light + (inner ? -0.15 : 0.1)), x, y));
        continue;
      }
      const colors = fieldIs(x, y) ? tincture : metal;
      // Damask diaper pattern, very subtle.
      const diaper = (Math.abs(((x + y) % 8) - 4) + Math.abs(((x - y + 64) % 8) - 4)) === 4 ? -0.08 : 0;
      c.px(x, y, ramp(colors, clamp(light * 0.85 + 0.08 + diaper + (smooth(x, y, 3, 5) - 0.5) * 0.08), x, y));
    }
  }
  // Division lines get a thin dark seam.
  for (let y = 1; y < SHIELD_HEIGHT - 1; y++) {
    for (let x = 1; x < SHIELD_WIDTH - 1; x++) {
      if (!inField(x, y) || !inField(x + 1, y) || !inField(x, y + 1)) continue;
      if (fieldIs(x, y) !== fieldIs(x + 1, y) || fieldIs(x, y) !== fieldIs(x, y + 1)) c.px(x, y, mix(c.get(x, y)!, "#140c2a", 0.4));
    }
  }

  // Bevelled roundel with the guild's initial, embossed.
  const ry = 25;
  c.ellipse(cx, ry, 11, 11, (i, j, u, v) => {
    const d = Math.hypot(u, v);
    if (d > 0.82) return ramp(RAMPS.gold, clamp(0.75 - (u + v) * 0.45), i, j);
    return ramp(RAMPS.cloth.cream, clamp(0.85 - (u + v) * 0.25), i, j);
  });
  const letter = FONT[name.trim()[0]?.toUpperCase() ?? ""] ?? FONT.M!;
  const letterColors = division === "plain" ? tincture : TINCTURES[4]!;
  letter.forEach((row, j) => {
    [...row].forEach((bit, i) => {
      if (bit !== "#") return;
      const lx = 19 + i * 2;
      const ly = 18 + j * 2;
      fill(c, lx + 1, ly + 1, 2, 2, (x, y) => (c.get(x, y) ? mix(c.get(x, y)!, "#140c2a", 0.35) : null));
      fill(c, lx, ly, 2, 2, (x, y) => ramp(letterColors, clamp(0.55 - (y - ly) * 0.15 + (x === lx ? 0.1 : 0)), x, y));
    });
  });

  // Specular gleam and rivets.
  for (let k = 0; k < 7; k++) c.px(8 + k, 8 + Math.floor(k / 3), k % 2 ? "#ffffff" : "#fff4c2");
  for (const [x, y] of [
    [7, 6],
    [40, 6],
    [7, 26],
    [40, 26],
  ] as const) {
    c.px(x, y, RAMPS.gold[4]!);
    c.px(x + 1, y + 1, RAMPS.gold[1]!);
  }
  c.outline("#140c10");
  return c;
}

export const WARE_SIZE = 32;

const LIQUIDS: Color[][] = [
  ["#4a0a0a", "#8a1a1a", "#c83232", "#f06050", "#ffb0a0"],
  ["#0a3a14", "#16702a", "#28a840", "#6ae07a", "#c0ffc8"],
  ["#0a1a4a", "#1a3a8a", "#2a64d0", "#6aa0ff", "#c0dcff"],
  ["#2a0a4a", "#5a1a8a", "#8a40c8", "#c080f0", "#ecd0ff"],
  ["#4a3004", "#8a6010", "#d0a020", "#f8d860", "#fff4c0"],
  ["#063a3a", "#10706a", "#20a8a0", "#60e0d8", "#c0fff8"],
];

export function wareIcon(id: string): Canvas {
  const c = new Canvas(WARE_SIZE, WARE_SIZE);
  const r = rng(hash(id));
  const kind = r.pick(["potion", "scroll", "tome", "orb"] as const);
  const liquid = r.pick(LIQUIDS);
  ({ potion, scroll, tome, orb })[kind](c, liquid);
  c.outline("#140c10");
  // Magical sparkles.
  for (const [sx, sy, big] of [
    [r.pick([4, 26]), r.pick([4, 7]), true],
    [r.pick([6, 25]), r.pick([22, 26]), false],
  ] as const) {
    c.px(sx, sy, "#fffbe0");
    const arm = big ? 2 : 1;
    for (let d = 1; d <= arm; d++) {
      for (const [dx, dy] of [
        [d, 0],
        [-d, 0],
        [0, d],
        [0, -d],
      ] as const) {
        c.px(sx + dx, sy + dy, d === 1 ? "#ffe066" : "#e8a020");
      }
    }
  }
  return c;
}

function potion(c: Canvas, liquid: readonly Color[]) {
  const cx = 15.5;
  const cy = 20;
  // Round flask body: glass rim, liquid with a meniscus, bubbles and highlights.
  c.ellipse(cx, cy, 10, 10, (i, j, u, v) => {
    const d = Math.hypot(u, v);
    if (d > 0.88) return ramp(["#2a2440", "#5a6a8a", "#9ab0d0"], clamp(0.8 - (u + v) * 0.4), i, j);
    if (v < -0.25) return ramp(["#6a7a9a", "#9ab0d0", "#d0e0f4"], clamp(0.7 - u * 0.4 + v * 0.3), i, j);
    return ramp(liquid, clamp(0.72 - u * 0.35 - v * 0.25), i, j);
  });
  for (let i = 7; i <= 24; i++) if (Math.abs(i - cx) < 8.5) c.px(i, 17, liquid[4]!);
  for (const [bx, by] of [
    [13, 22],
    [18, 25],
    [16, 20],
  ] as const) {
    c.px(bx, by, liquid[4]!);
  }
  fill(c, 9, 13, 2, 6, (i, j) => (j < 16 ? "#ffffff" : "#e8f4ff"));
  c.px(11, 12, "#ffffff");
  // Neck, lip, cork and a twine tie.
  fill(c, 13, 6, 6, 5, (i) => ramp(["#6a7a9a", "#9ab0d0", "#e0ecff"], i === 13 ? 1 : i === 18 ? 0.1 : 0.55, i, 6));
  fill(c, 12, 9, 8, 2, (i) => ramp(["#5a6a8a", "#b8c8e0", "#ffffff"], i < 15 ? 0.9 : 0.4, i, 9));
  fill(c, 13, 2, 6, 5, (i, j) => ramp(RAMPS.wood, clamp(0.85 - (i - 13) / 7 + (j === 2 ? 0.1 : 0)), i, j));
  c.hline(12, 19, 5, "#c8a060");
  c.px(20, 6, "#c8a060");
  c.px(21, 7, "#a8803a");
  // A little paper label.
  fill(c, 12, 21, 8, 5, (i, j) => (i === 12 || j === 21 ? "#fff6e0" : "#e8d8b0"));
  c.hline(13, 18, 23, liquid[1]!);
}

function scroll(c: Canvas, liquid: readonly Color[]) {
  const paper = RAMPS.cloth.cream;
  fill(c, 7, 6, 18, 20, (i, j) => ramp(paper, clamp(0.85 - (i - 7) / 26 + (smooth(i, j, 3, 4) - 0.5) * 0.15), i, j));
  // Writing: lines of tiny runes.
  for (let y = 9; y < 22; y += 2) {
    for (let x = 9; x < 22 - (y % 4); x++) if ((x * 7 + y * 3) % 5 !== 0) c.px(x, y, "#6a5838");
  }
  // Rolled ends with shading.
  for (const y of [3, 24]) {
    fill(c, 5, y, 22, 4, (i, j) => ramp(paper, clamp(0.95 - Math.abs(j - y - 1) * 0.25 - (i - 5) / 44), i, j));
    c.ellipse(5, y + 1.5, 1.5, 2, "#b8a47e");
    c.ellipse(26, y + 1.5, 1.5, 2, "#8a7a5a");
  }
  // Ribbon and wax seal in the ware's color.
  fill(c, 18, 22, 3, 8, (i, j) => (j > 27 && i === 19 ? null : ramp(liquid, i === 18 ? 0.8 : 0.5, i, j)));
  c.ellipse(19.5, 22, 4, 4, (i, j, u, v) => (Math.hypot(u, v) > 0.8 ? liquid[1]! : ramp(liquid, clamp(0.75 - (u + v) * 0.4), i, j)));
  c.px(18, 21, liquid[4]!);
  c.px(20, 22, liquid[0]!);
}

function tome(c: Canvas, liquid: readonly Color[]) {
  // Page block on the right, then the cover.
  fill(c, 24, 5, 4, 23, (i, j) => ((j + i) % 2 === 0 ? "#fff6e0" : "#dccaa2"));
  fill(c, 5, 3, 20, 26, (i, j) => {
    const edge = i === 5 || j === 3 || j === 28;
    if (edge) return liquid[0]!;
    const emboss = (i === 8 || i === 21 || j === 6 || j === 25) && i >= 8 && i <= 21 && j >= 6 && j <= 25;
    if (emboss) return RAMPS.gold[3]!;
    return ramp(liquid, clamp(0.75 - (i - 5) / 34 - (j - 3) / 80 + (smooth(i, j, 2, 9) - 0.5) * 0.15), i, j);
  });
  // Spine ridges.
  for (const y of [7, 15, 23]) c.hline(5, 7, y, RAMPS.gold[2]!);
  // Gold corner pieces.
  for (const [x, y] of [
    [8, 6],
    [20, 6],
    [8, 24],
    [20, 24],
  ] as const) {
    fill(c, x, y, 2, 2, (i, j) => ramp(RAMPS.gold, i === x && j === y ? 1 : 0.6, i, j));
  }
  // Central gem in a gold setting.
  c.ellipse(14.5, 15.5, 4, 5, (i, j, u, v) => (Math.hypot(u, v) > 0.75 ? ramp(RAMPS.gold, clamp(0.8 - (u + v) * 0.4), i, j) : null));
  c.ellipse(14.5, 15.5, 2.5, 3.5, (i, j, u, v) => ramp(["#1a0a3a", "#4a1a8a", "#8a4ae0", "#d0a0ff", "#ffffff"], clamp(0.7 - (u + v) * 0.45), i, j));
  // Clasp.
  fill(c, 23, 13, 5, 5, (i, j) => ramp(RAMPS.gold, clamp(0.85 - (i - 23) / 8 - (j - 13) / 12), i, j));
  c.px(26, 15, "#3a2a10");
}

function orb(c: Canvas, liquid: readonly Color[]) {
  // Claw stand.
  fill(c, 9, 25, 14, 3, (i, j) => ramp(RAMPS.wood, clamp(0.85 - (i - 9) / 18 - (j - 25) * 0.1), i, j));
  fill(c, 7, 28, 18, 2, (i) => ramp(RAMPS.wood, clamp(0.6 - (i - 7) / 30), i, 28));
  for (const x of [10, 15, 20]) fill(c, x, 21, 2, 5, (i, j) => ramp(RAMPS.gold, clamp(0.9 - (j - 21) * 0.1 - (i - x) * 0.3), i, j));
  // Sphere with an inner swirl and tiny stars.
  c.ellipse(15.5, 14, 10, 10, (i, j, u, v) => {
    const d = Math.hypot(u, v);
    const swirl = Math.sin(Math.atan2(v, u) * 2 + d * 7);
    if (u < -0.3 && v < -0.45 && d > 0.55 && d < 0.8) return "#ffffff";
    const t = 0.72 - (u + v) * 0.3 + swirl * 0.12 - Math.max(0, d - 0.85) * 1.5;
    return ramp(liquid, clamp(t), i, j);
  });
  for (const [sx, sy] of [
    [12, 11],
    [19, 16],
    [14, 18],
  ] as const) {
    c.px(sx, sy, "#fffbe0");
  }
  // Inner glow.
  for (let j = 8; j < 21; j++) for (let i = 9; i < 23; i++) if (Math.hypot(i - 16, j - 15) < 4 && bayer(i, j) < 0.3) c.px(i, j, liquid[4]!);
}
