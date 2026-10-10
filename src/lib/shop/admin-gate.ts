import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSessionUser } from "@/lib/auth/verify.server";
import { getSql } from "@/lib/db";
import { isAdminEmail } from "./admin";

/** Return whether the signed-in user is an admin (from ADMIN_EMAILS). */
export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = await getSessionUser(context.bearerToken);
    const email = user?.email ?? null;
    const sql = await getSql();
    const rows = await sql.query<{ permission_id: string }>(
      "SELECT DISTINCT rp.permission_id FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id WHERE ur.user_id=$1",
      [context.userId],
    );
    const permissions = rows.map((r) => r.permission_id);
    return {
      userId: context.userId as string,
      email,
      isAdmin:
        Boolean(user?.emailVerified && isAdminEmail(email)) ||
        permissions.some((p) => p !== "catalog.read"),
      permissions: user?.emailVerified && isAdminEmail(email) ? ["*"] : permissions,
    };
  });
