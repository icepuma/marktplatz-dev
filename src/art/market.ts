import { Canvas, type Color, grade, hex, luminance, mix, multiply, outlineOf, rgb, rng, screen } from "./canvas";
import { noise, smooth } from "./paint";
import { cellEdge, cliffFace, GRASS, grass, surf, insideDistance, lawn, Mask, ringStones, SAND, sand, SEA, slabs, STONE, STONE_COOL, STONE_TERRA, stoneAt } from "./terrain";
import { broadleaf, cypress, fern, flowerBed, flowers, hedge, ivy, shrub } from "./flora";
import { type Figure, figure } from "./folk";
import { APPLES, barrel, basket, bench, cat, crate, dog, fountain, fruitPile, gull, handcart, jetty, lampPost, lanternString, noticeBoard, ORANGES, pigeon, planter, pot, railing, rowboat, sack, signpost, spyglass, tavernTable } from "./props";
import { arcana, books, bottles, CLOTH, jars, merchantX, merchantY, produce, stall, type StallSpec } from "./stalls";
import { bakery, CHIMNEYS, guildHall, type Light, TOWN_GY, tavern } from "./town";
import { cloud, island, openSea, sail, sky, sun } from "./vista";

// The market square, painted like a Sea of Stars town: a steep top-down view where the ground fills the frame and
// walls face the camera. Town houses line the back on the left; on the right the square ends at a railing over
// the sea, with the sky, the sun and far islands beyond; in the front corner the ground drops away as a cliff
// of stone columns to the harbour. Every object is its own outlined layer, sorted by the ground line it stands
// on, and casts a shadow sheared from its own silhouette (the sun is up and to the right; shadows fall left).

export type TimeOfDay = "day" | "night";

export const MARKET_WIDTH = 640;
export const MARKET_HEIGHT = 360;
const W = MARKET_WIDTH;
const H = MARKET_HEIGHT;

/** Where the sun (by day) and the moon (by night) hang; the site makes it clickable. */
export const CELESTIAL = { x: 552, y: 30, r: 16 } as const;

const TOWN_END = 352; // the houses run from the left edge to here
const RIM = 118; // the back edge of the square, over the sea
const HORIZON = 62;
const FOUNTAIN = { x: 332, y: 240 } as const;

/** The cliff in the front right corner: screen y of its top edge at x. */
const CLIFF_X = 450;
const cliffEdge = (x: number) => Math.round(362 - (x - CLIFF_X) * 0.56);
const CLIFF_H = 46;

// ---------------------------------------------------------------- scene objects

/** A light source that the night pass turns on. */
export type Glow = { x: number; y: number; r: number; color: Color; strength: number; ry?: number };

type Entity = {
  /** Screen y of the ground line the object stands on: objects are drawn back (small) to front (large). */
  gy: number;
  draw: (c: Canvas) => void;
  /** How the object casts its shadow: sheared from its silhouette (default), a custom mask, or none. */
  shadow?: false | ((m: ShadowMask) => void);
  /** The pose that casts the shadow, when `draw` is an animation frame (shadows stay still). */
  silhouette?: (c: Canvas) => void;
  outline?: number;
  /** Tall objects darken toward the ground they stand on (ambient occlusion), this many pixels up. */
  ao?: number;
  glows?: Glow[];
};

/** Ground shadow coverage in [0, 1] per pixel. */
class ShadowMask {
  readonly data = new Float32Array(W * H);
  add(x: number, y: number, t = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    this.data[i] = Math.max(this.data[i]!, t);
  }
  at(x: number, y: number) {
    return x < 0 || y < 0 || x >= W || y >= H ? 0 : this.data[y * W + x]!;
  }
}

/** Shadow direction: per pixel of height, the shadow moves this far on screen. */
const SHEAR = { x: -0.5, y: 0.3 } as const;

/** Casts a layer's silhouette onto the ground as if it stood upright on the line y = gy. */
function castSprite(m: ShadowMask, l: Canvas, gy: number, strength = 1) {
  if (l.maxX < l.minX) return;
  const solid = (x: number, y: number) => l.inside(x, y) && l.data[(y * l.width + x) * 4 + 3] !== 0;
  const hMax = gy - l.minY;
  const x0 = Math.floor(l.minX + SHEAR.x * hMax) - 1;
  const x1 = Math.ceil(l.maxX) + 1;
  for (let dy = gy; dy <= gy + Math.ceil(hMax * SHEAR.y) + 1; dy++) {
    for (let dx = x0; dx <= x1; dx++) {
      // Inverse map: which height h and source x land here? Sample a few heights on this row.
      const h0 = (dy - gy) / SHEAR.y;
      for (let k = 0; k <= Math.ceil(1 / SHEAR.y); k++) {
        const h = h0 + k;
        if (h < 0 || h > hMax) continue;
        const sx = Math.round(dx - SHEAR.x * h);
        const sy = Math.round(gy - h);
        if (solid(sx, sy)) {
          m.add(dx, dy, strength);
          break;
        }
      }
    }
  }
}

/** Paints `draw` on a fresh transparent layer the size of the scene. */
function paintLayer(draw: (l: Canvas) => void): Canvas {
  const l = new Canvas(W, H);
  draw(l);
  return l;
}

