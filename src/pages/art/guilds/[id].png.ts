import type { APIRoute, GetStaticPaths } from "astro";
import { pngResponse } from "@/art/canvas";
import { guildShield } from "@/art/heraldry";
import { loadRoles } from "@/lib/catalog";

export const getStaticPaths = (async () =>
  [...(await loadRoles())].map(([id, role]) => ({ params: { id }, props: { name: role.name } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params, props }) => pngResponse(guildShield(params.id!, props.name));
