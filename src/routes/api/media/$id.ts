import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
export const Route = createFileRoute("/api/media/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!/^[a-f\d-]{36}$/i.test(params.id)) return new Response(null, { status: 404 });
        const thumbnail = new URL(request.url).searchParams.get("variant") === "thumbnail";
        const sql = await getSql();
        const [asset] = await sql.query<{ bytes: Uint8Array }>(
          `SELECT ${thumbnail ? "thumbnail" : "bytes"} AS bytes FROM media_assets WHERE id=$1`,
          [params.id],
        );
        if (!asset) return new Response(null, { status: 404 });
        return new Response(new Uint8Array(asset.bytes), {
          headers: {
            "content-type": "image/webp",
            "cache-control": "public, max-age=31536000, immutable",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
