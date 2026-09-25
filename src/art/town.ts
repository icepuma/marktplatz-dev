import { type Canvas, type Color, mix, rng } from "./canvas";
import { ashlar, awning, barrelTiles, beam, brace, chimney, door, hangingSign, plaster, ROOF, SHUTTER, scales, slates, TIMBER, WALL, wallLantern, window } from "./buildings";
import { noise, smooth } from "./paint";
import { FONT } from "./sprites";

// The three houses along the back of the square: a bakery, the guild hall with its clock, and a tavern. Each is
// drawn as one layer; `lights` collects the lamps and windows that glow at night.

/** A light source for the night pass; `flicker` marks flames the site animates, drawn at `glowY` if given. */
export type Light = { x: number; y: number; r: number; color: Color; strength: number; ry?: number; flicker?: boolean; glowY?: number };

export const TOWN_GY = 126; // the ground line all three houses stand on

/** The flue tops of the chimneys, where the site lets smoke rise (bakery, then the tavern's two). */
export const CHIMNEYS = [
  { x: 82, y: 16 },
  { x: 256, y: 20 },
  { x: 331, y: 24 },
] as const;

const pretzel = (c: Canvas, x: number, y: number) => {
  const dough = ["#6a3a1c", "#a8622a", "#d89a4a"];
  const P = ["..111..111", ".12.21122.", "12...2..21", "12..222.21", ".12.2.2.2.", "..22...22."];
  P.forEach((row, j) => [...row].forEach((k, i) => k !== "." && c.px(x + i, y + j, dough[Number(k)]!)));
};

const mug = (c: Canvas, x: number, y: number) => {
  const M = ["2222..", "3443..", "3443..", "34433.", "3443.3", "34433.", "3443..", "1111.."];
  const pal = ["", "#5a3a22", "#fff6e0", "#c89a3a", "#f0c860"];
  M.forEach((row, j) => [...row].forEach((k, i) => k !== "." && c.px(x + 1 + i, y + j - 1, pal[Number(k)]!)));
};

