import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { createBackup, openBackup } from "./backup-service.server";
import { audit } from "./operations-service.server";
export const backupNow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requirePermission(String(context.userId), "system.manage", context.bearerToken);
    return createBackup(await getSql(), String(context.userId));
  });
export const listBackups = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requirePermission(String(context.userId), "system.manage", context.bearerToken);
    return (await getSql()).query<{
      id: string;
      status: string;
      checksum: string;
      size: number;
      created_at: string;
      verified_at: string | null;
    }>(
      "SELECT id,status,checksum,octet_length(bytes)::int AS size,created_at::text,verified_at::text FROM backup_records ORDER BY created_at DESC LIMIT 100",
    );
  });
export const downloadBackup = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "system.manage", context.bearerToken);
    const sql = await getSql();
    const [record] = await sql.query<{ bytes: Uint8Array }>(
      "SELECT bytes FROM backup_records WHERE id=$1",
      [data.id],
    );
    if (!record) throw new Error("ไม่พบข้อมูลสำรอง");
    openBackup(record.bytes);
    await audit(sql, String(context.userId), "backup.downloaded", "backup", data.id);
    return { encoded: Buffer.from(record.bytes).toString("base64") };
  });
export const verifyBackup = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "system.manage", context.bearerToken);
    const sql = await getSql();
    const [record] = await sql.query<{ bytes: Uint8Array }>(
      "SELECT bytes FROM backup_records WHERE id=$1",
      [data.id],
    );
    if (!record) throw new Error("ไม่พบข้อมูลสำรอง");
    const { verifyRestoration } = await import("./backup-verification.server");
    const result = await verifyRestoration(openBackup(record.bytes));
    await sql.query("UPDATE backup_records SET status='verified',verified_at=now() WHERE id=$1", [
      data.id,
    ]);
    await audit(sql, String(context.userId), "backup.verified", "backup", data.id);
    return result;
  });
