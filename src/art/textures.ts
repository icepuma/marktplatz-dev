import { Canvas, type Color } from "./canvas";

// Small UI art: the cursor and the menu pointer. The wizard's portrait is cut from the scene (`portrait` in market.ts).

/** The classic adventure-game crosshair cursor, 2x scaled. */
export function crosshair(): Canvas {
  const c = new Canvas(15, 15);
  for (let i = 0; i < 15; i++) {
    if (Math.abs(i - 7) < 2) continue;
    c.px(i, 7, "#ffffff");
    c.px(7, i, "#ffffff");
  }
  c.px(7, 7, "#ffe066");
  c.outline("#1a1020");
  return c.scale(2);
}

/** The white-gloved pointing hand used by the menus, 2x scaled. */
export function pointer(): Canvas {
  const G = [
    "..oooo...........",
    ".owwwwo..........",
    "owwwwwwoooooooo..",
    "owwwwwwwwwwwwwwo.",
    "owwwwwwwoooooooo.",
    "ossswwwwwwwwo....",
    "osssswwoooooo....",
    "osssswwwwwwwo....",
    ".ossswwoooooo....",
    "..osssswwwwo.....",
    "...oooooooo......",
  ];
  const pal: Record<string, Color> = { o: "#161a2c", w: "#ffffff", s: "#b8c2dc" };
  const c = new Canvas(17, 11);
  G.forEach((row, j) => [...row].forEach((k, i) => k !== "." && c.px(i, j, pal[k]!)));
  return c.scale(2);
}
