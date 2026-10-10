import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { importRecords } from "./import-service.server";
import { CommerceError } from "./commerce.server";
export const importShopData = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({
        kind: z.enum(["products", "gifts"]),
        rows: z.array(z.unknown()).min(1).max(200),
        key: z.string().uuid(),
      })
      .parse(value),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(
      String(context.userId),
      data.kind === "products" ? "products.manage" : "gift_codes.manage",
      context.bearerToken,
    );
    try {
      return {
        ok: true as const,
        result: await importRecords(
          await getSql(),
          String(context.userId),
          data.kind,
          data.rows,
          data.key,
        ),
      };
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof CommerceError
            ? error.message
            : "นำเข้าไม่สำเร็จ กรุณาตรวจรหัสสินค้า หมวด และโค้ดซ้ำ รายการทั้งหมดถูกยกเลิก",
      };
    }
  });
