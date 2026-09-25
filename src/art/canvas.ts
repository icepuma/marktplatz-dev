import { deflateSync } from "node:zlib";

// A small pixel-art painter in a modern style (think Sea of Stars): hue-shifted palettes, every object on its own
// layer with a selective dark outline, normal-based shading, and smooth dynamic light with bloom on top.
// Everything is painted at low resolution and scaled up with `image-rendering: pixelated`.

export type Color = string; // "#rrggbb"
type RGB = [number, number, number];
type HSL = [h: number, s: number, l: number];

export function rgb(color: Color): RGB {
  const n = Number.parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hex([r, g, b]: RGB): Color {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) | (c(r) << 16) | (c(g) << 8) | c(b)).toString(16).slice(1)}`;
}

function toHsl([r, g, b]: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function fromHsl([h, s, l]: HSL): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function shiftHue(h: number, target: number, amount: number): number {
  const delta = ((target - h + 540) % 360) - 180;
  return h + delta * amount;
}

/**
 * A hue-shifted ramp (dark → light) around a base color: shadows drift toward cool violet and gain saturation,
 * highlights drift toward warm yellow. This is what makes modern pixel-art palettes rich instead of muddy.
 */
export function hueRamp(base: Color, steps = 5, spread = 0.55): Color[] {
  const [h, s, l] = toHsl(rgb(base));
  return Array.from({ length: steps }, (_, k) => {
    const t = k / (steps - 1) - 0.5; // -0.5 (shadow) … 0.5 (highlight)
    const hue = t < 0 ? shiftHue(h, 260, -t * 0.6) : shiftHue(h, 52, t * 0.5);
    const sat = clamp01(s + (t < 0 ? -t * 0.2 : -t * 0.2));
    const light = clamp01(l + t * spread * (t < 0 ? 1.15 : 0.85));
    return hex(fromHsl([hue, sat, light]));
  });
}

const outlineCache = new Map<Color, Color>();

/** The selective outline for a pixel: a very dark, slightly cool version of its own color. */
export function outlineOf(color: Color): Color {
  let out = outlineCache.get(color);
  if (!out) {
    const [h, s, l] = toHsl(rgb(color));
    out = hex(fromHsl([shiftHue(h, 265, 0.3), clamp01(s * 0.75 + 0.15), Math.min(0.17, l * 0.3 + 0.04)]));
    outlineCache.set(color, out);
  }
  return out;
}

/** Colour grading: saturation scaled by `sat`, and an S-curve of strength `contrast` on lightness. */
export function grade(color: Color, sat: number, contrast: number): Color {
  const [h, s, l] = toHsl(rgb(color));
  // A gentle S-curve that leaves the darkest and lightest tones alone.
  const curved = l + contrast * (l - 0.5) * (1 - Math.abs(2 * l - 1));
  return hex(fromHsl([h, clamp01(s * sat), clamp01(curved)]));
}

/** Screen blend: brightens `base` toward `color` like light does. */
export function screen(base: Color, color: Color, t: number): Color {
  const [br, bg, bb] = rgb(base);
  const [cr, cg, cb] = rgb(color);
  const f = (b: number, c: number) => 255 - ((255 - b) * (255 - c * t)) / 255;
  return hex([f(br, cr), f(bg, cg), f(bb, cb)]);
}

/** Multiply blend. */
export function multiply(base: Color, color: Color): Color {
  const [br, bg, bb] = rgb(base);
  const [cr, cg, cb] = rgb(color);
  return hex([(br * cr) / 255, (bg * cg) / 255, (bb * cb) / 255]);
}

export const luminance = (color: Color) => {
  const [r, g, b] = rgb(color);
  return (r * 0.3 + g * 0.59 + b * 0.11) / 255;
};

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
    range: (min: number, max: number) => min + next() * (max - min),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!,
    chance: (p: number) => next() < p,
  };
}
export type Rng = ReturnType<typeof rng>;

/** Stable 32-bit hash of a string, for deriving art from ids. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export type LayerOptions = {
  /** Outline strength: 1 = full selective outline, 0.5 = halfway (for distant objects), 0 = none. */
  outline?: number;
  /** Atmospheric fade toward a color (for distant objects). */
  fade?: [color: Color, amount: number];
};

export class Canvas {
  readonly data: Uint8Array;
  // Bounding box of everything drawn, so layers only scan what they touched.
  minX = Number.POSITIVE_INFINITY;
  minY = Number.POSITIVE_INFINITY;
  maxX = Number.NEGATIVE_INFINITY;
  maxY = Number.NEGATIVE_INFINITY;

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
    const n = Number.parseInt(color.slice(1), 16);
    this.data[i] = (n >> 16) & 255;
    this.data[i + 1] = (n >> 8) & 255;
    this.data[i + 2] = n & 255;
    this.data[i + 3] = 255;
    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;
  }

  clone(): Canvas {
    const c = new Canvas(this.width, this.height);
    c.data.set(this.data);
    return c;
  }

  rect(x: number, y: number, w: number, h: number, color: Color) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, color);
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

  /**
   * Paints `draw` onto a fresh layer, gives its silhouette a selective dark outline (each edge pixel becomes a
   * very dark version of itself), optionally fades it toward a haze color, and composites it onto this canvas.
   */
  layer(draw: (l: Canvas) => void, { outline = 1, fade }: LayerOptions = {}) {
    const l = new Canvas(this.width, this.height);
    draw(l);
    if (l.maxX < l.minX) return;
    const solid = (x: number, y: number) => l.inside(x, y) && l.data[(y * l.width + x) * 4 + 3] !== 0;
    const edges: [number, number][] = [];
    if (outline > 0) {
      for (let y = l.minY; y <= l.maxY; y++) {
        for (let x = l.minX; x <= l.maxX; x++) {
          if (solid(x, y) && (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1))) edges.push([x, y]);
        }
      }
      for (const [x, y] of edges) {
        const c = l.get(x, y)!;
        l.px(x, y, outline >= 1 ? outlineOf(c) : mix(c, outlineOf(c), outline));
      }
    }
    for (let y = l.minY; y <= l.maxY; y++) {
      for (let x = l.minX; x <= l.maxX; x++) {
        const i = (y * l.width + x) * 4;
        if (l.data[i + 3] === 0) continue;
        if (fade) this.px(x, y, mix(hex([l.data[i]!, l.data[i + 1]!, l.data[i + 2]!]), fade[0], fade[1]));
        else {
          this.data.set(l.data.subarray(i, i + 4), i);
          if (x < this.minX) this.minX = x;
          if (x > this.maxX) this.maxX = x;
          if (y < this.minY) this.minY = y;
          if (y > this.maxY) this.maxY = y;
        }
      }
    }
  }

  /** A smooth light pool: screen-blends pixels toward `color` with a soft falloff. */
  light(cx: number, cy: number, r: number, color: Color, strength: number, ry = r) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const base = this.get(x, y);
        if (!base) continue;
        const d = Math.hypot((x - cx) / r, (y - cy) / ry);
        if (d >= 1) continue;
        const t = (1 - d) ** 2 * strength;
        if (t > 0.004) this.px(x, y, screen(base, color, t));
      }
    }
  }

  /**
   * Night relighting: within the radius, pixels blend from their graded (moonlit) color back toward their
   * daylight color tinted by the light, as if a lamp revealed their true colors.
   */
  relight(daylight: Canvas, cx: number, cy: number, r: number, tint: Color, strength: number, ry = r) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const base = this.get(x, y);
        const day = daylight.get(x, y);
        if (!base || !day) continue;
        const d = Math.hypot((x - cx) / r, (y - cy) / ry);
        if (d >= 1) continue;
        const t = (1 - d) ** 1.6 * strength;
        if (t > 0.004) this.px(x, y, mix(base, multiply(day, tint), Math.min(1, t)));
      }
    }
  }

  /** Bloom: bright pixels bleed a soft halo into their surroundings. */
  bloom(threshold = 0.78, radius = 5, strength = 0.5) {
    const { width: w, height: h } = this;
    const bright = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (this.data[i + 3] === 0) continue;
        const r = this.data[i]!;
        const g = this.data[i + 1]!;
        const b = this.data[i + 2]!;
        if ((r * 0.3 + g * 0.59 + b * 0.11) / 255 < threshold) continue;
        bright.set([r, g, b], (y * w + x) * 3);
      }
    }
    const blur = (src: Float32Array, horizontal: boolean) => {
      const out = new Float32Array(src.length);
      const n = 2 * radius + 1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let r = 0;
          let g = 0;
          let b = 0;
          for (let k = -radius; k <= radius; k++) {
            const sx = horizontal ? x + k : x;
            const sy = horizontal ? y : y + k;
            if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
            const i = (sy * w + sx) * 3;
            r += src[i]!;
            g += src[i + 1]!;
            b += src[i + 2]!;
          }
          out.set([r / n, g / n, b / n], (y * w + x) * 3);
        }
      }
      return out;
    };
    const halo = blur(blur(blur(blur(bright, true), false), true), false);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (this.data[i + 3] === 0) continue;
        const k = (y * w + x) * 3;
        const glow: RGB = [halo[k]!, halo[k + 1]!, halo[k + 2]!];
        const t = clamp01(Math.max(...glow) / 255) * strength;
        if (t < 0.01) continue;
        const base = hex([this.data[i]!, this.data[i + 1]!, this.data[i + 2]!]);
        this.px(x, y, screen(base, hex(glow.map((v) => v * 2) as RGB), t));
      }
    }
  }

  /** Adds a 1px outline around every opaque pixel (outside the silhouette). */
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
