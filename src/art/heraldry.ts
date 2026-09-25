import { Canvas, type Color, hash, mix, rng } from "./canvas";
import { clamp, cylinder, fill, lit, RAMPS, ramp, sphere } from "./paint";
import { FONT } from "./sprites";

// Art derived from ids, in the same style as the scene (one key light from the upper right, selective outlines):
// a coat of arms per guild (role) and an item icon per skill.

const TINCTURES = [RAMPS.cloth.red, RAMPS.cloth.blue, RAMPS.cloth.green, RAMPS.cloth.purple, RAMPS.cloth.teal];
const METALS = [RAMPS.gold, ["#4a4c66", "#72748e", "#9c9eb6", "#c6c8da", "#e8eaf4", "#ffffff"]];

export const SHIELD_WIDTH = 48;
export const SHIELD_HEIGHT = 56;

export function guildShield(id: string, name: string): Canvas {
  const c = new Canvas(SHIELD_WIDTH, SHIELD_HEIGHT);
  const r = rng(hash(id));
  const tincture = r.pick(TINCTURES);
  const metal = r.pick(METALS);
  const division = r.pick(["pale", "fess", "quarterly", "bend", "chevron", "plain", "saltire"] as const);

  const cx = 23.5;
  // Heater shield: straight sides, then a curved point. Positive inside, larger toward the centre.
  const edge = (x: number, y: number) => {
    if (y < 4 || y > 53) return -1;
    const u = Math.abs(x - cx) / 21.5;
    const limit = y < 28 ? 1 : 1 - ((y - 28) / 25.5) ** 1.8;
    return Math.min(limit - u, (y - 4) / 21.5);
  };
  const metalField = (x: number, y: number) => {
    const top = y < 25;
    const left = x < 24;
    switch (division) {
      case "pale":
        return !left;
      case "fess":
        return !top;
      case "quarterly":
        return top !== left;
      case "bend":
        return x - y <= -6;
      case "chevron":
        return y > 40 - Math.abs(x - cx) * 0.95 && y < 49 - Math.abs(x - cx) * 0.95;
      case "saltire":
        return Math.abs(x - cx - (y - 28)) < 3.5 || Math.abs(x - cx + (y - 28)) < 3.5;
      case "plain":
        return false;
    }
  };

  c.layer((l) => {
    for (let y = 0; y < SHIELD_HEIGHT; y++) {
      for (let x = 0; x < SHIELD_WIDTH; x++) {
        const e = edge(x, y);
        if (e < 0) continue;
        const u = (x - cx) / 22;
        const v = (y - 28) / 26;
        if (e <= 0.1) {
          // Bevelled gold rim: the outward-facing edge catches the light on the top and right.
          const nx = Math.sign(u) * Math.abs(u);
          const ny = y < 12 ? -1 : v;
          l.px(x, y, ramp(RAMPS.gold, lit(nx, ny, 0.5, 0.3) + (e > 0.05 ? -0.12 : 0.1)));
          continue;
        }
        const colors = metalField(x, y) ? metal : tincture;
        const diaper = Math.abs(((x + y) % 8) - 4) + Math.abs(((x - y + 64) % 8) - 4) === 4 ? -0.1 : 0;
        l.px(x, y, ramp(colors, sphere(u * 0.55, v * 0.55, 0.35) * 0.95 + diaper));
      }
    }
    // Division seams.
    for (let y = 1; y < SHIELD_HEIGHT - 1; y++) {
      for (let x = 1; x < SHIELD_WIDTH - 1; x++) {
        if (edge(x, y) <= 0.1 || edge(x + 1, y) <= 0.1 || edge(x, y + 1) <= 0.1) continue;
        if (metalField(x, y) !== metalField(x + 1, y) || metalField(x, y) !== metalField(x, y + 1)) l.px(x, y, mix(l.get(x, y)!, "#140c2a", 0.45));
      }
    }
    // Bevelled roundel with the guild's initial, embossed.
    l.ellipse(cx, 25, 11, 11, (_, __, u, v) => {
      const d = Math.hypot(u, v);
      if (d > 0.8) return ramp(RAMPS.gold, lit(u, v, 0.4, 0.3));
      return ramp(RAMPS.cloth.cream, sphere(u * 0.7, v * 0.7, 0.4));
    });
    const letter = FONT[name.trim()[0]?.toUpperCase() ?? ""] ?? FONT.M!;
    const ink = division === "plain" ? tincture : TINCTURES[1]!;
    letter.forEach((row, j) => {
      [...row].forEach((bit, i) => {
        if (bit !== "#") return;
        const lx = 19 + i * 2;
        const ly = 18 + j * 2;
        fill(l, lx - 1, ly + 1, 2, 2, (x, y) => mix(l.get(x, y)!, "#140c2a", 0.3));
        fill(l, lx, ly, 2, 2, (_, y) => ramp(ink, 0.4 - (y - ly) * 0.1 + (j < 2 ? 0.1 : 0)));
      });
    });
    // A glint on the upper right and rivets.
    for (let k = 0; k < 6; k++) l.px(38 - k, 8 + Math.floor(k / 2), k % 2 ? "#ffffff" : "#fff4c2");
    for (const [x, y] of [
      [7, 7],
      [40, 7],
      [7, 26],
      [40, 26],
    ] as const) {
      l.px(x, y, RAMPS.gold[5]!);
      l.px(x - 1, y + 1, RAMPS.gold[1]!);
    }
  });
  return c;
}

