import { getSessionUser, UnauthorizedError } from "@/lib/auth/verify.server";
import { getSql } from "@/lib/db";
import { isAdminEmail } from "./admin";

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

/** Require a signed-in user whose email is in ADMIN_EMAILS / ADMIN_EMAIL. */
export async function requireAdmin(bearerToken?: string, permission = "products.manage") {
  const user = await getSessionUser(bearerToken);
  if (!user) throw new UnauthorizedError();
  if (!(user.emailVerified && isAdminEmail(user.email))) {
    const sql = await getSql();
    const [row] = await sql.query<{ allowed: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id WHERE ur.user_id=$1 AND rp.permission_id=$2) AS allowed",
      [user.id, permission],
    );
    if (!row?.allowed) throw new ForbiddenError();
  }
  return user;
}
