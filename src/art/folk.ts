import { type Canvas, type Color, mix } from "./canvas";

// Townsfolk in the proportions of Sea of Stars sprites: about 34px tall, a big head with 2px eyes and a glint,
// eyebrows, a compact body with arms, dark outlines. Figures are assembled from hand-drawn parts (a face, a
// hairstyle, an outfit, optional hats and extras) whose letters are looked up in the figure's palette. Parts are
// drawn lit from the right, where the sun is; `flip` mirrors a figure.
//
// Keys: o outline · s skin · S skin shade · k skin light · e eye · w eye glint · m mouth · r blush · n nose
//       h hair · H hair shade · j hair light · c cloth · C cloth shade · x cloth light
//       a accent · A accent shade · q accent light · p legs · P legs shade · b boots · B boots shade · v boots light
//       t trim/metal · T trim light · l trim shade · g hat · G hat shade · y hat light · d dark detail

export type Look = {
  skin: "fair" | "tan" | "brown" | "deep";
  hair: readonly [Color, Color, Color]; // shade, base, light
  cloth: readonly [Color, Color, Color];
  accent?: readonly [Color, Color] | readonly [Color, Color, Color];
  legs?: readonly [Color, Color];
  boots?: readonly [Color, Color] | readonly [Color, Color, Color];
  hat?: readonly [Color, Color, Color];
  trim?: readonly [Color, Color] | readonly [Color, Color, Color];
};

const SKIN = {
  fair: ["#c0786a", "#f2bc9a", "#ffdcc4"],
  tan: ["#a0604a", "#d99c72", "#f2bc90"],
  brown: ["#70402e", "#a86c4c", "#c98c64"],
  deep: ["#4a2626", "#7a4634", "#9a5e44"],
} as const;

const OUTLINE = "#1a1222";

export function palette(look: Look): Record<string, Color> {
  const [sS, s, k] = SKIN[look.skin];
  const [hS, h, hL] = look.hair;
  const [cS, c, cL] = look.cloth;
  const [aS, a, aL = mix(a, "#ffffff", 0.3)] = look.accent ?? ["#4a2e22", "#7a4e32", "#a8764a"];
  const [pS, p] = look.legs ?? ["#35304a", "#524a6a"];
  const [bS, b, bL = mix(b, "#ffffff", 0.25)] = look.boots ?? ["#2a1c1c", "#56382c", "#7a5440"];
  const [gS, g, gL] = look.hat ?? look.cloth;
  const [tS, t, tL = mix(t, "#ffffff", 0.45)] = look.trim ?? ["#8a6424", "#d8a840", "#fbe08a"];
  return {
    o: OUTLINE,
    s,
    S: sS,
    k,
    n: mix(sS, s, 0.4),
    e: "#1c1630",
    w: "#ffffff",
    m: mix(sS, "#5a1a22", 0.45),
    r: mix(s, "#e85a6a", 0.35),
    h,
    H: hS,
    j: hL,
    c,
    C: cS,
    x: cL,
    a,
    A: aS,
    q: aL,
    p,
    P: pS,
    b,
    B: bS,
    v: bL,
    g,
    G: gS,
    y: gL,
    t,
    T: tL,
    l: tS,
    d: "#2a2030",
  };
}

// A part is a list of rows placed at a row offset from the figure's top; spaces and dots are transparent.
type Part = { y: number; rows: readonly string[] };

const FACE: Part = {
  y: 5,
  rows: [
    "....oooooooooo....",
    "...osssssssssko...",
    "..oSsssssssssskko.",
    "..oSsHHssssHHskko.",
    ".oSSsewssssewskko.",
    ".oSSseesssseeskko.",
    ".oSSsrsssnsssrkko.",
    "..oSssssmmssskko..",
    "...oSSsssssssko...",
    "....ooSSSSSSoo....",
  ],
};

const BACK: Part = {
  y: 5,
  rows: [
    "....oooooooooo....",
    "...oHhhhhhhhhjo...",
    "..oHhhhhhhhhhhjoo.",
    "..oHhhhhhhhhhhjjjo",
    ".oHHhhhhhhhhhhjjjo",
    ".oSHhhhhhhhhhhhjko",
    ".oSHHhhhhhhhhhhjko",
    ".oSHHhhhhhhhhhhhko",
    "..oSHHHhhhhhhhhko.",
    "...oSSHHHHHHHSSo..",
    "....ooSSSSSSSoo...",
  ],
};

