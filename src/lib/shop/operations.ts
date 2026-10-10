import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { configurationSchema } from "./settings-schema";
import {
  configuration,
  audit,
  notify,
  limit,
  changeWallet,
  refundOrder,
  deliverOrder,
  createClaim,
  reviewPayment,
  giftHash,
  redeemGift,
} from "./operations-service.server";
import { isAdminEmail } from "./admin";
import { randomUUID } from "node:crypto";
import { CommerceError } from "./commerce.server";
const id = z.string().trim().min(1).max(200);
const reason = z.string().trim().min(3).max(2000);
async function safe<T>(work: () => Promise<T>) {
  try {
    return { ok: true as const, result: await work() };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof CommerceError
          ? error.message
          : "ทำรายการไม่สำเร็จ กรุณาตรวจสอบข้อมูลหรือติดต่อทีมงาน",
    };
  }
}
export const getSiteConfiguration = createServerFn({ method: "GET" }).handler(async () =>
  configuration(await getSql()),
);
export const saveSiteConfiguration = createServerFn({ method: "POST" })
  .validator((v: unknown) => configurationSchema.parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    safe(async () => {
      await requirePermission(String(context.userId), "system.manage", context.bearerToken);
      const sql = await getSql();
      await sql.transaction(async (tx) => {
        const before = await configuration(tx);
        await tx.query("UPDATE site_configuration SET value=$1,updated_at=now() WHERE id=1", [
          JSON.stringify(data),
        ]);
        await audit(tx, String(context.userId), "settings.updated", "configuration", "1", {
          before,
          after: data,
        });
      });
      return data;
    }),
  );
export const adjustWallet = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        userId: id,
        amount: z
          .number()
          .int()
          .min(-100000000)
          .max(100000000)
          .refine((v) => v !== 0),
        reason,
        key: z.string().uuid(),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    safe(async () => {
      await requirePermission(String(context.userId), "wallet.manage", context.bearerToken);
      return changeWallet(
        await getSql(),
        String(context.userId),
        data.userId,
        data.amount,
        data.reason,
        data.key,
      );
    }),
  );
export const refundOrderAction = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ orderId: id, reason }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    safe(async () => {
      await requirePermission(String(context.userId), "wallet.manage", context.bearerToken);
      return refundOrder(await getSql(), String(context.userId), data.orderId, data.reason);
    }),
  );
export const deliverOrderAction = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        orderId: id,
        payload: z.string().trim().min(1).max(20000),
        replacement: z.boolean().default(false),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    safe(async () => {
      await requirePermission(
        String(context.userId),
        data.replacement ? "claims.manage" : "orders.manage",
        context.bearerToken,
      );
      return deliverOrder(
        await getSql(),
        String(context.userId),
        data.orderId,
        data.payload,
        data.replacement,
      );
    }),
  );
export const fileClaim = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z.object({ orderId: id, title: z.string().trim().min(1).max(200), message: reason }).parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    safe(async () => {
      const sql = await getSql();
      await limit(sql, `claim:${context.userId}`, 10);
      return createClaim(sql, String(context.userId), data.orderId, data.title, data.message);
    }),
  );
export const resolveClaim = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({ id, status: z.enum(["accepted", "rejected", "closed", "replaced"]), reply: reason })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    safe(async () => {
      await requirePermission(String(context.userId), "claims.manage", context.bearerToken);
      const sql = await getSql();
      return sql.transaction(async (tx) => {
        const [claim] = await tx.query<{ user_id: string }>(
          "UPDATE claims SET status=$2,reply=$3,updated_at=now() WHERE id=$1 RETURNING user_id",
          [data.id, data.status, data.reply],
        );
        if (!claim) throw new CommerceError("ไม่พบเคลม");
        await audit(tx, String(context.userId), "claim.resolved", "claim", data.id, {
          status: data.status,
          reply: data.reply,
        });
        await notify(tx, claim.user_id, "เคลมได้รับการอัปเดต", data.reply);
        return { ok: true };
      });
    }),
  );
export const reviewTopup = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id,
        approve: z.boolean(),
        verifiedAmount: z.number().int().min(0).max(100000000),
        reference: z.string().trim().max(200),
        reason,
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    safe(async () => {
      await requirePermission(String(context.userId), "topups.manage", context.bearerToken);
      return reviewPayment(
        await getSql(),
        String(context.userId),
        data.id,
        data.approve,
        data.reference,
        data.reason,
        data.verifiedAmount,
      );
    }),
  );
