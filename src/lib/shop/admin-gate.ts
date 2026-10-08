import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSessionUser } from "@/lib/auth/verify.server";
import { isAdminEmail } from "./admin";

/** Return whether the signed-in user is an admin (from ADMIN_EMAILS). */
export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = await getSessionUser(context.bearerToken);
    const email = user?.email ?? null;
    return {
      userId: context.userId as string,
      email,
      isAdmin: isAdminEmail(email),
    };
  });