export const HAIR = {
  // A tousled crop with a swoop over the brow.
  crop: {
    y: 0,
    rows: [
      ".....oooooooo.....",
      "...oohhhhjjjhoo...",
      "..oHhhhhhjjjjhho..",
      ".oHHhhhhhhjjhhhjo.",
      ".oHHhhhhhhhhhhhjo.",
      ".oHHhhHhhhhhhhhho.",
      ".oHHoohhhhhhhhoohjo",
      "..oHo.oohhhoo.ojo.",
      "...o...........o..",
    ],
  },
  // Long hair falling past the shoulders.
  long: {
    y: 0,
    rows: [
      ".....oooooooo.....",
      "...oohhhhjjjhoo...",
      "..oHhhhhhjjjjhho..",
      ".oHHhhhhhhjjhhhjo.",
      ".oHHhhhhhhhhhhhjo.",
      "oHHHhhHhhhhhhhhhjo",
      "oHHooohhhhhhhoohjo",
      "oHHo.........ohjo.",
      "oHHo..........ohjo",
      "oHHo..........ohjo",
      "oHHo..........ohjo",
      "oHHo..........ohho",
      "oHHHo........ohhho",
      ".oHHo........ohho.",
      ".oHHHo......ohhho.",
      "..ooo........ooo..",
    ],
  },
  // A bun on top and neat sides.
  bun: {
    y: -3,
    rows: [
      ".......oooo.......",
      "......oHhjjo......",
      "......oHhhjo......",
      ".....ooooooooo....",
      "...oohhhhjjjhoo...",
      "..oHhhhhhhjjjhho..",
      ".oHHhhhhhhhhhhhjo.",
      ".oHHhhhhhhhhhhhjo.",
      ".oHHhhhhhhhhhhhjo.",
      ".oHHoohhhhhhhoohjo",
      ".oHo..........ojo.",
      "..o............o..",
    ],
  },
  // Spiky and wild.
  spiky: {
    y: -2,
    rows: [
      ".....o..o...o.....",
      "..o.ojoohjoojo.o..",
      "..ohohjjhhjjhhojo.",
      ".oHhhhjjhhhjjhhhjo",
      ".oHHhhhhhhhhhhhhjo",
      "oHHHhhhhhhhhhhhhhjo",
      ".oHHhhhhhhhhhhhhjo",
      ".oHHHhhhhhhhhhhhjo",
      ".oHHohhoohhhoohhjo",
      ".oHo.o....o....ojo",
      "..o.............o.",
    ],
  },
  // A long ponytail swinging behind.
  ponytail: {
    y: 0,
    rows: [
      ".....oooooooo.....",
      "...oohhhhjjjhoo...",
      "..oHhhhhhhjjjhho..",
      ".oHHhhhhhhhjjhhjo.",
      ".oHHhhhhhhhhhhhjo.",
      ".oHHhhHhhhhhhhhjoo",
      ".oHHoohhhhhhhoohjho",
      "..oHo.........ojhHo",
      "...o..........ojhHo",
      "...............ohHo",
      "...............ohHo",
      "................oo.",
    ],
  },
  // Soft curls.
  curly: {
    y: -1,
    rows: [
      "....oo.oooo.oo....",
      "...ohjoohjjohjo...",
      "..oHhhjhhhjjhhjo..",
      ".oHhHhhjhhhhjhhjo.",
      "oHHhhhhhhhhhhhhhjo",
      "oHhHhhhhhhhhhhhjho",
      "oHHhoohhhhhhoohjjo",
      "oHho..........ohjo",
      ".oHo..........ojo.",
      "..o............o..",
    ],
  },
  // A fringe of grey around a bald crown.
  bald: {
    y: 1,
    rows: [
      "....oooooooooo....",
      "...oSsssssskkko...",
      "..oSssssssskkkko..",
      ".oHSsssssssssskHo.",
      ".oHHsssssssssshjo.",
      ".oHHSsssssssssHjo.",
      ".oHHo........oHjo.",
    ],
  },
} satisfies Record<string, Part>;