/** Gives a layer's silhouette the selective dark outline, then composites it onto the scene. */
function composite(c: Canvas, l: Canvas, outline = 1) {
  if (l.maxX < l.minX) return;
  const solid = (x: number, y: number) => l.inside(x, y) && l.data[(y * l.width + x) * 4 + 3] !== 0;
  if (outline > 0) {
    const edges: [number, number][] = [];
    for (let y = l.minY; y <= l.maxY; y++) {
      for (let x = l.minX; x <= l.maxX; x++) {
        if (solid(x, y) && (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1))) edges.push([x, y]);
      }
    }
    for (const [x, y] of edges) {
      const col = l.get(x, y)!;
      l.px(x, y, mix(col, outlineOf(col), outline));
    }
  }
  for (let y = l.minY; y <= l.maxY; y++) {
    for (let x = l.minX; x <= l.maxX; x++) {
      const i = (y * W + x) * 4;
      if (l.data[i + 3] !== 0) c.px(x, y, l.get(x, y));
    }
  }
}

/** The shadow of a wall of height `h` standing along the ground line gy from x0 to x1. */
function wallShadow(m: ShadowMask, x0: number, x1: number, gy: number, h: number) {
  const dx = SHEAR.x * h;
  const dy = SHEAR.y * h;
  for (let y = gy; y <= gy + dy; y++) {
    const t = (y - gy) / dy;
    for (let x = Math.floor(x0 + dx * t); x <= x1 + dx * t; x++) m.add(x, y);
  }
}

// ---------------------------------------------------------------- ground

type Ground = { lawn: Mask; plaza: Mask; vista: (x: number, y: number) => boolean; cliffTop: Int16Array };

function plan(): Ground {
  const vista = (x: number, y: number) => x >= TOWN_END && y < RIM;
  const cliffTop = new Int16Array(W).fill(H + 10);
  for (let x = CLIFF_X; x < W; x++) cliffTop[x] = cliffEdge(x);
  const inGround = (x: number, y: number) => !vista(x, y) && y < cliffTop[x]!;
  const lawnAt = (x: number, y: number) => {
    const n = (smooth(x, y, 14, 41) - 0.5) * 0.5;
    const bl = ((x - 30) / 120) ** 2 + ((y - 360) / 96) ** 2 + n < 1; // bottom left
    const rim = ((x - 616) / 70) ** 2 + ((y - 140) / 26) ** 2 + n < 1; // by the railing
    const tl = ((x + 4) / 64) ** 2 + ((y - 190) / 44) ** 2 + n < 1; // under the big tree
    return inGround(x, y) && (bl || rim || tl);
  };
  const plazaAt = (x: number, y: number) => {
    const n = (smooth(x, y, 18, 43) - 0.5) * 0.3;
    const u = (x - FOUNTAIN.x) / 262;
    const v = (y - FOUNTAIN.y) / 112;
    const sidewalk = y >= 126 && y < 146 && x < TOWN_END + 20;
    return inGround(x, y) && (u * u + v * v + n < 1 || sidewalk);
  };
  return { lawn: Mask.of(W, H, lawnAt), plaza: Mask.of(W, H, plazaAt), vista, cliffTop };
}

function paintGround(c: Canvas, g: Ground) {
  const flags = slabs(19, 13, 17, 0.45);
  const rings = ringStones(FOUNTAIN.x, FOUNTAIN.y, 0.78, [30, 38, 44, 54, 60, 70, 76], 5);
  const RING_PALETTES = [STONE, STONE, STONE_TERRA, STONE, STONE_COOL, STONE, STONE_TERRA];
  const edgeDist = insideDistance(g.plaza);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g.vista(x, y) || y >= g.cliffTop[x]!) continue;
      let color: Color;
      // Behind the houses: shady gardens.
      if (x < TOWN_END && y < 60) {
        c.px(x, y, grass(x, y, -0.8));
        continue;
      }
      const ring = rings(x, y);
      // A worn lane runs from the town down past the fountain, and across to the stalls.
      const lane = Math.max(0, 1 - Math.abs(x - FOUNTAIN.x - (y - FOUNTAIN.y) * 0.15) / 34) * 0.5 + Math.max(0, 1 - Math.abs(y - 262 - (x - 330) * 0.1) / 20) * 0.35;
      if (ring > 0 && ring !== -2) color = stoneAt(x, y, rings, 5, RING_PALETTES[Math.floor(ring / 256)] ?? STONE, lane * 0.4);
      else if (g.plaza.has(x, y)) {
        const d = edgeDist[y * W + x]!;
        const slab = flags(x, y);
        // Toward its edges the paving crumbles into the sand: grout fills with sand, whole slabs go missing.
        const crumble = Math.max(0, 1 - d / 14);
        const missing = noise(slab, 7, 17) < crumble * 0.75;
        const edge = cellEdge(x, y, flags);
        if (missing) color = sand(x, y);
        else if (edge === "grout" && noise(x, y, 19) < crumble * 1.6) color = noise(x, y, 20) < 0.5 ? SAND.base : SAND.dark;
        else {
          color = stoneAt(x, y, flags, 17, STONE, lane);
          // Dust gathers on slabs near the sand.
          if (crumble > 0.2 && noise(x, y, 21) < crumble * 0.25) color = mix(color, SAND.base, 0.6);
        }
        // Weeds sprout in the joints near the edges.
        if (edge === "grout" && crumble > 0.1 && noise(x, y, 22) < 0.08) color = noise(x, y, 23) < 0.5 ? GRASS.mid : GRASS.dark;
      } else color = sand(x, y);
      c.px(x, y, color);
    }
  }
  lawn(c, g.lawn);
  // Wildflowers and ferns in the grass.
  const r = rng(77);
  for (let k = 0; k < 60; k++) {
    const x = r.int(0, W - 1);
    const y = r.int(130, H - 1);
    if (!g.lawn.has(x, y) || !g.lawn.has(x, y + 6) || !g.lawn.has(x, y - 6)) continue;
    if (r.chance(0.35)) fern(c, x, y, 7, k);
    else flowers(c, x, y, 3, k);
  }
  // Stepping stones across the lawn, and a flower bed.
  for (const [sx, sy] of [
    [18, 346],
    [34, 338],
    [52, 332],
    [72, 328],
    [94, 326],
  ] as const) {
    c.ellipse(sx, sy, 5, 3, (_, __, u, v) => (u * u + v * v > 0.7 ? "#6e6272" : v < -0.2 ? STONE.high : u > 0.3 ? STONE.light : STONE.base[0]!));
    c.hline(sx - 4, sx + 4, sy + 3, "#3a3a2a");
  }
  flowerBed(c, 16, 286, 34, 10, 5);
  // Fallen leaves drifting under the big tree.
  for (let k = 0; k < 70; k++) {
    const x = Math.round(50 + r.range(-70, 80));
    const y = Math.round(214 + r.range(-18, 30));
    if (g.vista(x, y)) continue;
    const leaf = r.pick(["#c8862a", "#a8641e", "#8fb34c", "#d8a040", "#6f9641"]);
    c.px(x, y, leaf);
    if (r.chance(0.5)) c.px(x + 1, y, mix(leaf, "#3a2a1a", 0.4));
  }
  puddle(c, 404, 322, 13, 4);
  puddle(c, 212, 262, 8, 3);
}