/** The bakery: barrel-tile roof, half-timbered upper floor, a striped awning over the shop window. */
export function bakery(c: Canvas, lights: Light[], night: boolean) {
  const x0 = -8;
  const x1 = 110;
  const gy = TOWN_GY;
  const wallTop = gy - 68;
  const floor = gy - 36;
  // Roof: the front slope rises from the eave to the ridge; tiles run down the slope.
  const eave = wallTop + 4;
  const ridge = wallTop - 44;
  barrelTiles(c, x0 - 4, ridge, x1 - x0 + 8, eave - ridge, ROOF.terracotta, 3);
  for (let i = x0 - 4; i < x1 + 4; i++) {
    // Ridge: a row of rounded cap tiles.
    const cap = (i - x0 + 40) % 5;
    c.px(i, ridge - 1, cap === 0 ? ROOF.terracotta[1]! : ROOF.terracotta[4]!);
    c.px(i, ridge - 2, cap === 0 ? ROOF.terracotta[2]! : cap < 3 ? ROOF.terracotta[5]! : ROOF.terracotta[3]!);
    c.px(i, ridge - 3, cap === 1 || cap === 2 ? ROOF.terracotta[4]! : ROOF.terracotta[0]!);
    // Eave: the open ends of the barrel tiles, then the fascia.
    const u = (i - (x0 - 4)) % 6;
    c.px(i, eave - 1, u === 0 ? ROOF.terracotta[0]! : u === 2 || u === 3 ? "#3a1a1e" : ROOF.terracotta[3]!);
    c.px(i, eave, u === 0 ? ROOF.terracotta[0]! : ROOF.terracotta[u === 4 ? 4 : 2]!);
    c.px(i, eave + 1, TIMBER[0]!);
  }
  // Walls.
  plaster(c, x0, wallTop + 2, x1 - x0, gy - wallTop - 2, WALL.cream, 11);
  // Shadow of the eave on the wall.
  eaveShadow(c, x0, x1, wallTop + 2, WALL.cream);
  // Timber frame on the upper floor.
  beam(c, x0, floor - 3, x1 - x0, 4);
  for (const bx of [x0 + 2, x0 + 40, x0 + 78, x1 - 5]) beam(c, bx, wallTop + 2, 4, floor - wallTop - 3);
  brace(c, x0 + 6, floor - 4, x0 + 22, wallTop + 6);
  brace(c, x1 - 6, floor - 4, x1 - 22, wallTop + 6);
  window(c, x0 + 52, wallTop + 11, 14, 14, 4, { shutters: SHUTTER.green, box: true, lit: night });
  window(c, x0 + 12 + 14, wallTop + 11, 10, 14, 5, { shutters: SHUTTER.green, box: true, lit: night });
  window(c, x0 + 90, wallTop + 11, 10, 14, 6, { shutters: SHUTTER.green, box: true, lit: night, cat: true });
  // Ground floor: stone plinth, shop window under an awning, door.
  ashlar(c, x0, gy - 7, x1 - x0, 7, 2);
  window(c, x0 + 14, floor + 12, 34, 14, 7, { lit: night, curtain: "#d8b870" });
  awning(c, x0 + 10, floor + 1, 42, 7, [
    ["#6a1e22", "#a8303a", "#cc4a4a", "#e46a5e"],
    ["#8a7a66", "#d8c8a8", "#efe2c6", "#fbf4e2"],
  ]);
  door(c, x0 + 70, floor + 8, 14, 28, 9);
  hangingSign(c, x0 + 58, floor + 2, 14, 11, pretzel);
  const lamp = wallLantern(c, x0 + 92, floor + 10);
  lights.push({ x: lamp.x, y: lamp.y, r: 26, color: "#ffb45a", strength: 0.9, flicker: true });
  // Chimney with a dormer beside it.
  chimney(c, x0 + 86, ridge + 6, 8, 12);
  dormer(c, x0 + 30, ridge + 16, 16, night);
  if (night) {
    lights.push({ x: x0 + 31, y: floor + 19, r: 34, color: "#ffb45a", strength: 0.7, ry: 18 });
    lights.push({ x: x0 + 59, y: wallTop + 18, r: 16, color: "#ffb45a", strength: 0.5 });
  }
}

/** The shadow the eaves throw on a wall: a solid band, then a dithered fringe. */
function eaveShadow(c: Canvas, x0: number, x1: number, y: number, pal: readonly Color[]) {
  for (let i = x0; i < x1; i++) {
    c.px(i, y, pal[1]!);
    c.px(i, y + 1, pal[1]!);
    c.px(i, y + 2, pal[2]!);
    if (i % 2 === 0) c.px(i, y + 3, pal[2]!);
  }
}

/** A small dormer window set into a roof slope: its own little tiled roof and a window. */
function dormer(c: Canvas, x: number, y: number, w: number, night: boolean) {
  const h = 12;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) c.px(x + i, y + j, WALL.cream[j < 3 ? 2 : 3]!);
  window(c, x + 4, y + 3, w - 8, 7, 9, { lit: night });
  // Its roof: a little gable seen from above.
  for (let j = 0; j < 7; j++) {
    for (let i = -2; i < w + 2; i++) {
      const edge = j === 6;
      c.px(x + i, y - 7 + j, edge ? ROOF.terracotta[1]! : i < w / 2 ? ROOF.terracotta[3]! : ROOF.terracotta[4]!);
    }
  }
  for (let i = -2; i < w + 2; i++) c.px(x + i, y - 1, ROOF.terracotta[0]!);
}

