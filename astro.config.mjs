// @ts-check
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

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
  vite: { plugins: [tailwindcss()] },
});
