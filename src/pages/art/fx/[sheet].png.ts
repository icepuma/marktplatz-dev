import type { APIRoute, GetStaticPaths } from "astro";
import { pngResponse } from "@/art/canvas";
import { CLOUDS, cloudSprite, gullSheet, LOOPS, loopSheet, type TimeOfDay } from "@/art/market";

// The hero's moving parts: sprite sheets cut from the painted animation frames, drifting clouds, and gulls.
const TIMES: TimeOfDay[] = ["day", "night"];

export const getStaticPaths = (() =>
  TIMES.flatMap((time) => [
    ...LOOPS.map((loop) => ({ params: { sheet: `${time}-${loop.id}` } })),
    ...CLOUDS.map((cloud) => ({ params: { sheet: `${time}-${cloud.id}` } })),
    { params: { sheet: `${time}-gull` } },
  ])) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => {
  const sheet = params.sheet!;
  const time = sheet.split("-")[0] as TimeOfDay;
  const id = sheet.slice(time.length + 1);
  const loop = LOOPS.find((l) => l.id === id);
  if (loop) return pngResponse(loopSheet(time, loop));
  if (id === "gull") return pngResponse(gullSheet(time));
  return pngResponse(cloudSprite(time, id));
};
