import { getSessionUser, UnauthorizedError } from "@/lib/auth/verify.server";
import { isAdminEmail } from "./admin";

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

/** Require a signed-in user whose email is in ADMIN_EMAILS / ADMIN_EMAIL. */
export async function requireAdmin(bearerToken?: string) {
  const user = await getSessionUser(bearerToken);
  if (!user) throw new UnauthorizedError();
  if (!isAdminEmail(user.email)) throw new ForbiddenError();
  return user;
}
