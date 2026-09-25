// @ts-check
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

// Fully static: every page is prerendered and served as Cloudflare static assets.
export default defineConfig({
  integrations: [
    react(),
    {
      // Mirrors public/_redirects in the dev server: /market/* is the builder page.
      name: "market-rewrite",
      hooks: {
        "astro:server:setup": ({ server }) => {
          server.middlewares.use((req, _res, next) => {
            if (req.url?.startsWith("/market/")) req.url = "/";
            next();
          });
        },
      },
    },
  ],
  // Astro downloads these at build time, serves them from the site, and generates metric-matched fallbacks.
  // Layout.astro puts them on the page with <Font />; src/styles/tokens.css maps them to the type roles.
  fonts: [
    { provider: fontProviders.fontsource(), name: "Pixelify Sans", cssVariable: "--font-pixelify", weights: [400, 700], subsets: ["latin"], fallbacks: ["monospace"] },
    { provider: fontProviders.fontsource(), name: "IBM Plex Sans", cssVariable: "--font-plex-sans", weights: [400, 500, 600, 700], styles: ["normal", "italic"], subsets: ["latin", "latin-ext"], fallbacks: ["sans-serif"] },
    { provider: fontProviders.fontsource(), name: "IBM Plex Mono", cssVariable: "--font-plex-mono", weights: [400, 500], subsets: ["latin"], fallbacks: ["monospace"] },
  ],
  vite: { plugins: [tailwindcss()] },
});