export const redeemGiftCode = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z.object({ code: z.string().trim().min(6).max(128), key: z.string().uuid() }).parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    safe(async () => {
      const sql = await getSql();
      await limit(sql, `gift:${context.userId}`, 5);
      return redeemGift(sql, String(context.userId), data.code, data.key);
    }),
  );
export const createGiftCode = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        label: z.string().trim().min(1).max(120),
        reward: z.enum(["credit", "product"]),
        amount: z.number().int().min(0).max(1000000),
        productId: id.optional(),
        usageLimit: z.number().int().min(1).max(100000),
        expiresAt: z.string().datetime().nullable(),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    safe(async () => {
      await requirePermission(String(context.userId), "gift_codes.manage", context.bearerToken);
      if (data.reward === "product" && !data.productId) throw new CommerceError("ต้องเลือกสินค้า");
      if (data.reward === "credit" && data.amount <= 0) throw new CommerceError("ต้องกำหนดเครดิต");
      const { randomBytes } = await import("node:crypto");
      const code = randomBytes(16).toString("hex").toUpperCase();
      const giftId = randomUUID();
      const sql = await getSql();
      await sql.transaction(async (tx) => {
        await tx.query(
          "INSERT INTO gift_codes(id,code_hash,label,reward,amount,product_id,usage_limit,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            giftId,
            giftHash(code),
            data.label,
            data.reward,
            data.amount,
            data.productId ?? null,
            data.usageLimit,
            data.expiresAt,
          ],
        );
        await audit(tx, String(context.userId), "gift.created", "gift", giftId, {
          label: data.label,
          reward: data.reward,
        });
      });
      return { code, id: giftId };
    }),
  );
export const saveCoupon = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        code: z
          .string()
          .trim()
          .min(3)
          .max(40)
          .transform((v) => v.toUpperCase()),
        kind: z.enum(["fixed", "percent"]),
        amount: z.number().int().min(1).max(1000000),
        minimum: z.number().int().min(0),
        productId: id.nullable(),
        categoryId: id.nullable(),
        active: z.boolean(),
        expiresAt: z.string().datetime().nullable(),
        usageLimit: z.number().int().min(1).max(1000000),
        perUserLimit: z.number().int().min(1).max(1000),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    safe(async () => {
      await requirePermission(String(context.userId), "promotions.manage", context.bearerToken);
      if (data.kind === "percent" && data.amount > 100)
        throw new CommerceError("เปอร์เซ็นต์เกิน 100");
      const sql = await getSql();
      await sql.transaction(async (tx) => {
        await tx.query(
          "INSERT INTO coupons(id,code,kind,amount,minimum,product_id,category_id,active,expires_at,usage_limit,per_user_limit) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(code) DO UPDATE SET kind=excluded.kind,amount=excluded.amount,minimum=excluded.minimum,product_id=excluded.product_id,category_id=excluded.category_id,active=excluded.active,expires_at=excluded.expires_at,usage_limit=GREATEST(coupons.used,excluded.usage_limit),per_user_limit=excluded.per_user_limit",
          [
            randomUUID(),
            data.code,
            data.kind,
            data.amount,
            data.minimum,
            data.productId,
            data.categoryId,
            data.active,
            data.expiresAt,
            data.usageLimit,
            data.perUserLimit,
          ],
        );
        await audit(tx, String(context.userId), "coupon.saved", "coupon", data.code, {
          active: data.active,
        });
      });
      return { ok: true };
    }),
  );
