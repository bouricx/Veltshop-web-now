import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          "User-agent: *\nAllow: /shop\nDisallow: /admin\nDisallow: /api/\nDisallow: /shop/profile\nDisallow: /shop/history\nDisallow: /shop/claims\nDisallow: /shop/topup\n",
          { headers: { "content-type": "text/plain; charset=utf-8" } },
        ),
    },
  },
});