export const SKILL_SIZE = 32;

export function skillIcon(id: string): Canvas {
  const c = new Canvas(SKILL_SIZE, SKILL_SIZE);
  const r = rng(hash(id));
  const kind = r.pick(["potion", "scroll", "tome", "orb"] as const);
  const liquid = r.pick([RAMPS.cloth.red, RAMPS.cloth.green, RAMPS.cloth.blue, RAMPS.cloth.purple, RAMPS.cloth.gold, RAMPS.cloth.teal, RAMPS.cloth.orange]);
  c.layer((l) => ({ potion, scroll, tome, orb })[kind](l, liquid));
  // Magical sparkles.
  for (const [sx, sy, big] of [
    [r.pick([4, 27]), r.pick([4, 7]), true],
    [r.pick([5, 26]), r.pick([22, 26]), false],
  ] as const) {
    c.px(sx, sy, "#fffbe0");
    for (let d = 1; d <= (big ? 2 : 1); d++) {
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

const GLASS = ["#3a3e66", "#7a88b8", "#b8c8e8", "#e4eeff", "#ffffff"];

function potion(c: Canvas, liquid: readonly Color[]) {
  const cx = 15.5;
  const cy = 20;
  c.ellipse(cx, cy, 10, 10, (_, __, u, v) => {
    const s = sphere(u, v, 0.28);
    if (v < -0.25) return ramp(GLASS, s * 0.75 + 0.15);
    return ramp(liquid, s * 0.95);
  });
  for (let i = 7; i <= 24; i++) if (Math.abs(i - cx) < 8.5) c.px(i, 17, liquid[liquid.length - 1]!);
  for (const [bx, by] of [
    [13, 22],
    [18, 25],
    [16, 20],
  ] as const) {
    c.px(bx, by, liquid[liquid.length - 1]!);
  }
  fill(c, 20, 12, 2, 5, (_, j) => (j < 14 ? "#ffffff" : GLASS[3]!));
  // Neck, lip, cork and a twine tie.
  fill(c, 13, 6, 6, 5, (i) => ramp(GLASS, cylinder(((i - 13 + 0.5) / 6) * 2 - 1, 0.35) * 0.8 + 0.15));
  fill(c, 12, 9, 8, 2, (i) => ramp(GLASS, cylinder(((i - 12 + 0.5) / 8) * 2 - 1, 0.35)));
  fill(c, 13, 2, 6, 5, (i, j) => ramp(RAMPS.wood, cylinder(((i - 13 + 0.5) / 6) * 2 - 1, 0.3) + (j === 2 ? 0.1 : 0)));
  c.hline(12, 19, 5, RAMPS.rope[3]!);
  c.px(20, 6, RAMPS.rope[3]!);
  c.px(21, 7, RAMPS.rope[2]!);
  fill(c, 11, 21, 9, 5, (i, j) => (i === 11 || j === 25 ? "#d8c49c" : "#f8ecd0"));
  c.hline(12, 18, 23, liquid[1]!);
}

function scroll(c: Canvas, liquid: readonly Color[]) {
  const paper = RAMPS.cloth.cream;
  fill(c, 7, 6, 18, 20, (i) => ramp(paper, 0.55 + ((i - 7) / 18) * 0.35));
  for (let y = 9; y < 22; y += 2) for (let x = 9; x < 22 - (y % 4); x++) if ((x * 7 + y * 3) % 5 !== 0) c.px(x, y, "#6a5838");
  for (const y of [3, 24]) {
    fill(c, 5, y, 22, 4, (i, j) => ramp(paper, cylinder(((j - y + 0.5) / 4) * -2 + 1, 0.35) * 0.9 + ((i - 5) / 22) * 0.1));
    c.ellipse(5, y + 1.5, 1.5, 2, paper[1]!);
    c.ellipse(26, y + 1.5, 1.5, 2, paper[3]!);
  }
  fill(c, 18, 22, 3, 8, (i, j) => (j > 27 && i === 19 ? null : ramp(liquid, i === 20 ? 0.75 : 0.45)));
  c.ellipse(19.5, 22, 4, 4, (_, __, u, v) => (Math.hypot(u, v) > 0.8 ? liquid[1]! : ramp(liquid, sphere(u, v, 0.3))));
  c.px(21, 20, liquid[liquid.length - 1]!);
}

function tome(c: Canvas, liquid: readonly Color[]) {
  fill(c, 24, 5, 4, 23, (i, j) => ((j + i) % 2 === 0 ? "#fff6e0" : "#dccaa2"));
  fill(c, 5, 3, 20, 26, (i, j) => {
    if (i === 5) return liquid[1]!;
    const emboss = (i === 8 || i === 21 || j === 6 || j === 25) && i >= 8 && i <= 21 && j >= 6 && j <= 25;
    if (emboss) return RAMPS.gold[3]!;
    return ramp(liquid, 0.4 + ((i - 5) / 20) * 0.35 - ((j - 3) / 26) * 0.15);
  });
  for (const y of [7, 15, 23]) c.hline(5, 7, y, RAMPS.gold[2]!);
  for (const [x, y] of [
    [8, 6],
    [20, 6],
    [8, 24],
    [20, 24],
  ] as const) {
    fill(c, x, y, 2, 2, (i, j) => ramp(RAMPS.gold, i === x + 1 && j === y ? 1 : 0.6));
  }
  c.ellipse(14.5, 15.5, 4, 5, (_, __, u, v) => (Math.hypot(u, v) > 0.75 ? ramp(RAMPS.gold, lit(u, v, 0.4, 0.3)) : null));
  c.ellipse(14.5, 15.5, 2.5, 3.5, (_, __, u, v) => ramp(["#1a0a3a", "#4a1a8a", "#8a4ae0", "#d0a0ff", "#ffffff"], sphere(u, v, 0.3)));
  fill(c, 23, 13, 5, 5, (i, j) => ramp(RAMPS.gold, 0.5 + ((i - 23) / 5) * 0.4 - ((j - 13) / 5) * 0.2));
  c.px(25, 15, "#3a2a10");
}

function orb(c: Canvas, liquid: readonly Color[]) {
  fill(c, 9, 25, 14, 3, (i) => ramp(RAMPS.wood, cylinder(((i - 9 + 0.5) / 14) * 2 - 1, 0.3)));
  fill(c, 7, 28, 18, 2, (i) => ramp(RAMPS.wood, cylinder(((i - 7 + 0.5) / 18) * 2 - 1, 0.3) - 0.15));
  for (const x of [10, 15, 20]) fill(c, x, 21, 2, 5, (i, j) => ramp(RAMPS.gold, 0.9 - (j - 21) * 0.1 + (i - x) * 0.2));
  c.ellipse(15.5, 14, 10, 10, (_, __, u, v) => {
    const d = Math.hypot(u, v);
    const swirl = Math.sin(Math.atan2(v, u) * 2 + d * 7);
    if (u > 0.2 && v < -0.4 && d > 0.5 && d < 0.8) return "#ffffff";
    return ramp(liquid, clamp(sphere(u, v, 0.25) * 0.9 + swirl * 0.1));
  });
  for (const [sx, sy] of [
    [12, 11],
    [19, 16],
    [14, 18],
  ] as const) {
    c.px(sx, sy, "#fffbe0");
  }
}
