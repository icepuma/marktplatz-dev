import type { Color } from "./canvas";

// Hand-drawn sprites as character grids. "." is transparent.

export const WIZARD = {
  grid: [
    "..........Hh........",
    ".........HHh........",
    "........HHHh........",
    "........HHHhh.......",
    ".......HHHHHh.......",
    ".......HHSHHh.......",
    "......HHSSSHhh......",
    "......HHHSHHHh......",
    ".....HHHHHHHHhh.....",
    ".....HHHHHHSHHh.....",
    "....HHHHHHHHHHhh....",
    "..BBBBBBBBBBBBBBbb..",
    ".bBBBBBBBBBBBBBBBbb.",
    ".....fFFFFFFFFf.....",
    ".....FFEFFFFEFF.....",
    ".....FFFFFnFFFF.....",
    ".....wWWFFnFFWWw....",
    "....wWWWWWWWWWWWw...",
    "...RwWWWWWWWWWWWwR..",
    "..RRRwWWWWWWWWWwRRR.",
    ".RRRRrwWWWWWWWwrRRRR",
    "RRRRRrrwWWWWWwrrRRRR",
    "RRRRRRrrwWWWwrrRRRRR",
    "RRGRRRRrrwWwrrRRRGRR",
    "RRGRRRRRrrwrrRRRRGRR",
    "RRRRRRRRRrrrRRRRRRRR",
    "RFFRRRRRRRRRRRRRRFFR",
    "RFFRRRRRRRRRRRRRRFFR",
  ],
  palette: {
    H: "#3a4fb0",
    h: "#1e2a66",
    S: "#ffe066",
    B: "#2a3a86",
    b: "#1a2458",
    F: "#f0b88a",
    f: "#d08e62",
    n: "#d08e62",
    E: "#1a1020",
    W: "#f4f2ee",
    w: "#c4c2d0",
    R: "#6a2a8a",
    r: "#4a1a66",
    G: "#e2b04a",
  } as Record<string, Color>,
};

export const POTION = [
  "..ccc..",
  "..gGg..",
  "..g.g..",
  ".gLLLg.",
  "gLlLLLg",
  "gLlLLLg",
  "gLLLLDg",
  ".gLLDg.",
  "..ggg..",
];

export function potionPalette(liquid: Color, shade: Color): Record<string, Color> {
  return { c: "#8a5a34", g: "#2a2040", G: "#c8d8f0", L: liquid, D: shade, l: "#ffffff" };
}

export const SCROLL = [
  ".pPPPPPp.",
  "pPPPPPPPp",
  ".pQQQQQp.",
  ".pPPPPPp.",
  ".pQQQQQp.",
  ".pPPrPPp.",
  ".pPrrrPp.",
  ".pPPrPPp.",
  "pPPPPPPPp",
  ".pPPPPPp.",
];

export const SCROLL_PALETTE: Record<string, Color> = { P: "#f3e4c4", p: "#b89a6e", Q: "#8a7050", r: "#b8322e" };

export const BOOK = [
  "kkkkkkkk.",
  "kCCCCCCkp",
  "kCCyyCCkp",
  "kCyCCyCkp",
  "kCCyyCCkp",
  "kCCCCCCkp",
  "kCCCCCCkp",
  "kkkkkkkkp",
  ".ppppppp.",
];

export const APPLE = [".s.", "aAa", "aaa", ".a."];
export const APPLE_PALETTE: Record<string, Color> = { s: "#4a2c1a", a: "#c8302a", A: "#ff8a6a" };

export const CAT = [
  "k...k.....",
  "kk.kk.....",
  "kkkkk.....",
  "kykyk....k",
  "kkkkk....k",
  ".kkkkkkkkk",
  ".kkkkkkkk.",
  ".k.k..k.k.",
];

export const LANTERN = [".aaa.", "aYYYa", "aYyYa", "aYYYa", ".aaa.", "..a.."];
export const LANTERN_PALETTE: Record<string, Color> = { a: "#2a1a10", Y: "#ffd27a", y: "#fff4c2" };

// 5x7 pixel font for heraldic initials.
export const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
};
