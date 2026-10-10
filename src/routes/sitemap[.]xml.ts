import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
const escape = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const configured = process.env.BETTER_AUTH_URL;
        if (!configured) return new Response("Public origin not configured", { status: 503 });
        const origin = new URL(configured).origin;
        const rows = await (
          await getSql()
        ).query<{ id: string; updated_at: string }>(
          "SELECT id,updated_at::text FROM products WHERE active=true ORDER BY id LIMIT 50000",
        );
        const urls = ["/shop", "/shop/catalog", "/shop/privacy"].map(
          (path) => `<url><loc>${escape(origin + path)}</loc></url>`,
        );
        for (const row of rows)
          urls.push(
            `<url><loc>${escape(origin + "/shop/product/" + encodeURIComponent(row.id))}</loc><lastmod>${new Date(row.updated_at).toISOString()}</lastmod></url>`,
          );
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
            urls.join("") +
            "</urlset>",
          {
            headers: {
              "content-type": "application/xml; charset=utf-8",
              "cache-control": "public, max-age=300",
            },
          },
        );
      },
    },
  },
});
