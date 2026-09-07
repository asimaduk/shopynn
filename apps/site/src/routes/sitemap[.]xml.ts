import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${BASE_URL}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${BASE_URL}/start-trial</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>${BASE_URL}/privacy</loc><changefreq>yearly</changefreq><priority>0.5</priority></url>
  <url><loc>${BASE_URL}/terms</loc><changefreq>yearly</changefreq><priority>0.5</priority></url>
  <url><loc>${BASE_URL}/security</loc><changefreq>yearly</changefreq><priority>0.5</priority></url>
</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
