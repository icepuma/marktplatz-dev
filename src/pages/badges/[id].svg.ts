import { licenseName } from "@/lib/browse";
import type { APIRoute, GetStaticPaths } from "astro";
import { loadCatalog } from "@/lib/catalog";

// A README badge for upstream authors: "marktplatz | admitted · 3/3 scans". Plain SVG, no external fonts.
export const getStaticPaths = (async () => (await loadCatalog()).skills.map((skill) => ({ params: { id: skill.id }, props: { skill } }))) satisfies GetStaticPaths;

const width = (text: string) => Math.round(text.length * 6.6 + 12);

export const GET: APIRoute = ({ props }) => {
  const { skill } = props as { skill: Awaited<ReturnType<typeof loadCatalog>>["skills"][number] };
  const passed = skill.scan.scanners.filter((s) => !s.blocked).length;
  const left = "marktplatz";
  const right = `admitted · ${passed}/${skill.scan.scanners.length} scans · ${licenseName(skill.license)}`;
  const lw = width(left);
  const rw = width(right);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${left}: ${right}">
  <title>${left}: ${right}</title>
  <rect width="${lw}" height="20" fill="#1b2134"/>
  <rect x="${lw}" width="${rw}" height="20" fill="#c48a26"/>
  <g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14" text-anchor="middle" fill="#f6d27a">${left}</text>
    <text x="${lw + rw / 2}" y="14" text-anchor="middle" fill="#1b1430">${right}</text>
  </g>
</svg>
`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml" } });
};
