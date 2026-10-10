import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";
import { processJobs, scheduleBackup } from "@/lib/shop/jobs-service.server";
export const Route = createFileRoute("/api/jobs/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const actual = request.headers.get("authorization") ?? "";
        const expected = `Bearer ${secret}`;
        if (
          !secret ||
          secret.length < 32 ||
          Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
          !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
        )
          return new Response("Unauthorized", { status: 401 });
        await scheduleBackup(await getSql());
        return Response.json(await processJobs(await getSql()), {
          headers: { "cache-control": "no-store" },
        });
      },
    },
  },
});
