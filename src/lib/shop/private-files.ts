import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { addPrivateFile } from "./private-files-service.server";
export const uploadPrivateStock = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        productId: z.string().min(1).max(160),
        name: z.string().min(1).max(250),
        encoded: z.string().min(1).max(2796204),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "stock.manage", context.bearerToken);
    return addPrivateFile(await getSql(), String(context.userId), data);
  });
