import { pngResponse } from "@/art/canvas";
import { portrait } from "@/art/market";

export const GET = () => pngResponse(portrait());