const safeLink = z
  .string()
  .max(2048)
  .refine((v) => !v || /^\/(?!\/)/.test(v) || /^https:\/\//.test(v));
export const saveContent = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        id: id.optional(),
        kind: z.enum(["banner", "announcement"]),
        title: z.string().min(1).max(200),
        body: z.string().max(5000),
        image: safeLink,
        link: safeLink,
        audience: z.enum(["all", "members"]),
        priority: z.number().int().min(0).max(10000),
        active: z.boolean(),
        startsAt: z.string().datetime().nullable(),
        endsAt: z.string().datetime().nullable(),
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    safe(async () => {
      await requirePermission(String(context.userId), "promotions.manage", context.bearerToken);
      if (data.startsAt && data.endsAt && data.startsAt >= data.endsAt)
        throw new CommerceError("วันสิ้นสุดต้องอยู่หลังวันเริ่ม");
      const sql = await getSql();
      const blockId = data.id ?? randomUUID();
      await sql.transaction(async (tx) => {
        await tx.query(
          "INSERT INTO content_blocks(id,kind,title,body,image,link,audience,priority,active,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,image=excluded.image,link=excluded.link,audience=excluded.audience,priority=excluded.priority,active=excluded.active,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=now()",
          [
            blockId,
            data.kind,
            data.title,
            data.body,
            data.image,
            data.link,
            data.audience,
            data.priority,
            data.active,
            data.startsAt,
            data.endsAt,
          ],
        );
        await audit(tx, String(context.userId), "content.saved", "content", blockId, {
          kind: data.kind,
        });
      });
      return { id: blockId };
    }),
  );
export const publicContent = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  return sql.query<{
    id: string;
    kind: string;
    title: string;
    body: string;
    image: string;
    link: string;
  }>(
    "SELECT id,kind,title,body,image,link FROM content_blocks WHERE active=true AND audience='all' AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now()) ORDER BY priority DESC,updated_at DESC LIMIT 30",
  );
});
export const memberContent = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return sql.query<{
      id: string;
      kind: string;
      title: string;
      body: string;
      image: string;
      link: string;
    }>(
      "SELECT id,kind,title,body,image,link FROM content_blocks WHERE active=true AND audience IN ('all','members') AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now()) ORDER BY priority DESC,updated_at DESC LIMIT 30",
    );
  });
export const myAccountData = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const user = String(context.userId);
    const [profile] = await sql.query<{
      id: string;
      name: string;
      email: string;
      image: string | null;
      created_at: string;
      rank: string;
      rank_color: string;
      spending: number;
      orders: number;
      topups: number;
    }>(
      `SELECT u.id,u.name,u.email,u.image,u."createdAt"::text AS created_at,COALESCE(m.rank,'New Member') AS rank,COALESCE(m.rank_color,'#64748b') AS rank_color,(SELECT COALESCE(sum(total),0)::int FROM orders WHERE user_id=u.id AND status='completed') AS spending,(SELECT count(*)::int FROM orders WHERE user_id=u.id) AS orders,(SELECT COALESCE(sum(credit),0)::int FROM payments WHERE user_id=u.id AND status='success') AS topups FROM "user" u LEFT JOIN member_profiles m ON m.user_id=u.id WHERE u.id=$1`,
      [user],
    );
    const claims = await sql.query<{
      id: string;
      order_id: string;
      title: string;
      message: string;
      status: string;
      reply: string;
      created_at: string;
    }>(
      "SELECT id,order_id,title,message,status,reply,created_at::text FROM claims WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
      [user],
    );
    const notifications = await sql.query<{
      id: string;
      title: string;
      body: string;
      read_at: string | null;
      created_at: string;
    }>(
      "SELECT id,title,body,read_at::text,created_at::text FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
      [user],
    );
    const ledger = await sql.query<{
      id: string;
      amount: number;
      balance_after: number;
      reason: string;
      created_at: string;
    }>(
      "SELECT id,amount,balance_after,reason,created_at::text FROM wallet_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
      [user],
    );
    return { profile, claims, notifications, ledger };
  });
export const setMember = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        userId: id,
        name: z.string().trim().min(1).max(120),
        rank: z.string().trim().min(1).max(80),
        color: z.string().regex(/^#[a-f\d]{6}$/i),
        disabled: z.boolean(),
        reason,
      })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    safe(async () => {
      await requirePermission(String(context.userId), "users.manage", context.bearerToken);
      const sql = await getSql();
      const [privileged] = await sql.query<{
        email: string;
        emailVerified: boolean;
        privileged: boolean;
      }>(
        "SELECT u.email,u.\"emailVerified\",EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role_id IN ('admin','super_admin')) AS privileged FROM \"user\" u WHERE u.id=$1",
        [data.userId],
      );
      if (
        privileged &&
        (privileged.privileged || (privileged.emailVerified && isAdminEmail(privileged.email)))
      )
        await requirePermission(String(context.userId), "system.manage", context.bearerToken);
      await sql.transaction(async (tx) => {
        const [target] = await tx.query('SELECT id FROM "user" WHERE id=$1', [data.userId]);
        if (!target) throw new CommerceError("ไม่พบสมาชิก");
        if (data.userId === context.userId && data.disabled)
          throw new CommerceError("ปิดบัญชีตนเองไม่ได้");
        await tx.query('UPDATE "user" SET name=$2,"updatedAt"=now() WHERE id=$1', [
          data.userId,
          data.name,
        ]);
        await tx.query(
          "INSERT INTO member_profiles(user_id,rank,rank_color,disabled) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET rank=excluded.rank,rank_color=excluded.rank_color,disabled=excluded.disabled,updated_at=now()",
          [data.userId, data.rank, data.color, data.disabled],
        );
        if (data.disabled) await tx.query('DELETE FROM "session" WHERE "userId"=$1', [data.userId]);
        await audit(tx, String(context.userId), "member.updated", "user", data.userId, {
          rank: data.rank,
          disabled: data.disabled,
          reason: data.reason,
        });
      });
      return { ok: true };
    }),
  );
