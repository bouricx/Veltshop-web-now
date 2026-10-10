import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { audit } from "./operations-service.server";
import { runSystemMaintenance } from "./system-runner.server";
export const runJobs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requirePermission(String(context.userId), "system.manage", context.bearerToken);
    return runSystemMaintenance(await getSql());
  });
export const retryJob = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "system.manage", context.bearerToken);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx.query(
        "UPDATE jobs SET status='pending',attempts=0,available_at=now(),lease_until=NULL,lease_token=NULL WHERE id=$1 AND status IN ('failed','dead_letter')",
        [data.id],
      );
      await audit(tx, String(context.userId), "job.retried", "job", data.id);
    });
    return { ok: true };
  });