/** The guild hall: a front gable with a clock, slate roof planes receding back, an arcade on the ground floor. */
export function guildHall(c: Canvas, lights: Light[], night: boolean) {
  const x0 = 110;
  const x1 = 232;
  const cx = (x0 + x1) / 2;
  const gy = TOWN_GY;
  const wallTop = gy - 74;
  const peak = wallTop - 34;
  const half = (x1 - x0) / 2 + 5;
  // Roof planes seen from above, receding from the gable edges toward the top of the frame.
  const onGable = (x: number) => wallTop - ((half - Math.abs(x - cx)) / half) * (wallTop - peak);
  slates(c, x0 - 5, -40, x1 - x0 + 10, peak + 40 + (wallTop - peak), ROOF.slate, 13, (x, y) => y < onGable(x) - 2);
  // The right plane faces the sun: lift it a step.
  for (let y = 0; y < wallTop; y++) {
    for (let x = Math.ceil(cx); x < x1 + 5; x++) {
      const col = c.get(x, y);
      if (col && y < onGable(x) - 2) c.px(x, y, mix(col, "#cfe0f8", 0.18));
    }
  }
  for (let y = -2; y < peak; y++) {
    c.px(Math.round(cx), y, ROOF.slate[5]!); // ridge
    c.px(Math.round(cx) - 1, y, ROOF.slate[1]!);
  }
  // The gable wall: plaster in a triangle, trimmed by bargeboards.
  for (let y = peak; y < wallTop + 2; y++) {
    for (let x = x0; x < x1; x++) {
      const inside = y >= onGable(x) + 1;
      if (!inside) continue;
      c.px(x, y, noise(x, y, 4) < 0.05 ? WALL.rose[2]! : WALL.rose[3]!);
    }
  }
  for (let x = x0 - 5; x < x1 + 5; x++) {
    const y = Math.round(onGable(x));
    c.px(x, y - 1, TIMBER[3]!);
    c.px(x, y, TIMBER[2]!);
    c.px(x, y + 1, TIMBER[0]!);
  }
  // Clock in the gable.
  clock(c, Math.round(cx), wallTop - 12, 9);
  // Upper floor: plaster with a timber frame and three windows.
  plaster(c, x0, wallTop + 2, x1 - x0, 34, WALL.rose, 21);
  beam(c, x0, wallTop, x1 - x0, 3);
  beam(c, x0, wallTop + 34, x1 - x0, 4);
  for (const bx of [x0, x0 + 38, x1 - 42, x1 - 4]) beam(c, bx, wallTop + 2, 4, 32);
  for (const wx of [x0 + 14, Math.round(cx) - 7, x1 - 28]) window(c, wx, wallTop + 9, 14, 16, wx, { shutters: SHUTTER.blue, box: true, lit: night, flowers: ["#f06a8a", "#ffe07a", "#ffffff"] });
  // Ground floor: an arcade of three stone arches opening onto a dim hall.
  const arcTop = wallTop + 38;
  ashlar(c, x0, arcTop, x1 - x0, gy - arcTop, 31);
  const bay = (x1 - x0) / 3;
  for (let k = 0; k < 3; k++) {
    const ax = Math.round(x0 + k * bay + 6);
    const aw = Math.round(bay - 12);
    const ay = arcTop + 6;
    for (let y = ay; y < gy; y++) {
      for (let x = ax; x < ax + aw; x++) {
        const dx = (x + 0.5 - (ax + aw / 2)) / (aw / 2);
        const dy = (ay + aw / 2 - y) / (aw / 2);
        if (y < ay + aw / 2 && dx * dx + dy * dy > 1) continue;
        const depth = (y - ay) / (gy - ay);
        c.px(x, y, night ? mix("#3a2418", "#8a5a30", depth) : mix("#1e1826", "#4a3a44", depth * 0.8));
      }
    }
    // Voussoirs: a ring of lit blocks around the arch.
    for (let t = 0; t <= 1; t += 0.02) {
      const a = Math.PI * (1 - t);
      const x = Math.round(ax + aw / 2 + Math.cos(a) * (aw / 2 + 1));
      const y = Math.round(ay + aw / 2 - Math.sin(a) * (aw / 2 + 1));
      c.px(x, y, Math.floor(t * 9) % 2 === 0 ? "#c4b8b6" : "#a99ca0");
      c.px(x, y - 1, "#6f6270");
    }
    if (night) lights.push({ x: ax + aw / 2, y: gy - 10, r: 30, color: "#ffaa50", strength: 0.75, ry: 20 });
  }
  // The market's name, carved and gilded on a board over the arcade.
  signBoard(c, Math.round(cx), wallTop + 32, "MARKTPLATZ");
}

