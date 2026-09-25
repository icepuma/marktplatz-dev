import { type Canvas, type Color, mix, rng } from "./canvas";
import { type Figure, figure } from "./folk";
import { noise } from "./paint";
import { APPLES, basket, CLAY, fruitPile, GOLD, GREENS, IRON, ORANGES, PALE_WOOD, PLUMS, pot, type Ramp, WOOD } from "./props";

// Market stalls seen from high above: a striped canopy on four posts (you see its top), a merchant standing under
// its front edge, a counter whose top is laden with wares and whose front is hung with cloth, shelves behind.

export type Light = { x: number; y: number; r: number; color: Color; strength: number; ry?: number; flicker?: boolean };

export const CLOTH = {
  red: ["#5a1a22", "#8c2a30", "#b83e3e", "#d85a50", "#ee8068"],
  cream: ["#8a7a66", "#c8b89a", "#e4d6ba", "#f4ead4", "#fffaf0"],
  teal: ["#123a3e", "#1e5c5c", "#2a7c78", "#3e9c90", "#62bcaa"],
  gold: ["#6a4414", "#a86c1e", "#d8962e", "#f0bc4a", "#fad878"],
  purple: ["#2a1a4a", "#43307a", "#5c46a0", "#7a64c0", "#a08ada"],
  blue: ["#1a2a5a", "#28428a", "#3a5eb4", "#5a80d4", "#86a8ec"],
  green: ["#1a3a24", "#2a5a34", "#3e7a44", "#5a9a58", "#86bc76"],
} as const;

export type StallSpec = {
  x: number;
  gy: number;
  w: number;
  stripes: readonly [Ramp, Ramp];
  drape: Ramp;
  merchant: Figure;
  wares: (c: Canvas, x: number, y: number, w: number) => void;
  shelves: (c: Canvas, x: number, y: number, w: number) => void;
  seed: number;
};

function post(c: Canvas, x: number, y0: number, y1: number) {
  for (let y = y0; y <= y1; y++) {
    c.px(x, y, WOOD[2]!);
    c.px(x + 1, y, WOOD[4]!);
    c.px(x + 2, y, WOOD[3]!);
  }
}

/** Where a stall's merchant stands: the middle of their feet. */
export const merchantX = (s: StallSpec) => s.x + Math.round(s.w / 2) + ((s.seed * 7) % 9) - 4;
export const merchantY = (s: StallSpec) => s.gy - 18;

