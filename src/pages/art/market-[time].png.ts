import type { APIRoute, GetStaticPaths } from "astro";
import { pngResponse } from "@/art/canvas";
import { paintMarket, type TimeOfDay } from "@/art/market";

export const getStaticPaths = (() => [{ params: { time: "day" } }, { params: { time: "night" } }]) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => pngResponse(paintMarket(params.time as TimeOfDay));