/** A dark wooden sign board with a gilt edge and gilt capitals from the pixel font, centred on cx. */
function signBoard(c: Canvas, cx: number, y: number, text: string) {
  const w = text.length * 6 + 7;
  const x = Math.round(cx - w / 2);
  const h = 13;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      const inner = i === 1 || j === 1 || i === w - 2 || j === h - 2;
      c.px(x + i, y + j, edge ? TIMBER[0]! : inner ? (j === 1 || i === w - 2 ? "#f4c24c" : "#a8701e") : j < 4 ? TIMBER[2]! : TIMBER[1]!);
    }
  }
  [...text].forEach((ch, k) => {
    const glyph = FONT[ch];
    if (!glyph) return;
    glyph.forEach((row, j) =>
      [...row].forEach((bit, i) => {
        if (bit !== "#") return;
        const px = x + 4 + k * 6 + i;
        const py = y + 3 + j;
        c.px(px, py, j < 2 ? "#ffe690" : j < 5 ? "#f4c24c" : "#d89a2e");
        if (!glyph[j + 1]?.[i] || glyph[j + 1]![i] !== "#") c.px(px, py + 1, "#3a1e14"); // cut shadow under each stroke
      }),
    );
  });
  // Iron hangers.
  c.px(x + 3, y - 1, "#2a2632");
  c.px(x + w - 4, y - 1, "#2a2632");
}

function clock(c: Canvas, cx: number, cy: number, r: number) {
  c.ellipse(cx, cy, r + 1, r + 1, "#6a4a2a");
  c.ellipse(cx, cy, r, r, (_, __, u, v) => (u + v < -0.6 ? "#fffaf0" : "#f0e6d0"));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    c.px(Math.round(cx + Math.cos(a) * (r - 1.5)), Math.round(cy + Math.sin(a) * (r - 1.5)), k % 3 === 0 ? "#3a2a2a" : "#b0a080");
  }
  c.line(cx, cy, cx, cy - r + 3, "#2a2030");
  c.line(cx, cy, cx + 3, cy + 1, "#2a2030");
  c.px(cx, cy, "#c89a3a");
}

