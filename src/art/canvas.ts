import { deflateSync } from "node:zlib";

// A tiny pixel-art painter: palette colors, ordered dithering, lighting and PNG output.
// Everything is painted at low resolution and scaled up with `image-rendering: pixelated`.

export type Color = string; // "#rrggbb"
type RGB = [number, number, number];

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

/** Ordered-dither threshold for a pixel, in (0, 1). */
export const bayer = (x: number, y: number) => BAYER[y & 3]![x & 3]!;

export function rgb(color: Color): RGB {
  const n = Number.parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hex([r, g, b]: RGB): Color {
  return `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1)}`;
}

export function mix(a: Color, b: Color, t: number): Color {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return hex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!,
    chance: (p: number) => next() < p,
  };
}

/** Stable 32-bit hash of a string, for deriving art from ids. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class Canvas {
  readonly data: Uint8Array;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8Array(width * height * 4);
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x: number, y: number): Color | null {
    if (!this.inside(x, y)) return null;
    const i = (y * this.width + x) * 4;
    if (this.data[i + 3] === 0) return null;
    return hex([this.data[i]!, this.data[i + 1]!, this.data[i + 2]!]);
  }

  px(x: number, y: number, color: Color | null) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return;
    const i = (y * this.width + x) * 4;
    if (color === null) {
      this.data[i + 3] = 0;
      return;
    }
    const [r, g, b] = rgb(color);
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = 255;
  }

  rect(x: number, y: number, w: number, h: number, color: Color) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, color);
  }

  /** Fills a rectangle with `b` over `a`, where `t(x, y)` in [0, 1] is b's coverage. */
  dither(x: number, y: number, w: number, h: number, a: Color, b: Color, t: number | ((x: number, y: number) => number)) {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        const cover = typeof t === "number" ? t : t(i, j);
        this.px(i, j, cover > bayer(i, j) ? b : a);
      }
    }
  }

  /** Vertical dithered gradient through a list of colors. */
  gradient(x: number, y: number, w: number, h: number, stops: Color[]) {
    for (let j = 0; j < h; j++) {
      const p = (j / Math.max(1, h - 1)) * (stops.length - 1);
      const k = Math.min(stops.length - 2, Math.floor(p));
      const t = p - k;
      for (let i = x; i < x + w; i++) this.px(i, y + j, t > bayer(i, y + j) ? stops[k + 1]! : stops[k]!);
    }
  }

  hline(x0: number, x1: number, y: number, color: Color) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.px(x, y, color);
  }

  vline(x: number, y0: number, y1: number, color: Color) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.px(x, y, color);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: Color) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, color);
      if (x0 === x1 && y0 === y1) return;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Fills an ellipse; a color function may return null to leave a pixel untouched. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: Color | ((x: number, y: number, u: number, v: number) => Color | null)) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x - cx) / (rx + 0.5);
        const v = (y - cy) / (ry + 0.5);
        if (u * u + v * v > 1) continue;
        const fill = typeof color === "string" ? color : color(x, y, u, v);
        if (fill) this.px(x, y, fill);
      }
    }
  }

  /** Scanline polygon fill. */
  poly(points: [number, number][], color: Color | ((x: number, y: number) => Color | null)) {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i]!;
        const [x1, y1] = points[(i + 1) % points.length]!;
        if (y0 === y1) continue;
        const cy = y + 0.5;
        if (cy >= Math.min(y0, y1) && cy < Math.max(y0, y1)) xs.push(x0 + ((cy - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]!); x < Math.round(xs[k + 1]!); x++) {
          const fill = typeof color === "string" ? color : color(x, y);
          if (fill) this.px(x, y, fill);
        }
      }
    }
  }

  /** Draws a sprite from a character grid; "." is transparent. */
  sprite(grid: string[], palette: Record<string, Color>, x: number, y: number, flip = false) {
    grid.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        const color = palette[ch];
        if (color) this.px(x + (flip ? row.length - 1 - i : i), y + j, color);
      });
    });
  }

  /** Dithered light (or shadow) pool: blends existing pixels toward `color`. */
  light(cx: number, cy: number, r: number, color: Color, strength: number, ry = r) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const base = this.get(x, y);
        if (!base) continue;
        const d = Math.hypot((x - cx) / r, (y - cy) / ry);
        if (d >= 1) continue;
        const t = (1 - d) * strength;
        // Two quantized steps, dithered between, keep the palette look.
        const step = t > 0.5 ? 0.5 : 0.25;
        if (t > bayer(x, y) * 0.5) this.px(x, y, mix(base, color, step));
      }
    }
  }

  /** Tints a region toward a color (e.g. dusk shading), dithered. */
  tint(x: number, y: number, w: number, h: number, color: Color, t: number | ((x: number, y: number) => number)) {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        const base = this.get(i, j);
        if (!base) continue;
        const cover = typeof t === "number" ? t : t(i, j);
        if (cover > bayer(i, j)) this.px(i, j, mix(base, color, 0.35));
      }
    }
  }

  /** Adds a 1px dark outline around every opaque pixel (for sprites/icons). */
  outline(color: Color) {
    const solid = (x: number, y: number) => this.inside(x, y) && this.data[(y * this.width + x) * 4 + 3] !== 0;
    const marks: [number, number][] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) marks.push([x, y]);
      }
    }
    for (const [x, y] of marks) this.px(x, y, color);
  }

  /** Nearest-neighbour upscale by an integer factor. */
  scale(k: number): Canvas {
    const out = new Canvas(this.width * k, this.height * k);
    for (let y = 0; y < out.height; y++) {
      for (let x = 0; x < out.width; x++) {
        const i = (Math.floor(y / k) * this.width + Math.floor(x / k)) * 4;
        out.data.set(this.data.subarray(i, i + 4), (y * out.width + x) * 4);
      }
    }
    return out;
  }

  png(): Uint8Array<ArrayBuffer> {
    const raw = Buffer.alloc((this.width * 4 + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      raw[y * (this.width * 4 + 1)] = 0;
      Buffer.from(this.data.buffer, y * this.width * 4, this.width * 4).copy(raw, y * (this.width * 4 + 1) + 1);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(this.width, 0);
    header.writeUInt32BE(this.height, 4);
    header.set([8, 6, 0, 0, 0], 8);
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Buffer): Buffer {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, "ascii");
  body.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
  return out;
}

/** Serves a canvas from an Astro static endpoint. */
export function pngResponse(canvas: Canvas): Response {
  return new Response(canvas.png(), { headers: { "content-type": "image/png" } });
}