/** A rain puddle mirroring the sky, with a bright rim of reflected light. */
function puddle(c: Canvas, cx: number, cy: number, rx: number, ry: number) {
  c.ellipse(cx, cy, rx, ry, (x, y, u, v) => {
    const wob = (noise(x, y, 5) - 0.5) * 0.3;
    if (u * u + v * v + wob > 0.9) return null;
    if (v < -0.5) return "#5a6a8a";
    if ((x + y) % 7 === 0 && v > 0) return "#ffffff";
    return u > 0.3 ? "#bcd8f0" : v < 0 ? "#7e9cc4" : "#9cbce0";
  });
}

/** Grass creeping to the edge of the harbour cliff, its blades hanging over the rim of the stones. */
function grassLip(c: Canvas) {
  for (let x = CLIFF_X; x < W; x++) {
    // Find the top of the cliff at this x: the first outline pixel below the sand.
    let top = -1;
    for (let y = cliffEdge(x) - 8; y < cliffEdge(x) + 8; y++) {
      if (c.get(x, y) === "#43202a") {
        top = y;
        break;
      }
    }
    if (top < 0) continue;
    const n = noise(x, 0, 71);
    const band = 3 + Math.round(smooth(x, 0, 9, 72) * 5);
    for (let y = top - band; y < top; y++) c.px(x, y, grass(x, y, 0.2));
    c.px(x, top - band - 1, n < 0.5 ? GRASS.mid : GRASS.light);
    if (n < 0.55) {
      c.px(x, top, GRASS.dark);
      if (n < 0.3) c.px(x, top + 1, GRASS.dark);
      if (n < 0.12) c.px(x + (n < 0.06 ? 1 : -1), top + 2, GRASS.deep);
    }
  }
}

/** The lip along the back edge of the square, where the ground ends over the sea. */
function rimLip(c: Canvas) {
  for (let x = TOWN_END; x < W; x++) {
    c.px(x, RIM - 1, "#5b4a4e");
    c.px(x, RIM, STONE.high);
    c.px(x, RIM + 1, STONE.light);
    c.px(x, RIM + 2, noise(x, 0, 3) < 0.5 ? STONE.base[0] : STONE.dark);
  }
}

/** Shadow of a low round object (a basin): its outline shifted along the sun. */
function ellipseShadow(m: ShadowMask, cx: number, cy: number, rx: number, ry: number) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) m.add(x, y);
    }
  }
}

/** A convex polygon on the ground. */
function polyShadow(m: ShadowMask, pts: [number, number][]) {
  const c = new Canvas(W, H);
  c.poly(pts, "#000000");
  for (let y = Math.max(0, c.minY); y <= Math.min(H - 1, c.maxY); y++) for (let x = Math.max(0, c.minX); x <= Math.min(W - 1, c.maxX); x++) if (c.get(x, y)) m.add(x, y);
}

/** Where a point at height h above the ground point (x, z) casts its shadow. */
const cast = (x: number, z: number, h: number): [number, number] => [x + SHEAR.x * h, z + SHEAR.y * h];

function stallShadow(m: ShadowMask, s: StallSpec) {
  const { x, gy, w } = s;
  polyShadow(m, [cast(x - 4, gy - 36, 50), cast(x + w + 4, gy - 36, 50), cast(x + w + 4, gy - 22, 44), cast(x - 4, gy - 22, 44)]);
  polyShadow(m, [cast(x - 1, gy - 12, 12), cast(x + w, gy - 12, 12), cast(x + w, gy, 12), [x + w, gy], [x - 1, gy], cast(x - 1, gy, 12)]);
}

const glowAt = (p: { x: number; y: number }): Light => ({ x: p.x, y: p.y + 12, r: 64, color: "#ffc070", strength: 1.15, ry: 46, flicker: true, glowY: p.y });

const look = (skin: Figure["look"]["skin"], hair: readonly [Color, Color, Color], cloth: readonly [Color, Color, Color], more: Partial<Figure["look"]> = {}): Figure["look"] => ({ skin, hair, cloth, ...more });
const HAIRS = {
  brown: ["#4a2e22", "#7a4e32", "#a8764a"],
  black: ["#18121a", "#2a2026", "#44363c"],
  blond: ["#8a5a24", "#d09a3e", "#f4d070"],
  red: ["#7a2a1a", "#b8482a", "#e8784a"],
  grey: ["#6a6a7a", "#a8a8b8", "#e0e0ea"],
  blue: ["#1e2c5a", "#34508e", "#5a82c4"],
} as const;

