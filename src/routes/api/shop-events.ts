import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/verify.server";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
export const Route = createFileRoute("/api/shop-events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          assertSameSiteRequest();
        } catch {
          return new Response(null, { status: 403 });
        }
        const user = await getSessionUser();
        const sql = await getSql();
        const [admin] = user
          ? await sql.query<{ allowed: boolean }>(
              "SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id WHERE ur.user_id=$1 AND rp.permission_id='dashboard.read') AS allowed",
              [user.id],
            )
          : [{ allowed: false }];
        let timer: ReturnType<typeof setInterval> | undefined,
          deadline: ReturnType<typeof setTimeout> | undefined;
        let closed = false,
          busy = false;
        const stop = () => {
          closed = true;
          clearInterval(timer);
          clearTimeout(deadline);
        };
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            let previous = "";
            const close = () => {
              if (closed) return;
              stop();
              controller.close();
            };
            const sample = async () => {
              if (closed || busy) return;
              busy = true;
              try {
                const rows = await sql.query<{ scope: string; revision: number; count: number }>(
                  "SELECT scope,max(id)::text AS revision,count(*)::text AS count FROM realtime_revisions WHERE scope=$1 OR scope=$2 OR scope=$3 GROUP BY scope ORDER BY scope",
                  [
                    "public",
                    user ? `user:${user.id}` : "public",
                    admin.allowed ? "admin" : "public",
                  ],
                );
                const revision = rows
                  .map(
                    (r) =>
                      `${r.scope === "public" ? "public" : r.scope === "admin" ? "admin" : "account"}:${r.revision}:${r.count}`,
                  )
                  .join("|");
                if (!closed) {
                  controller.enqueue(
                    encoder.encode(
                      revision === previous
                        ? ": heartbeat\n\n"
                        : `event: change\ndata: ${JSON.stringify({ revision })}\n\n`,
                    ),
                  );
                  previous = revision;
                }
              } catch {
                close();
              } finally {
                busy = false;
              }
            };
            request.signal.addEventListener("abort", close, { once: true });
            void sample();
            timer = setInterval(() => void sample(), 5000);
            deadline = setTimeout(close, 25000);
            if (request.signal.aborted) close();
          },
          cancel() {
            stop();
          },
        });
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "private, no-store",
            "x-accel-buffering": "no",
          },
        });
      },
    },
  },
});