export const submitTrueMoneyGift = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({ url: z.string().url().max(2048), amount: z.number().int().min(1).max(100000000) })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) =>
    safe(async () => {
      const { paymentProviders } = await import("./payment-providers.server");
      await paymentProviders.trueMoneyGift.verify({
        amount: data.amount,
        receiver: "",
        giftUrl: data.url,
      });
      const sql = await getSql();
      const settings = await configuration(sql);
      if (!settings.trueMoney || settings.maintenance)
        throw new CommerceError("ช่องทางนี้ปิดชั่วคราว");
      if (data.amount < settings.minimumTopup || data.amount > settings.maximumTopup)
        throw new CommerceError("ยอดเงินอยู่นอกช่วงที่กำหนด");
      await limit(sql, `gift-link:${context.userId}`, 5);
      const url = new URL(data.url);
      const token = url.searchParams.get("v");
      if (
        url.protocol !== "https:" ||
        url.hostname !== "gift.truemoney.com" ||
        !/^\/campaign\/?$/.test(url.pathname) ||
        !token ||
        !/^[a-z\d]{6,128}$/i.test(token) ||
        url.username ||
        url.password
      )
        throw new CommerceError("ลิงก์ซองของขวัญไม่ถูกต้อง");
      const { createHash } = await import("node:crypto");
      const hash = "gift:" + createHash("sha256").update(token).digest("hex");
      const [existing] = await sql.query<{ id: string; user_id: string }>(
        "SELECT id,user_id FROM payments WHERE slip_hash=$1",
        [hash],
      );
      if (existing) {
        if (existing.user_id !== context.userId) throw new CommerceError("ลิงก์นี้เคยส่งแล้ว");
        return { paymentId: existing.id, pending: true };
      }
      const id = randomUUID();
      const { encryptInventory } = await import("./inventory-crypto.server");
      const sealed = encryptInventory(`gift:${id}`, url.toString());
      const [feeSetting] = await sql.query<{ wallet_fee: number }>(
        "SELECT wallet_fee FROM shop_settings WHERE id=1",
      );
      await sql.query(
        "INSERT INTO payments(id,user_id,method,amount,fee,credit,status,provider,slip_hash,gift_ciphertext,reject_reason) VALUES($1,$2,'truewallet',$3,$4,0,'pending','manual-gift',$5,$6,'รอทีมงานตรวจผ่านช่องทางที่ได้รับอนุญาต')",
        [
          id,
          context.userId,
          data.amount,
          Math.ceil(data.amount * (feeSetting.wallet_fee / 100)),
          hash,
          sealed.ciphertext,
        ],
      );
      return { paymentId: id, pending: true };
    }),
  );
export const getManualGift = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "topups.manage", context.bearerToken);
    const sql = await getSql();
    const [payment] = await sql.query<{ gift_ciphertext: string; status: string }>(
      "SELECT gift_ciphertext,status FROM payments WHERE id=$1",
      [data.id],
    );
    if (!payment?.gift_ciphertext) throw new CommerceError("ไม่พบซองของขวัญ");
    const { decryptInventory } = await import("./inventory-crypto.server");
    await audit(sql, String(context.userId), "gift-link.viewed", "payment", data.id);
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("Cache-Control", "private, no-store");
    return { url: decryptInventory(`gift:${data.id}`, payment.gift_ciphertext) };
  });