const STALLS: StallSpec[] = [
  {
    x: 116,
    gy: 214,
    w: 88,
    stripes: [CLOTH.red, CLOTH.cream],
    drape: CLOTH.teal,
    merchant: { look: look("tan", HAIRS.black, CLOTH.teal.slice(1, 4) as never, { hat: CLOTH.red.slice(1, 4) as never }), hair: "bun", outfit: "dress", hat: "scarf" },
    wares: (c, x, y, w) => bottles(c, x + 2, y + 9, w - 4, 3),
    shelves: (c, x, y, w) => bottles(c, x, y, w, 4),
    seed: 1,
  },
  {
    x: 470,
    gy: 222,
    w: 96,
    stripes: [CLOTH.purple, CLOTH.gold],
    drape: CLOTH.blue,
    merchant: { look: look("fair", HAIRS.grey, CLOTH.blue.slice(1, 4) as never, { hat: CLOTH.purple.slice(1, 4) as never }), hair: "crop", outfit: "robe", hat: "wizard", extras: ["beard"] },
    wares: (c, x, y, w) => arcana(c, x + 2, y, w - 4),
    shelves: (c, x, y, w) => books(c, x, y, w, 7),
    seed: 2,
  },
  {
    x: 156,
    gy: 338,
    w: 96,
    stripes: [CLOTH.green, CLOTH.cream],
    drape: CLOTH.gold,
    merchant: { look: look("brown", HAIRS.brown, CLOTH.green.slice(1, 4) as never, { hat: ["#5a4a2a", "#7a6a3a", "#9a8a5a"] }), hair: "crop", outfit: "tunic", hat: "cap" },
    wares: (c, x, y, w) => produce(c, x, y, w),
    shelves: (c, x, y, w) => jars(c, x, y, w, 9),
    seed: 3,
  },
];

const PROPS: [number, (c: Canvas) => void][] = [
  // Around the potion stall.
  [214, (c) => barrel(c, 206, 214)],
  [219, (c) => barrel(c, 214, 219, 12, 14, (cc, cx, cy, rx) => fruitPile(APPLES)(cc, cx, cy + 1, rx))],
  [216, (c) => crate(c, 98, 216)],
  [222, (c) => sack(c, 104, 222, 11, 12, "#e8d8a8")],
  // Around the wizard's stall.
  [224, (c) => crate(c, 568, 224, 14, 10, 7)],
  [214, (c) => crate(c, 570, 214, 12, 9, 6)],
  [226, (c) => pot(c, 588, 226, 5, 11)],
  // Around the greengrocer.
  [340, (c) => barrel(c, 256, 340)],
  [343, (c) => basket(c, 146, 343, 14, 6, fruitPile(ORANGES))],
  [331, (c) => handcart(c, 262, 331)],
  // Along the houses and the railing.
  [134, (c) => planter(c, 2, 134, 22, 1)],
  [134, (c) => planter(c, 84, 134, 20, 2, ["#ffffff", "#ffe07a", "#b8e0ff"])],
  [150, (c) => bench(c, 380, 150, 30)],
  [148, (c) => tavernTable(c, 316, 148)],
  [152, (c) => dog(c, 344, 152)],
  [158, (c) => noticeBoard(c, 424, 158, 5)],
  [130, (c) => spyglass(c, 566, 130)],
  [136, (c) => pot(c, 358, 136, 5, 10)],
  [276, (c) => signpost(c, 470, 276)],
  // Pigeons round the fountain, and the fountain's cat.
  [282, (c) => pigeon(c, 286, 282, 1, true)],
  [286, (c) => pigeon(c, 296, 286, -1)],
  [280, (c) => pigeon(c, 372, 280, -1, true)],
  [273, (c) => cat(c, 300, 264)],
];

const FOLK: [number, number, Figure][] = [
  // The party, looking at the fountain.
  [306, 300, { look: look("fair", HAIRS.blond, ["#1e3a6a", "#2f5aa8", "#5a86d0"]), hair: "spiky", outfit: "tunic", back: true }],
  [324, 304, { look: look("tan", HAIRS.blue, ["#5a2a4a", "#8a3a6a", "#b85a8a"], { hat: ["#2a2a5a", "#3e3e7a", "#5a5aa0"] }), hair: "long", outfit: "cloak", back: true }],
  [344, 300, { look: look("brown", HAIRS.brown, ["#6a4a1a", "#a0702a", "#d09a3a"]), hair: "ponytail", outfit: "tunic", back: true, extras: ["bag"] }],
  // Shoppers at the stalls.
  [150, 232, { look: look("fair", HAIRS.red, ["#3a5a2a", "#5a7a3a", "#7a9a4a"]), hair: "long", outfit: "dress", back: true, extras: ["basket"] }],
  [508, 240, { look: look("deep", HAIRS.black, ["#3a2a5a", "#5a4a7a", "#7a6a9a"]), hair: "curly", outfit: "robe", back: true }],
  [200, 358, { look: look("fair", HAIRS.brown, ["#7a3a2a", "#a85a3a", "#d07a4a"]), hair: "bun", outfit: "dress", back: true }],
  // A guard by the railing, an old man on the bench, chatter by the tavern.
  [606, 150, { look: look("tan", HAIRS.black, ["#6a2a2a", "#9a3a34", "#c05048"], { trim: ["#5a5a6a", "#9a9aaa", "#d0d0e0"] }), hair: "crop", outfit: "surcoat", hat: "helmet" }],
  [394, 146, { look: look("fair", HAIRS.grey, ["#4a4a5a", "#6a6a7a", "#8a8a9a"]), hair: "bald", outfit: "robe", extras: ["mustache"] }],
  [262, 154, { look: look("tan", HAIRS.black, ["#6a5a3a", "#8a7a50", "#aa9a6a"], { hat: ["#8a6a2a", "#c8a04a", "#ecd07a"] }), hair: "crop", outfit: "tunic", hat: "straw" }],
  [279, 152, { look: look("fair", HAIRS.blond, ["#2a5a6a", "#3a7a8a", "#5a9aaa"], { accent: ["#c8b89a", "#efe4cc", "#fffaf0"] }), hair: "ponytail", outfit: "dress", flip: true }],
  // Children and passers-by.
  [100, 262, { look: look("brown", HAIRS.black, ["#2a6a6a", "#3a8a84", "#5aaa9e"]), hair: "spiky", outfit: "tunic" }],
  [412, 268, { look: look("fair", HAIRS.blond, ["#8a2a3a", "#b83e4a", "#e06a6a"]), hair: "bun", outfit: "dress", flip: true }],
  [492, 286, { look: look("tan", HAIRS.brown, ["#3a3a2a", "#56563a", "#76764e"], { hat: ["#2a3a2a", "#3e5a3a", "#5a7a50"] }), hair: "crop", outfit: "cloak", hat: "hood" }],
  [410, 334, { look: look("deep", HAIRS.black, ["#8a5a1a", "#c08a2a", "#e8b84a"]), hair: "curly", outfit: "dress", extras: ["basket"] }],
];