export const HATS = {
  // A wizard's pointed hat with a wide brim and a gold band.
  wizard: {
    y: -13,
    rows: [
      "...........oo.....",
      "..........oyo.....",
      ".........oyGo.....",
      ".........oygo.....",
      "........oyggo.....",
      "........oyggGo....",
      ".......oyggggo....",
      ".......oygggGGo...",
      "......oyyggggGo...",
      "......oygggggGo...",
      ".....otTttttlllo..",
      "....oyyggggggGGo..",
      "..ooyyggggggggGGoo",
      ".oyyggggggggggGGGo",
      "oyGGGGGGGGGGGGGGGGo",
      ".oooooooooooooooo.",
    ],
  },
  // A soft cap with a short peak.
  cap: {
    y: -1,
    rows: [
      "....ooooooooo.....",
      "..ooGgggggggyyoo..",
      ".oGGggggggggyyyo..",
      ".oGgggggggggggyo..",
      ".oGgggggggggggggoo",
      "..oGGGGGGGGGGGGGGo",
      "...oooooooooooooo.",
    ],
  },
  // A headscarf knotted at the side.
  scarf: {
    y: -1,
    rows: [
      ".....oooooooo.....",
      "...ooGggggyyyoo...",
      "..oGGggggggyyyyo..",
      ".oGGggggggggggyyo.",
      "ooGGgggggggggggyo.",
      "oyoGGggggggggggGo.",
      "oGo.oooooooooo.oo.",
      ".o................",
    ],
  },
  // A guard's round iron helmet.
  helmet: {
    y: -1,
    rows: [
      ".....oooooooo.....",
      "...oollltttTToo...",
      "..olltttttttTTTo..",
      ".olltttttttttTTTo.",
      ".oltttttttttttTTo.",
      "olllllllllllllllllo",
      ".oooooooooooooooo.",
    ],
  },
  // A wide straw hat.
  straw: {
    y: -1,
    rows: [
      "......oooooo......",
      "....ooGgggyyoo....",
      "...oGGgggggyyyo...",
      "..oaaaaaaaaaaaqo..",
      "ooGGggggggggggyyoo",
      "oGGGGggggggggggyyo",
      ".oooooooooooooooo.",
    ],
  },
  // A cloak's hood, raised.
  hood: {
    y: -1,
    rows: [
      ".....oooooooo.....",
      "...ooGgggggyyoo...",
      "..oGGggggggggyyo..",
      ".oGGggggggggggyyo.",
      ".oGGgggoooooggyyo.",
      "oGGggo......oggyo.",
      "oGGgo........ogyo.",
      "oGGgo........ogyo.",
      "oGGgo........ogyo.",
      "oGGGo........oggo.",
      ".oGGo........ogo..",
    ],
  },
} satisfies Record<string, Part>;

export const OUTFITS = {
  // A tunic with a belt, sleeves, trousers and boots.
  tunic: {
    y: 15,
    rows: [
      "......oSSSSSo.....",
      "....ooCcccccxoo...",
      "...oCCcccccccxxo..",
      "..oCoCcccccccxoxo.",
      "..oCoCcccccccxoxo.",
      "..oCoCccccccccoxo.",
      "..oCoAaaaaqaaaoxo.",
      "..oSoCccccccccokso",
      "..oo.oCcccccxxo.o.",
      "....oCcccccccxxo..",
      "....oPpppoppppPo..",
      "....oPpppoppppPo..",
      "....oPpppopppPPo..",
      "....oBbbboBbbvbo..",
      "...oBbbbvoBbbbvvo.",
      "...ooooooooooooo..",
    ],
  },
  // A long robe with wide sleeves, a front trim and a sash.
  robe: {
    y: 15,
    rows: [
      "......oSSSSSo.....",
      "....ooCccttcxoo...",
      "...oCCcccttccxxo..",
      "..oCCoCcctccccoxxo",
      ".oCCCoCcctccccoxxxo",
      ".oCCCoCcctccccoxxxo",
      ".oSSoAaaaaaqaaaokko",
      "..ooCCccctcccxxoo.",
      "...oCCccctccccxo..",
      "...oCCccctccccxo..",
      "..oCCcccctcccccxo.",
      "..oCCcccctcccccxxo",
      "..oCCCccctcccccxxo",
      "..oCCCCCCCCCCCCCxo",
      "...oBbbooooooBvbo.",
      "...ooooo....oooo..",
    ],
  },
  // A dress with an apron.
  dress: {
    y: 15,
    rows: [
      "......oSSSSSo.....",
      "....ooCcccccxoo...",
      "...oCCcccccccxxo..",
      "..oCoCaaaaaaqxoxo.",
      "..oCoCaaaaaaqxoxo.",
      "..oCoCaaaaaaqcoxo.",
      "..oCoCAaaaaaqcoxo.",
      "..oSoCAaaaaaqcokso",
      "..oo.CAaaaaaqxo.o.",
      "....oCAaaaaaqxxo..",
      "...oCCAaaaaaqxxxo.",
      "...oCCAAaaaaqqxxo.",
      "...oCCCCCCCCCCCxo.",
      "....oBbbo..oBbvo..",
      "....ooooo..ooooo..",
    ],
  },
  // A guard's surcoat over mail, with a tabard badge.
  surcoat: {
    y: 15,
    rows: [
      "......oSSSSSo.....",
      "....oolltttTTo....",
      "...olltccccctTTo..",
      "..olololcccccoTTo.",
      "..olololcTTcccoTTo",
      "..olololcTTcccoTTo",
      "..olooAaaaaqaaaoTo",
      "..oSo.ocTcccco.oko",
      "..oo..ocTcccco..o.",
      ".....ocTccccco....",
      "....oPpppoppppPo..",
      "....oPpppoppppPo..",
      "....oPpppopppPPo..",
      "....oBbbboBbbvbo..",
      "...oBbbbvoBbbbvvo.",
      "...ooooooooooooo..",
    ],
  },
  // A traveller's cloak over a tunic.
  cloak: {
    y: 15,
    rows: [
      "......oSSSSSo.....",
      "...oooGgggggyooo..",
      "..oGGGgggggggyyyo.",
      ".oGGGgCcccccxgyyyo",
      ".oGGgoCcccccxogyyo",
      ".oGGgoCcccccxogyyo",
      ".oGGgoAaaaqaaogyyo",
      ".oGGgoCcccccxogyyo",
      ".oGGgoCcccccxogyyo",
      ".oGGGgoPppppogyyyo",
      "..oGGgoPppppogyyo.",
      "..oGGGGoPpppoyyyo.",
      "...ooooPppppooooo.",
      "....oBbbboBbbvbo..",
      "...oBbbbvoBbbbvvo.",
      "...ooooooooooooo..",
    ],
  },
  // A child's smock (for small figures).
  smock: {
    y: 15,
    rows: [
      "......oSSSSSo.....",
      "....ooCcccccxoo...",
      "...oCoCccccccoxo..",
      "...oCoCccccccoxo..",
      "...oSoCcccccxokso.",
      "....ooCCccccxxoo..",
      "....oCCcccccxxxo..",
      ".....oPpppopppo...",
      ".....oBbboBbvbo...",
      ".....ooooooooo....",
    ],
  },
} satisfies Record<string, Part>;

