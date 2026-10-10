import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { authorizedCron, runSystemMaintenance } from "@/lib/shop/system-runner.server";
async function run({ request }: { request: Request }) {
  const headers = { "cache-control": "no-store" };
  if (!authorizedCron(request.headers.get("authorization")))
    return new Response("Unauthorized", { status: 401, headers });
  try {
    return Response.json(await runSystemMaintenance(await getSql()), { headers });
  } catch {
    return new Response("ประมวลผลงานระบบไม่สำเร็จ", { status: 500, headers });
  }
}
export const Route = createFileRoute("/api/jobs/run")({
  server: { handlers: { GET: run, POST: run } },
});