// ---------------------------------------------------------------- the scene

const painted = new Map<string, { canvas: Canvas; lights: Light[] }>();

/**
 * Paints the square by day or night. `frame` (0-3) is the animation frame: townsfolk breathe on odd frames, the
 * fountain splashes and the sea glitters from frame to frame. Frame 0 is the still picture. Results are cached,
 * since the animation sheets are cut from the same paintings.
 */
export function paintMarket(time: TimeOfDay, frame = 0): Canvas {
  return render(time, frame).canvas;
}

/** The light sources of the night scene: where lanterns, lamps and windows glow. */
export function sceneLights(time: TimeOfDay): Light[] {
  return render(time, 0).lights;
}

/**
 * The wizard merchant's portrait for the shop's dialog box: his bust cut straight from the daylight painting (hat,
 * face, beard and sash, with his bookshelf behind), so it is always the same wizard as the one at his stall. 36x36,
 * scaled 4x.
 */
export function portrait(): Canvas {
  const S = 36;
  const wizard = STALLS.find((s) => s.merchant.hat === "wizard")!;
  const scene = paintMarket("day");
  // The wizard's hat tip is 43 rows above his feet; one row of shelf shows above it.
  const left = merchantX(wizard) - S / 2;
  const top = merchantY(wizard) - 44;
  const c = new Canvas(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) c.px(x, y, scene.get(left + x, top + y));
  return c.scale(4);
}

function render(time: TimeOfDay, frame: number) {
  const key = `${time}-${frame}`;
  const done = painted.get(key);
  if (done) return done;
  const result = paintScene(time, frame);
  painted.set(key, result);
  return result;
}