export function stall(c: Canvas, s: StallSpec, lights: Light[], night: boolean, breathe = false) {
  const { x, gy, w } = s;
  const r = rng(s.seed);
  // Back posts and the hanging behind the merchant.
  post(c, x + 2, gy - 84, gy - 36);
  post(c, x + w - 5, gy - 84, gy - 36);
  for (let y = gy - 78; y < gy - 38; y++) {
    for (let i = 5; i < w - 5; i++) {
      const fold = (i + Math.floor(noise(Math.floor(i / 5), 0, s.seed) * 3)) % 5;
      const k = fold === 0 ? 0 : fold === 4 ? 2 : 1;
      c.px(x + i, y, s.drape[k]!);
    }
  }
  // Shelves on the hanging.
  for (const sy of [gy - 64, gy - 50]) {
    for (let i = 5; i < w - 5; i++) {
      c.px(x + i, sy, PALE_WOOD[5]!);
      c.px(x + i, sy + 1, PALE_WOOD[3]!);
      c.px(x + i, sy + 2, WOOD[1]!);
    }
    s.shelves(c, x + 6, sy - 1, w - 12);
  }
  // The merchant.
  figure(c, merchantX(s), merchantY(s), s.merchant, breathe);
  r.int(-4, 4);
  // Front posts.
  post(c, x, gy - 66, gy - 12);
  post(c, x + w - 3, gy - 66, gy - 12);
  // Counter: top boards seen from above, front hung with cloth and a fringe.
  for (let y = gy - 24; y < gy - 12; y++) {
    for (let i = -1; i <= w; i++) {
      const board = (y - (gy - 24)) % 4 === 3;
      c.px(x + i, y, board ? PALE_WOOD[2]! : i > w - 3 ? PALE_WOOD[5]! : PALE_WOOD[4]!);
    }
  }
  for (let i = -1; i <= w; i++) c.px(x + i, gy - 12, PALE_WOOD[5]!);
  for (let y = gy - 11; y <= gy; y++) {
    for (let i = -1; i <= w; i++) {
      const band = (y - (gy - 11)) % 11;
      let color = s.drape[(i + 40) % 8 < 1 ? 1 : 2]!;
      if (band === 1 || band === 2) color = (i + y) % 4 < 2 ? GOLD[3]! : GOLD[2]!;
      if (y === gy) color = (i & 1) === 0 ? s.drape[0]! : "#00000000".slice(0, 7);
      if (y === gy && (i & 1) === 1) continue;
      c.px(x + i, y, color);
    }
  }
  s.wares(c, x + 1, gy - 22, w - 2);
  // Canopy: striped cloth seen from above, rising toward the back, with a scalloped valance.
  const back = gy - 90;
  const front = gy - 68;
  for (let y = back; y < front; y++) {
    const t = (y - back) / (front - back);
    for (let i = -4; i < w + 4; i++) {
      const stripe = Math.floor((i + 40) / 7) % 2;
      const pal = s.stripes[stripe]!;
      const seam = (i + 40) % 7 === 0;
      let k = t < 0.2 ? 2 : t < 0.7 ? 3 : 4;
      if (seam) k -= 1;
      // Soft folds run down the cloth: each stripe bellies out, lit on its right shoulder.
      const across = ((i + 40) % 7) / 6;
      if (!seam && across > 0.6 && t > 0.25) k = Math.min(4, k + 1);
      if (!seam && across < 0.2 && t > 0.15) k = Math.max(1, k - 1);
      if (y === back) k = 1;
      // A sag between the posts catches a little shadow.
      if (Math.abs(i - w / 2) < w * 0.3 && t > 0.3 && t < 0.55 && k > 2) k -= 1;
      c.px(x + i, y, pal[k]!);
    }
  }
  for (let i = -4; i < w + 4; i++) {
    const stripe = Math.floor((i + 40) / 7) % 2;
    const pal = s.stripes[stripe]!;
    const sc = (i + 40) % 7;
    const drop = sc === 0 || sc === 6 ? 2 : sc === 1 || sc === 5 ? 4 : 5;
    for (let j = 0; j < drop; j++) c.px(x + i, front + j, j === drop - 1 ? pal[0]! : pal[j === 0 ? 4 : 2]!);
  }
  // Finials on the front posts.
  for (const px of [x, x + w - 3]) {
    c.rect(px, front - 4, 3, 3, GOLD[3]!);
    c.px(px + 2, front - 4, GOLD[5]!);
  }
  if (night) {
    // A lantern hangs from the canopy's edge.
    const lx = x + w - 12;
    const ly = front + 6;
    c.vline(lx, front + 3, ly - 1, IRON[1]!);
    c.ellipse(lx, ly + 3, 3, 4, (_, __, u, v) => (u + v < -0.2 ? "#fff4c0" : "#ffb44a"));
    lights.push({ x: lx, y: ly + 3, r: 44, color: "#ffb45a", strength: 1, ry: 32, flicker: true });
  }
}

// ---------------------------------------------------------------- wares

/** Potion bottles of many colours, lit from the right. */
export function bottles(c: Canvas, x: number, y: number, w: number, seed: number) {
  const r = rng(seed);
  const liquids = [
    ["#6a0e2a", "#b02a4a", "#e45a78"],
    ["#0e3a6a", "#2a6ab8", "#6aa8f0"],
    ["#1e5a1e", "#3a9a3a", "#8ae06a"],
    ["#5a3a0e", "#c88a1e", "#f8d060"],
    ["#3a1a5a", "#7a3ab0", "#c08af0"],
  ];
  for (let bx = x; bx < x + w - 4; bx += r.int(5, 7)) {
    const [d, m, l] = r.pick(liquids);
    const h = r.int(6, 9);
    const round = r.chance(0.5);
    for (let j = 0; j < h; j++) {
      const neck = j < 3;
      const half = neck ? 0.5 : round ? 1.8 : 1.5;
      for (let i = -2; i <= 2; i++) {
        if (Math.abs(i) > half + 0.2) continue;
        let color = neck ? "#cfe6ec" : i < 0 ? d! : i === 0 ? m! : l!;
        if (!neck && j === 3) color = mix(color, "#ffffff", 0.2);
        c.px(bx + 2 + i, y - h + j, color);
      }
    }
    c.px(bx + 2, y - h - 1, "#8a5a36"); // cork
    c.px(bx + 3, y - h + 4, "#ffffff"); // glint
  }
}