export const EXTRAS = {
  beard: {
    y: 12,
    rows: [
      "..oHhhhhhhhhhhjo..",
      "..oHhhhjhhhhhhjo..",
      "...oHhhjjhhhhjo...",
      "....oHhhjhhhjo....",
      ".....oHhhhhjo.....",
      "......oHhhjo......",
      ".......oHjo.......",
      "........oo........",
    ],
  },
  glasses: { y: 9, rows: ["..ottttottttoo....", "..otwwtottwwto....", "...oooo.oooo......"] },
  mustache: { y: 12, rows: ["....oHhhhhhhjo....", ".....oHo..ojo....."] },
  bag: {
    y: 16,
    rows: [
      ".o...............",
      "..o..............",
      "...o.............",
      "....o............",
      ".....o...........",
      "obbbo.o..........",
      "obvvbo.o.........",
      "obbbbo...........",
      "oBbbBo...........",
      ".oooo............",
    ],
  },
  basket: {
    y: 21,
    rows: ["..............oooooo", ".............oajqaqo", ".............oqaqaqo", ".............oAqAqAo", "..............oooo.."],
  },
} satisfies Record<string, Part>;

export type Figure = {
  look: Look;
  hair: keyof typeof HAIR;
  outfit: keyof typeof OUTFITS;
  hat?: keyof typeof HATS;
  extras?: readonly (keyof typeof EXTRAS)[];
  back?: boolean; // seen from behind
  flip?: boolean;
};

export const FIGURE_W = 18;

/**
 * Draws a figure standing with its feet on (x, gy), x being its centre. `breathe` is the second frame of the idle
 * loop: head and shoulders sink by a pixel while the legs stay put.
 */
export function figure(c: Canvas, x: number, gy: number, f: Figure, breathe = false) {
  const pal = palette(f.look);
  const parts: Part[] = [OUTFITS[f.outfit]];
  if (f.extras?.includes("bag")) parts.push(EXTRAS.bag);
  parts.push(f.back ? BACK : FACE);
  if (!(f.back && f.hat === "hood")) parts.push(HAIR[f.hair]);
  if (!f.back) for (const e of f.extras ?? []) if (e !== "bag") parts.push(EXTRAS[e]);
  if (f.back && f.extras?.includes("basket")) parts.push(EXTRAS.basket);
  if (f.hat) parts.push(HATS[f.hat]);
  const bottom = Math.max(...parts.map((p) => p.y + p.rows.length));
  const top = gy - bottom + 1;
  const left = Math.round(x - FIGURE_W / 2);
  const outfitTop = OUTFITS[f.outfit].y;
  const drawRow = (part: Part, j: number) => {
    const row = part.rows[j]!;
    const y = part.y + j;
    const sink = breathe && y < outfitTop + 4 ? 1 : 0;
    for (let i = 0; i < row.length; i++) {
      const key = row[i]!;
      if (key === "." || key === " ") continue;
      const color = pal[key];
      if (!color) throw new Error(`folk: no color for "${key}"`);
      c.px(f.flip ? left + FIGURE_W - 1 - i : left + i, top + y + sink, color);
    }
  };
  // Lower body first, then everything that sinks when breathing, so the chest overlaps the belt line.
  for (const part of parts) part.rows.forEach((_, j) => part.y + j >= outfitTop + 4 && drawRow(part, j));
  for (const part of parts) part.rows.forEach((_, j) => part.y + j < outfitTop + 4 && drawRow(part, j));
}
