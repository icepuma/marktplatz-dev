import type { APIRoute, GetStaticPaths } from "astro";
import { pngResponse } from "@/art/canvas";
import { skillIcon } from "@/art/heraldry";
import { loadApprovedVersions, loadHeldVersions } from "@/lib/catalog";

export const getStaticPaths = (async () =>
  [...new Set([...(await loadApprovedVersions()).keys(), ...(await loadHeldVersions()).keys()])].map((id) => ({ params: { id } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => pngResponse(skillIcon(params.id!));