/** The tavern: fish-scale shingles, sky-blue plaster, a wooden balcony with plants and a mug sign. */
export function tavern(c: Canvas, lights: Light[], night: boolean) {
  const x0 = 232;
  const x1 = 354;
  const gy = TOWN_GY;
  const wallTop = gy - 66;
  const floor = gy - 34;
  const eave = wallTop + 4;
  const ridge = wallTop - 40;
  scales(c, x0 - 4, ridge, x1 - x0 + 8, eave - ridge, ROOF.teal, 5);
  // The slope catches more sun near the ridge and falls into shade toward the eave; lichen here and there.
  for (let y = ridge; y < eave; y++) {
    const t = (y - ridge) / (eave - ridge);
    for (let x = x0 - 4; x < x1 + 4; x++) {
      const col = c.get(x, y);
      if (!col) continue;
      let out = t < 0.3 ? mix(col, "#d8f4e8", (0.3 - t) * 0.5) : t > 0.7 ? mix(col, "#10282c", (t - 0.7) * 0.6) : col;
      if (smooth(x, y * 2, 7, 44) > 0.84 && noise(x, y, 45) < 0.35) out = mix(out, "#a8b06a", 0.35);
      c.px(x, y, out);
    }
  }
  for (let i = x0 - 4; i < x1 + 4; i++) {
    const cap = (i - x0 + 40) % 4;
    c.px(i, ridge - 1, cap === 0 ? ROOF.teal[1]! : ROOF.teal[4]!);
    c.px(i, ridge - 2, cap === 0 ? ROOF.teal[2]! : ROOF.teal[5]!);
    c.px(i, ridge - 3, cap === 0 ? ROOF.teal[0]! : ROOF.teal[3]!);
    c.px(i, eave, TIMBER[1]!);
    c.px(i, eave + 1, TIMBER[0]!);
  }
  plaster(c, x0, wallTop + 2, x1 - x0, gy - wallTop - 2, WALL.sky, 41);
  eaveShadow(c, x0, x1, wallTop + 2, WALL.sky);
  ashlar(c, x0, gy - 7, x1 - x0, 7, 43);
  // Upper windows and a balcony.
  window(c, x0 + 12, wallTop + 10, 12, 15, x0 + 13, { shutters: SHUTTER.red, lit: night, curtain: "#e8d8b0" });
  window(c, x0 + 50, wallTop + 10, 12, 15, x0 + 51, { shutters: SHUTTER.red, lit: night });
  window(c, x0 + 90, wallTop + 10, 12, 15, x0 + 91, { shutters: SHUTTER.red, closed: !night });
  balcony(c, x0 + 40, floor - 6, 36);
  // Ground floor: a big door, a window, the sign.
  door(c, x0 + 22, floor + 6, 16, 28, 44);
  window(c, x0 + 60, floor + 12, 22, 12, 45, { lit: night, box: true, flowers: ["#ffffff", "#ffd0e0", "#b8e0ff"] });
  window(c, x0 + 94, floor + 12, 14, 12, 46, { lit: night });
  hangingSign(c, x0 + 42, floor + 4, 12, 12, mug);
  const lamp = wallLantern(c, x0 + 14, floor + 8);
  lights.push({ x: lamp.x, y: lamp.y, r: 26, color: "#ffb45a", strength: 0.9, flicker: true });
  chimney(c, x0 + 20, ridge + 4, 8, 12);
  chimney(c, x0 + 96, ridge + 8, 7, 10);
  if (night) {
    lights.push({ x: x0 + 71, y: floor + 18, r: 30, color: "#ffb45a", strength: 0.7, ry: 16 });
    lights.push({ x: x0 + 56, y: wallTop + 17, r: 18, color: "#ffb45a", strength: 0.5 });
  }
}

function balcony(c: Canvas, x: number, y: number, w: number) {
  // Floor boards seen from above, then balusters and a rail.
  for (let i = -1; i <= w; i++) {
    c.px(x + i, y + 6, TIMBER[3]!);
    c.px(x + i, y + 7, TIMBER[2]!);
    c.px(x + i, y + 8, TIMBER[0]!);
  }
  for (let i = 0; i < w; i += 3) {
    for (let j = 0; j < 6; j++) c.px(x + i, y + j, j === 0 ? TIMBER[4]! : TIMBER[2]!);
  }
  for (let i = -1; i <= w; i++) {
    c.px(x + i, y - 1, TIMBER[4]!);
    c.px(x + i, y, TIMBER[3]!);
  }
  // Pots of geraniums on the rail.
  const r = rng(x);
  for (let i = 2; i < w - 4; i += 9) {
    const px = x + i + r.int(0, 2);
    c.rect(px, y - 4, 4, 3, "#b8583a");
    c.hline(px, px + 3, y - 4, "#d8764a");
    for (let k = 0; k < 6; k++) c.px(px + r.int(-1, 4), y - 5 - r.int(0, 2), r.pick(["#4f7a35", "#6a9a40", "#e24a5a", "#ff7a8a"]));
  }
}
