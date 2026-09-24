import type { APIRoute, GetStaticPaths } from "astro";
import { pngResponse } from "@/art/canvas";
import { wareIcon } from "@/art/heraldry";
import { loadApprovedVersions } from "@/lib/catalog";

export const getStaticPaths = (async () =>
  [...(await loadApprovedVersions()).keys()].map((id) => ({ params: { id } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => pngResponse(wareIcon(params.id!));