function paintScene(time: TimeOfDay, frame: number): { canvas: Canvas; lights: Light[] } {
  const c = new Canvas(W, H);
  const g = plan();

  // The far view: sky, sun, islands, the sea. Whatever stays open sky is remembered, so the night can paint its
  // own sky there.
  sky(c, TOWN_END, W, 0, HORIZON);
  const bare = c.clone();
  if (time === "day") sun(c, CELESTIAL.x, CELESTIAL.y, CELESTIAL.r);
  island(c, 410, HORIZON, 34, 16, 3, 0.55);
  island(c, 470, HORIZON, 18, 9, 4, 0.62);
  island(c, 628, HORIZON, 40, 20, 5, 0.5);
  const skyMask = Mask.of(W, H, (x, y) => x >= TOWN_END && y < HORIZON && c.get(x, y) === bare.get(x, y));
  openSea(c, TOWN_END, W, HORIZON, RIM - 1, CELESTIAL.x, frame);
  sail(c, 500, 80, 0.35);
  sail(c, 590, 70, 0.5);

  // The square and the harbour cliff.
  paintGround(c, g);
  rimLip(c);
  for (let y = 0; y < H; y++) for (let x = CLIFF_X; x < W; x++) if (y >= g.cliffTop[x]!) c.px(x, y, harbour(x, y, frame));
  surf(c, CLIFF_X, cliffFace(c, CLIFF_X, W, cliffEdge, CLIFF_H, 23), 23);
  grassLip(c);
  rowboat(c, 612, 346 + (frame === 1 || frame === 2 ? 1 : 0), 36, 12);
  jetty(c, 624, 318, 20, 6);

  // Everything standing on the square.
  const night = time === "night";
  const breathe = frame % 2 === 1;
  const lights: Light[] = [];
  const entities: Entity[] = [
    { gy: 22, draw: (l) => hedge(l, -10, TOWN_END + 6, 6, 3), shadow: false },
    { gy: 23, draw: (l) => hedge(l, -2, TOWN_END + 2, 16, 8), shadow: false },
    { gy: TOWN_GY, ao: 16, draw: (l) => bakery(l, lights, night), shadow: (m) => wallShadow(m, -8, 110, TOWN_GY, 68) },
    { gy: TOWN_GY, ao: 16, draw: (l) => guildHall(l, lights, night), shadow: (m) => wallShadow(m, 110, 232, TOWN_GY, 74) },
    { gy: TOWN_GY, ao: 16, draw: (l) => tavern(l, lights, night), shadow: (m) => wallShadow(m, 232, 354, TOWN_GY, 66) },
    { gy: RIM + 7, draw: (l) => railing(l, TOWN_END - 2, W + 4, RIM + 7, 9) },
    { gy: RIM + 12, draw: (l) => cypress(l, 368, RIM + 12, 46, 3) },
    { gy: RIM + 14, draw: (l) => cypress(l, 626, RIM + 14, 52, 4) },
    { gy: 212, draw: (l) => broadleaf(l, 50, 212, 70, 7) },
    { gy: 316, draw: (l) => shrub(l, 118, 316, 26, 3, ["#f4a0b0", "#ffffff"]) },
    { gy: 352, draw: (l) => shrub(l, 110, 356, 30, 4) },
    { gy: 262, draw: (l) => shrub(l, 8, 262, 24, 5, ["#ffd65a", "#ffffff"]) },
    { gy: 150, draw: (l) => shrub(l, 548, 152, 22, 6, ["#8ab4f0", "#ffffff"]) },
    { gy: TOWN_GY + 1, shadow: false, draw: (l) => { ivy(l, 104, TOWN_GY, 44, 3); ivy(l, 238, TOWN_GY, 30, 5); ivy(l, 348, TOWN_GY, 52, 7); } },
    {
      gy: FOUNTAIN.y + 32,
      draw: (l) => void fountain(l, FOUNTAIN.x, FOUNTAIN.y, 38, 27, 5, frame),
      shadow: (m) => ellipseShadow(m, FOUNTAIN.x + SHEAR.x * 8, FOUNTAIN.y + 4 + SHEAR.y * 8, 38, 27),
    },
    ...STALLS.map((s) => ({ gy: s.gy, ao: 8, draw: (l: Canvas) => stall(l, s, lights, night, breathe), shadow: (m: ShadowMask) => stallShadow(m, s) })),
    { gy: 196, draw: (l) => void lights.push(glowAt(lampPost(l, 246, 196, 44, night))) },
    { gy: 306, draw: (l) => void lights.push(glowAt(lampPost(l, 432, 306, 44, night))) },
    ...PROPS.map(([gy, draw]) => ({ gy, draw })),
    { gy: 108, draw: (l) => gull(l, 418, 104, false), shadow: false },
    { gy: 108, draw: (l) => gull(l, 530, 104, false), shadow: false },
    {
      gy: TOWN_GY + 2,
      shadow: false,
      draw: (l) => {
        for (const [x0, y0, x1, y1, sag] of [
          [-4, 84, 110, 88, 7],
          [110, 88, 232, 88, 8],
          [232, 88, 352, 92, 7],
        ] as const)
          for (const p of lanternString(l, x0, y0, x1, y1, sag, x0 + 7, night)) lights.push({ x: p.x, y: p.y, r: 16, color: "#ffb45a", strength: 0.55, flicker: true });
      },
    },
    {
      gy: 223,
      shadow: false,
      draw: (l) => {
        for (const p of lanternString(l, 352, 96, 472, 136, 14, 91, night)) lights.push({ x: p.x, y: p.y, r: 16, color: "#ffb45a", strength: 0.55, flicker: true });
      },
    },
    ...FOLK.map(([x, gy, f]) => ({ gy, draw: (l: Canvas) => figure(l, x, gy, f, breathe), silhouette: (l: Canvas) => figure(l, x, gy, f), outline: 0 })),
  ];
  const layers = entities.map((e) => ({ e, l: paintLayer(e.draw) }));

  // Cast shadows and contact shadows, onto the ground only.
  const shade = new ShadowMask();
  const contact = new ShadowMask();
  for (const { e, l } of layers) {
    if (e.shadow === false) continue;
    const still = e.silhouette ? paintLayer(e.silhouette) : l;
    if (e.shadow) e.shadow(shade);
    else castSprite(shade, still, e.gy);
    footprint(contact, still, e.gy);
  }
  const soft = blur(shade.data, 1);
  const ao = blur(blur(contact.data, 2), 2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (g.vista(x, y) || y >= g.cliffTop[x]!) continue;
      const i = y * W + x;
      const t = Math.min(1, soft[i]! * 0.85 + ao[i]! * 0.5);
      if (t <= 0.01) continue;
      const base = c.get(x, y)!;
      c.px(x, y, mix(base, multiply(base, "#5a4a88"), 0.78 * t));
    }
  }

  // Then the objects, back to front.
  layers.sort((a, b) => a.e.gy - b.e.gy);
  for (const { e, l } of layers) {
    if (e.ao) occlude(l, e.gy, e.ao);
    composite(c, l, e.outline ?? 1);
  }

  if (night) nightfall(c, lights, g, skyMask);
  else daylight(c, g);
  return { canvas: c, lights };
}

/** Darkens a layer toward the ground line it stands on. */
function occlude(l: Canvas, gy: number, height: number) {
  for (let y = Math.max(l.minY, gy - height); y <= Math.min(l.maxY, gy + 2); y++) {
    const t = Math.min(1, (y - (gy - height)) / height) ** 1.6 * 0.4;
    for (let x = l.minX; x <= l.maxX; x++) {
      const col = l.get(x, y);
      if (col) l.px(x, y, mix(col, multiply(col, "#4a3a6a"), t));
    }
  }
}

/** Contact shadow: a dark smudge on the ground where an object meets it. */
function footprint(m: ShadowMask, l: Canvas, gy: number) {
  if (l.maxX < l.minX) return;
  for (let x = l.minX; x <= l.maxX; x++) {
    let touches = false;
    for (let y = gy - 3; y <= gy + 1 && !touches; y++) touches = l.inside(x, y) && l.data[(y * W + x) * 4 + 3] !== 0;
    if (!touches) continue;
    for (let y = gy - 1; y <= gy + 2; y++) m.add(x, y, 1);
    m.add(x - 1, gy + 1, 0.6);
  }
}