/** A row of books on a shelf, spines of many colours. */
export function books(c: Canvas, x: number, y: number, w: number, seed: number) {
  const r = rng(seed);
  const spines = [CLOTH.red, CLOTH.blue, CLOTH.green, CLOTH.purple, CLOTH.gold, CLOTH.teal];
  for (let bx = x; bx < x + w - 2; ) {
    const bw = r.int(2, 3);
    const h = r.int(7, 10);
    const pal = r.pick(spines);
    for (let i = 0; i < bw; i++) for (let j = 0; j < h; j++) c.px(bx + i, y - h + j, pal[i === bw - 1 ? 3 : 2]!);
    c.hline(bx, bx + bw - 1, y - h + 2, GOLD[3]!);
    c.hline(bx, bx + bw - 1, y - 3, GOLD[2]!);
    bx += bw + (r.chance(0.15) ? 1 : 0);
  }
}

/** Jars and pots in a row. */
export function jars(c: Canvas, x: number, y: number, w: number, seed: number) {
  const r = rng(seed);
  for (let jx = x + 3; jx < x + w - 3; jx += r.int(7, 9)) pot(c, jx, y, r.int(2, 3), r.int(5, 7), r.chance(0.5) ? CLAY : ["#1a2a3a", "#2a4a5a", "#3a6a7a", "#5a8a94", "#7aaab0", "#a8ccd0"]);
}

/** Fruit and vegetable baskets for a greengrocer's counter. */
export function produce(c: Canvas, x: number, y: number, w: number) {
  const piles = [APPLES, ORANGES, GREENS, PLUMS];
  let k = 0;
  for (let bx = x + 7; bx < x + w - 6; bx += 15) basket(c, bx, y + 8, 13, 5, fruitPile(piles[k++ % piles.length]!));
}

/** Scrolls, a crystal ball and an open tome: the wizard's wares. */
export function arcana(c: Canvas, x: number, y: number, w: number) {
  // Open book.
  for (let j = 0; j < 6; j++) {
    for (let i = 0; i < 14; i++) {
      const page = i === 6 || i === 7 ? "#c8b898" : j < 5 ? (i < 7 ? "#f4ead4" : "#fffaf0") : "#8a5a36";
      c.px(x + 4 + i, y + 3 + j, page);
    }
  }
  for (let i = 0; i < 5; i++) {
    c.px(x + 5 + i, y + 5, "#8a8aa0");
    c.px(x + 9 + i, y + 6, "#8a8aa0");
  }
  // Crystal ball on a stand.
  const bx = x + Math.round(w / 2);
  c.ellipse(bx, y + 3, 5, 5, (_, __, u, v) => {
    if (u > 0.2 && v < -0.2 && u - v > 0.8) return "#ffffff";
    return u + v < -0.4 ? "#c8b8f8" : u + v < 0.4 ? "#8a6ae0" : "#4a2a9a";
  });
  c.rect(bx - 3, y + 8, 7, 2, GOLD[2]!);
  c.hline(bx - 3, bx + 3, y + 8, GOLD[4]!);
  // Scrolls.
  for (let k = 0; k < 3; k++) {
    const sx = x + w - 22 + k * 6;
    for (let j = 0; j < 3; j++) c.hline(sx, sx + 4, y + 4 + j + (k % 2), j === 0 ? "#fff6e0" : j === 1 ? "#e8d8b8" : "#b8a080");
    c.px(sx + 2, y + 5 + (k % 2), "#b02a2a");
  }
}

export { GOLD, IRON };
