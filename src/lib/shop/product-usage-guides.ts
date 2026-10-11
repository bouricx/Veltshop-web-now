import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import {
  readProductUsageGuides,
  saveProductUsageGuides,
} from "./product-usage-guides-service.server";

export const getAdminProductUsageGuides = createServerFn({ method: "GET" })
  .validator((v: unknown) =>
    z.object({ productIds: z.array(z.string().min(1).max(160)).min(1).max(30) }).parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "orders.manage");
    return readProductUsageGuides(await getSql(), data.productIds);
  });

export const saveAdminProductUsageGuides = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        guides: z
          .array(
            z.object({
              productId: z.string().min(1).max(160),
              instructions: z.string().trim().min(1).max(10000),
              expectedVersion: z.number().int().min(0),
            }),
          )
          .min(1)
          .max(30),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const actor = String(context.userId);
    await requirePermission(actor, "orders.manage");
    return saveProductUsageGuides(await getSql(), actor, data.guides);
  });
