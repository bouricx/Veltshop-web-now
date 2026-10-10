import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { exportPersonalData, requestDeletion, reviewDeletion } from "./privacy-service.server";
import { limit } from "./operations-service.server";
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await limit(sql, `privacy-export:${context.userId}`, 3);
    return { encoded: JSON.stringify(await exportPersonalData(sql, String(context.userId))) };
  });
export const requestMyDeletion = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z.object({ reason: z.string().trim().min(3).max(2000), confirmed: z.literal(true) }).parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await limit(sql, `privacy-delete:${context.userId}`, 3);
    return requestDeletion(sql, String(context.userId), data.reason);
  });
export type PrivacyRequest = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  status: string;
  reason: string;
  reply: string;
  created_at: string;
};
export const listPrivacyRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requirePermission(String(context.userId), "system.manage", context.bearerToken);
    return (await getSql()).query<PrivacyRequest>(
      'SELECT r.id,r.user_id,u.name,u.email,r.status,r.reason,r.reply,r.created_at::text FROM privacy_requests r JOIN "user" u ON u.id=r.user_id ORDER BY r.created_at DESC LIMIT 100',
    );
  });
export const reviewPrivacyRequest = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        approve: z.boolean(),
        reply: z.string().trim().min(3).max(2000),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await requirePermission(String(context.userId), "system.manage", context.bearerToken);
    return reviewDeletion(
      await getSql(),
      String(context.userId),
      data.id,
      data.approve,
      data.reply,
    );
  });
