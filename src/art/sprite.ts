import type { Canvas, Color } from "./canvas";

// Hand-placed pixel sprites: small grids of palette keys, the way a pixel artist would draw faces, leaves and icons.
// "." (or a space) is transparent; every other character is looked up in the palette.

export type Sprite = { readonly w: number; readonly h: number; readonly px: readonly (Color | null)[] };
export type Palette = Readonly<Record<string, Color>>;

export function sprite(rows: readonly string[], palette: Palette): Sprite {
  const w = Math.max(...rows.map((r) => r.length));
  const px: (Color | null)[] = [];
  for (const row of rows) {
    for (let i = 0; i < w; i++) {
      const key = row[i] ?? ".";
      if (key === "." || key === " ") px.push(null);
      else {
        const color = palette[key];
        if (!color) throw new Error(`sprite: no color for "${key}"`);
        px.push(color);
      }
    }
  }
  return { w, h: rows.length, px };
}

export function flip(s: Sprite): Sprite {
  const px: (Color | null)[] = [];
  for (let y = 0; y < s.h; y++) for (let x = s.w - 1; x >= 0; x--) px.push(s.px[y * s.w + x]!);
  return { w: s.w, h: s.h, px };
}

/** Draws a sprite with its top-left corner at (x, y); `tint` may restyle each pixel. */
export function stamp(c: Canvas, s: Sprite, x: number, y: number, tint?: (color: Color, i: number, j: number) => Color | null) {
  for (let j = 0; j < s.h; j++) {
    for (let i = 0; i < s.w; i++) {
      const color = s.px[j * s.w + i];
      if (!color) continue;
      const out = tint ? tint(color, i, j) : color;
      if (out) c.px(x + i, y + j, out);
    }
  }
}
