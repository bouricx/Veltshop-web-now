import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { configuration, audit } from "./operations-service.server";
import { CommerceError } from "./commerce.server";
export const updateAccess = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        userId: z.string().min(1).max(200),
        role: z.enum(["super_admin", "admin", "staff", "customer"]),
        reason: z.string().trim().min(3, "กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร").max(2000, "เหตุผลต้องไม่เกิน 2,000 ตัวอักษร"),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "roles.manage", context.bearerToken);
    const sql = await getSql();
    return sql.transaction(async (tx) => {
      await tx.query("SELECT id FROM roles WHERE id='super_admin' FOR UPDATE");
      const [target] = await tx.query('SELECT id FROM "user" WHERE id=$1', [data.userId]);
      if (!target) throw new CommerceError("ไม่พบสมาชิก");
      if (data.userId === context.userId && data.role !== "super_admin")
        throw new CommerceError("ลดสิทธิ์ตนเองไม่ได้");
      const before = await tx.query<{ role_id: string }>(
        "SELECT role_id FROM user_roles WHERE user_id=$1",
        [data.userId],
      );
      if (before.some((r) => r.role_id === "super_admin") && data.role !== "super_admin") {
        const [count] = await tx.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM user_roles WHERE role_id='super_admin'",
        );
        if (count.n <= 1) throw new CommerceError("ต้องเหลือผู้ดูแลสูงสุดอย่างน้อยหนึ่งคน");
      }
      await tx.query("DELETE FROM user_roles WHERE user_id=$1", [data.userId]);
      await tx.query("INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)", [
        data.userId,
        data.role,
      ]);
      await audit(tx, String(context.userId), "roles.changed", "user", data.userId, {
        before: before.map((r) => r.role_id),
        after: data.role,
        reason: data.reason,
      });
      return { ok: true };
    });
  });
export const authCapabilities = createServerFn({ method: "GET" }).handler(async () => ({
  google:
    (await configuration(await getSql())).google &&
    Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  emailReset: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
}));
