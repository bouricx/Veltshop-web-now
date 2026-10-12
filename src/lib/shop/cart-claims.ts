import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "../db";
import { requirePermission } from "./permissions.server";
import {
  cartClaimEligibility,
  createCartClaim,
  reviewCartClaim,
  type CartClaim,
} from "./cart-claims-service.server";
import { CommerceError } from "./commerce.server";
import { limit } from "./operations-service.server";
const requestId = z.string().uuid();
export const getCartClaims = createServerFn({ method: "GET" })
  .validator((v: unknown) => z.object({ requestId }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    cartClaimEligibility(await getSql(), String(context.userId), data.requestId),
  );
export const fileCartClaim = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        requestId,
        productId: z.string().min(1).max(160),
        title: z.string().trim().min(1).max(200),
        message: z.string().trim().min(3).max(2000),
        evidence: z
          .union([
            z.literal(""),
            z
              .url()
              .max(2048)
              .refine((v) => new URL(v).protocol === "https:"),
          ])
          .default(""),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const sql = await getSql();
      await limit(sql, `cart-claim:${context.userId}`, 10);
      return { ok: true as const, claim: await createCartClaim(sql, String(context.userId), data) };
    } catch (e) {
      return {
        ok: false as const,
        message: e instanceof CommerceError ? e.message : "ส่งเคลมไม่สำเร็จ",
      };
    }
  });
export const listAdminCartClaims = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requirePermission(String(context.userId), "claims.manage", context.bearerToken);
    return (await getSql()).query<{ result: CartClaim }>(
      "SELECT result FROM operation_keys WHERE kind='cart_claim' ORDER BY created_at DESC LIMIT 100",
    );
  });
export const resolveCartClaim = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id: requestId,
        status: z.enum(["accepted", "rejected", "closed", "replaced", "refunded"]),
        reply: z.string().trim().min(3).max(2000),
        replacement: z.string().trim().max(10000).optional(),
        confirmed: z.literal(true),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "claims.manage", context.bearerToken);
    if (data.status === "refunded")
      await requirePermission(String(context.userId), "wallet.manage", context.bearerToken);
    try {
      return {
        ok: true as const,
        result: await reviewCartClaim(await getSql(), String(context.userId), data),
      };
    } catch (e) {
      return {
        ok: false as const,
        message: e instanceof CommerceError ? e.message : "บันทึกเคลมไม่สำเร็จ",
      };
    }
  });