/** Box blur of a coverage map. */
function blur(src: Float32Array, radius: number): Float32Array {
  const pass = (a: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(a.length);
    const n = radius * 2 + 1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const sx = horizontal ? Math.min(W - 1, Math.max(0, x + k)) : x;
          const sy = horizontal ? y : Math.min(H - 1, Math.max(0, y + k));
          sum += a[sy * W + sx]!;
        }
        out[y * W + x] = sum / n;
      }
    }
    return out;
  };
  return pass(pass(src, true), false);
}

/** Daylight: warm light on what faces the sun, cool depth in the darks, a haze of sun over the sea, bloom. */
function daylight(c: Canvas, g: Ground) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const col = c.get(x, y);
      if (!col) continue;
      const lum = luminance(col);
      // Grade the town but leave the hazy far view soft.
      let out = g.vista(x, y) ? col : grade(col, 1.1, 0.3);
      if (lum > 0.55) out = screen(out, "#ffe2b0", (lum - 0.55) * 0.35);
      else if (lum < 0.3) out = mix(out, "#1c1638", (0.3 - lum) * 0.5);
      // The sun's warmth spills over the right half of the scene.
      const d = Math.hypot((x - CELESTIAL.x) / 420, (y - CELESTIAL.y) / 300);
      if (d < 1) out = screen(out, "#fff0cc", (1 - d) ** 2 * 0.22);
      c.px(x, y, out);
    }
  }
  c.bloom(0.86, 4, 0.4);
  c.light(CELESTIAL.x, CELESTIAL.y, 56, "#fff4d0", 0.45);
  // Soft shafts of sunlight slanting down from the sun across the square.
  const ang = Math.atan2(1, -0.62);
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const along = (x - CELESTIAL.x) * dx + (y - CELESTIAL.y) * dy;
      if (along < 0) continue;
      const across = -(x - CELESTIAL.x) * dy + (y - CELESTIAL.y) * dx;
      const band = Math.max(0, Math.sin(across / 23 + Math.sin(across / 61) * 2)) ** 6;
      const fade = Math.max(0, 1 - along / 520) * Math.min(1, along / 60);
      const t = band * fade * 0.12;
      if (t < 0.01) continue;
      const col = c.get(x, y);
      if (col) c.px(x, y, screen(col, "#fff2cc", t));
    }
  }
  void g;
}

/**
 * The night grade. Brightness keeps its order on a lifted curve (so the square stays readable and lit surfaces
 * still stand out, as in the game's nights), colour drains to under half, and what is left cools toward moonlight.
 * `far` things (the view over the sea) sit darker and bluer.
 */
function moonlit(col: Color, far = false): Color {
  const [r, g, b] = rgb(col);
  const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  const target = far ? 0.03 + 0.42 * lum ** 1.25 : 0.05 + 0.62 * lum ** 1.1;
  const keep = far ? 0.3 : 0.45;
  const grey = lum * 255;
  const rr = (grey + (r - grey) * keep) * 0.74;
  const gg = (grey + (g - grey) * keep) * 0.88;
  const bb = (grey + (b - grey) * keep) * 1.3;
  const k = target / Math.max(1e-4, (0.3 * rr + 0.59 * gg + 0.11 * bb) / 255);
  return hex([rr * k, gg * k, bb * k]);
}

/** The night sky over the sea: deep blue overhead, paling toward the horizon. */
const NIGHT_SKY = ["#0a1230", "#132048", "#1d3060", "#2c4876", "#3e5e86"] as const;

/** Night: moonlight over everything, then every lamp and window relights its surroundings. */
function nightfall(c: Canvas, lights: Light[], g: Ground, skyMask: Mask) {
  const day = c.clone();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (skyMask.has(x, y)) {
        const p = (y / HORIZON) * (NIGHT_SKY.length - 1);
        const k = Math.min(NIGHT_SKY.length - 2, Math.floor(p));
        c.px(x, y, mix(NIGHT_SKY[k]!, NIGHT_SKY[k + 1]!, p - k));
        continue;
      }
      const col = c.get(x, y);
      if (col) c.px(x, y, moonlit(col, g.vista(x, y)));
    }
  }
  // The night sky: stars, the moon and its path on the sea.
  const r = rng(99);
  for (let k = 0; k < 90; k++) {
    const x = r.int(TOWN_END, W - 1);
    const y = r.int(0, HORIZON - 4);
    if (Math.hypot(x - CELESTIAL.x, y - CELESTIAL.y) < CELESTIAL.r + 6) continue;
    const big = r.chance(0.15);
    c.px(x, y, big ? "#ffffff" : r.pick(["#c8d4ff", "#e8ecff", "#aab8f0"]));
    if (big) for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.px(x + i, y + j, "#7a88c8");
  }
  moon(c, CELESTIAL.x, CELESTIAL.y, CELESTIAL.r);
  for (let y = HORIZON + 2; y < RIM - 1; y++) {
    const spread = 4 + (y - HORIZON) * 0.35;
    for (let x = Math.round(CELESTIAL.x - spread); x <= CELESTIAL.x + spread; x++) {
      if (noise(x, y, 61) < 0.18 && y % 2 === 0) c.px(x, y, noise(x, y, 62) < 0.5 ? "#e8f0ff" : "#9ab0e0");
    }
  }
  for (const l of lights) {
    c.relight(day, l.x, l.y, l.r, "#ffd8a0", l.strength, l.ry ?? l.r);
    c.light(l.x, l.y, l.r * 0.6, l.color, 0.35 * l.strength, (l.ry ?? l.r) * 0.6);
  }
  c.bloom(0.62, 5, 0.8);
  // A light vignette, only in the far corners.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2));
      if (d < 0.85) continue;
      const col = c.get(x, y);
      if (col) c.px(x, y, mix(col, "#070a18", Math.min(0.3, (d - 0.85) * 0.8)));
    }
  }
}

