import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { CommerceError } from "./commerce.server";
import { conversationInput, orderMessageInput, deliveryEditInput } from "./order-support-policy";
import {
  listOrderMessages,
  sendOrderMessage,
  readAdminDeliveryEditor,
  editDeliveredOrder,
} from "./order-support-service.server";

export const getMyOrderConversation = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(conversationInput)
  .handler(async ({ data, context }) =>
    listOrderMessages(
      await getSql(),
      { actorId: context.userId, admin: false },
      data.id,
      data.before,
    ),
  );
export const getAdminOrderConversation = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(conversationInput)
  .handler(async ({ data, context }) => {
    await requirePermission(context.userId, "orders.manage", context.bearerToken);
    return listOrderMessages(
      await getSql(),
      { actorId: context.userId, admin: true },
      data.id,
      data.before,
    );
  });
export const sendMyOrderMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(orderMessageInput)
  .handler(async ({ data, context }) => {
    try {
      return await sendOrderMessage(
        await getSql(),
        { actorId: context.userId, admin: false },
        data,
      );
    } catch (e) {
      return {
        ok: false as const,
        message:
          e instanceof CommerceError
            ? e.message
            : "ส่งข้อความไม่สำเร็จ กรุณาลองใหม่ด้วยข้อความเดิม",
      };
    }
  });
export const sendAdminOrderMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(orderMessageInput)
  .handler(async ({ data, context }) => {
    await requirePermission(context.userId, "orders.manage", context.bearerToken);
    try {
      return await sendOrderMessage(await getSql(), { actorId: context.userId, admin: true }, data);
    } catch (e) {
      return {
        ok: false as const,
        message:
          e instanceof CommerceError
            ? e.message
            : "ส่งข้อความไม่สำเร็จ กรุณาลองใหม่ด้วยข้อความเดิม",
      };
    }
  });
export const getAdminDeliveryEditor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requirePermission(context.userId, "orders.manage", context.bearerToken);
    return readAdminDeliveryEditor(await getSql(), context.userId, data.id);
  });
export const saveAdminDeliveryCorrection = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(deliveryEditInput)
  .handler(async ({ data, context }) => {
    await requirePermission(context.userId, "orders.manage", context.bearerToken);
    try {
      return await editDeliveredOrder(await getSql(), context.userId, data);
    } catch (e) {
      return {
        ok: false as const,
        message:
          e instanceof CommerceError
            ? e.message
            : "ยังยืนยันผลการบันทึกไม่ได้ กรุณาลองด้วยข้อมูลเดิมหรือโหลดฉบับล่าสุด",
      };
    }
  });