/** A full moon with soft grey maria and a pale halo. */
function moon(c: Canvas, cx: number, cy: number, r: number) {
  c.ellipse(cx, cy, r + 6, r + 6, (x, y) => {
    const col = c.get(x, y);
    return col ? screen(col, "#8aa0e0", 0.25) : null;
  });
  c.ellipse(cx, cy, r, r, (x, y, u, v) => {
    const maria = smooth(x * 1.6, y * 1.6, 7, 5) > 0.62;
    const rim = u * u + v * v > 0.82;
    return rim ? "#d8e0f4" : maria ? "#cfd6ea" : u + v < -0.4 ? "#ffffff" : "#f2f4fc";
  });
}

/** The harbour water below the cliff: deep teal with short lit ripples. */
function harbour(x: number, y: number, frame: number): Color {
  if (y % 3 === 0) {
    const drift = x + (y * 7) % 11 + frame * 2;
    const cell = Math.floor(drift / 9);
    const local = drift % 9;
    if (local < 4 && noise(cell, y, 51) < 0.55) return noise(cell, y, 52) < 0.3 ? SEA.crest : SEA.light;
  }
  return smooth(x, y, 16, 53) > 0.6 ? SEA.mid : SEA.base;
}

// ---------------------------------------------------------------- animation

/** A looping animation cut from the painted frames: a region of the scene and the frames it cycles through. */
export type Loop = { id: string; x: number; y: number; w: number; h: number; frames: readonly number[]; ms: number };

export const LOOPS: readonly Loop[] = [
  ...FOLK.map(([x, gy], k) => ({ id: `folk-${k}`, x: x - 9, y: gy - 37, w: 18, h: 39, frames: [0, 1], ms: 1300 + ((k * 7) % 6) * 160 })),
  ...STALLS.map((s, k) => ({ id: `merchant-${k}`, x: merchantX(s) - 9, y: s.gy - 58, w: 18, h: 34, frames: [0, 1], ms: 1500 + k * 230 })),
  { id: "fountain", x: FOUNTAIN.x - 40, y: FOUNTAIN.y - 44, w: 80, h: 62, frames: [0, 1, 2, 3], ms: 560 },
  { id: "sea", x: TOWN_END, y: HORIZON + 1, w: W - TOWN_END, h: RIM - HORIZON - 2, frames: [0, 1, 2, 3], ms: 2400 },
  { id: "harbour", x: 536, y: 292, w: W - 536, h: H - 292, frames: [0, 1, 2, 3], ms: 2600 },
];

/** A sprite sheet for a loop: its frames cut from the paintings, side by side. */
export function loopSheet(time: TimeOfDay, loop: Loop): Canvas {
  const sheet = new Canvas(loop.w * loop.frames.length, loop.h);
  loop.frames.forEach((frame, k) => {
    const c = paintMarket(time, frame);
    for (let y = 0; y < loop.h; y++) {
      for (let x = 0; x < loop.w; x++) {
        const col = c.get(loop.x + x, loop.y + y);
        if (col) sheet.px(k * loop.w + x, y, col);
      }
    }
  });
  return sheet;
}

/** Clouds drift across the sky above the horizon as separate sprites. */
export const SKY_BOX = { x: TOWN_END, y: 0, w: W - TOWN_END, h: HORIZON - 4 } as const;
export const CLOUDS = [
  { id: "cloud-0", w: 74, h: 26, y: 12, ms: 150_000, delay: -40_000, seed: 11 },
  { id: "cloud-1", w: 56, h: 22, y: 30, ms: 110_000, delay: -85_000, seed: 12 },
  { id: "cloud-2", w: 40, h: 16, y: 4, ms: 190_000, delay: -150_000, seed: 13 },
] as const;

export function cloudSprite(time: TimeOfDay, id: string): Canvas {
  const spec = CLOUDS.find((c) => c.id === id)!;
  const c = new Canvas(spec.w, spec.h);
  cloud(c, spec.w / 2, spec.h * 0.72, spec.w * 0.84, spec.seed, 0.08);
  if (time === "night") for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.get(x, y)) c.px(x, y, moonlit(c.get(x, y)!, true));
  return c;
}

/** Gulls wheeling over the sea: a two-frame flap and the paths they fly. */
export const GULLS = [
  { y: 30, ms: 26_000, delay: -3_000, flap: 520 },
  { y: 40, ms: 31_000, delay: -17_000, flap: 610 },
  { y: 84, ms: 38_000, delay: -9_000, flap: 580 },
] as const;

export function gullSheet(time: TimeOfDay): Canvas {
  const c = new Canvas(14, 4);
  const WINGS = [
    ["o.....o", ".ow.wo.", "..owo..", "......."],
    ["...o...", "..owo..", ".ow.wo.", "o.....o"],
  ];
  WINGS.forEach((rows, k) => rows.forEach((row, j) => [...row].forEach((ch, i) => ch !== "." && c.px(k * 7 + i, j, ch === "o" ? "#5a5a6a" : "#ffffff"))));
  if (time === "night") for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (c.get(x, y)) c.px(x, y, moonlit(c.get(x, y)!, true));
  return c;
}

export { CHIMNEYS };

/** Fireflies drifting over the grass at night. */
export const FIREFLIES = [
  [22, 170], [70, 150], [104, 188], [30, 238], [8, 300], [60, 330], [112, 312], [140, 350],
  [590, 150], [620, 132], [560, 160], [452, 128], [380, 240], [240, 250],
] as const;
