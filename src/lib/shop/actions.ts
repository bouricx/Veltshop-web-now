import { LIST_ONLY_STORE, listOnlyMessage } from "./store-mode";
import { configuration, limit, audit } from "./operations-service.server";
import { paymentProviders } from "./payment-providers.server";
import { z } from "zod";
import { CommerceError, purchase, creditVerifiedSlip } from "./commerce.server";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireAdmin } from "@/lib/shop/require-admin.server";
import { getSql } from "@/lib/db";
import { categories as seedCats, type Product } from "@/lib/shop/catalog";
import { randomUUID } from "node:crypto";
import { uid } from "@/lib/utils";
import { categoryInputSchema, productInputSchema } from "./validation";
import { slipImageToBlob, VERIFIER_PROMPTPAY } from "@/lib/shop/slip-verify-upstream.server";

function bearerOf(context: { bearerToken?: string }): string | undefined {
  return context.bearerToken;
}

export type CategoryRow = {
  id: string;
  label: string;
  hint: string;
  sort_order: number;
  visible: boolean;
  image?: string;
  icon?: string;
  color?: string;
};

export type ProductInput = {
  id?: string;
  name: string;
  subtitle: string;
  category: string;
  price: number;
  compareAt?: number | null;
  stock: number;
  image: string;
  delivery: Product["delivery"];
  warrantyDays?: number;
  cardColor?: string;
  borderColor?: string;
  accentColor?: string;
  badgeColor?: string;
  description?: string;
  icon?: string;
  badge?: string;
  sortOrder?: number;
  featured?: boolean;
  flash?: boolean;
  active?: boolean;
};

export type PaymentRow = {
  id: string;
  method: string;
  amount: number;
  fee: number;
  credit: number;
  status: string;
  provider: string;
  slip_hash: string | null;
  reject_reason: string | null;
  has_slip: boolean;
  created_at: string;
};

export type ShopSettings = {
  /** Legacy UI field; wallet verification uses the official Slip2Go adapter. */
  slip_provider: "thunder" | "slip2go";
  wallet_fee: number;
  /**
   * Display / QR destination. Server settings must match PROMPTPAY_RECEIVER.
   */
  receive_account: string;
  receive_name: string;
  wallet_phone: string;
};

type ProductRow = {
  id: string;
  name: string;
  subtitle: string;
  category_id: string;
  price: number;
  compare_at: number | null;
  stock: number;
  stock_mode: "quantity" | "individual";
  image: string;
  delivery: string;
  warranty_days: number;
  card_color: string;
  border_color: string;
  accent_color: string;
  badge_color: string;
  description: string;
  icon: string;
  badge: string;
  sort_order: number;
  featured: boolean;
  flash: boolean;
  active: boolean;
};

function mapProduct(row: ProductRow): Product & { active: boolean } {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    category: row.category_id as Product["category"],
    price: Number(row.price),
    compareAt: row.compare_at == null ? undefined : Number(row.compare_at),
    stock: Number(row.stock),
    stockMode: row.stock_mode,
    image: row.image,
    delivery: row.delivery as Product["delivery"],
    warrantyDays: row.warranty_days,
    cardColor: row.card_color,
    borderColor: row.border_color || undefined,
    accentColor: row.accent_color || undefined,
    badgeColor: row.badge_color || undefined,
    description: row.description,
    icon: row.icon,
    badge: row.badge,
    sortOrder: row.sort_order,
    featured: Boolean(row.featured),
    flash: Boolean(row.flash),
    active: Boolean(row.active),
  };
}

async function ensureSeed() {
  // Categories only — never auto-insert demo/SKU products (admin adds compliant stock).
  const sql = await getSql();
  let i = 0;
  for (const c of seedCats) {
    await sql`
      insert into categories (id, label, hint, sort_order, visible)
      values (${c.id}, ${c.label}, ${c.hint}, ${i}, true)
      on conflict (id) do nothing
    `;
    i += 1;
  }
}

async function readSettings(): Promise<ShopSettings> {
  const sql = await getSql();
  const rows = await sql<ShopSettings>`
    select slip_provider, wallet_fee, receive_account, receive_name, wallet_phone
    from shop_settings where id = 1
  `;
  return (
    rows[0] ?? {
      slip_provider: "thunder",
      wallet_fee: 3,
      receive_account: VERIFIER_PROMPTPAY,
      receive_name: "VELTSHOP",
      wallet_phone: "0928160016",
    }
  );
}

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSeed();
  const sql = await getSql();
  return sql<CategoryRow>`
    select id, label, hint, sort_order, visible, image, icon, color
    from categories
    where visible = true
    order by sort_order, label
  `;
});

/** Admin: all categories including hidden. */
export const listAllCategories = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(bearerOf(context), "catalog.manage");
    await ensureSeed();
    const sql = await getSql();
    return sql<CategoryRow>`
      select id, label, hint, sort_order, visible, image, icon, color
      from categories
      order by sort_order, label
    `;
  });

export type CategoryInput = {
  id: string;
  label: string;
  hint: string;
  sort_order: number;
  visible: boolean;
  image?: string;
  icon?: string;
  color?: string;
};

/** Admin: rename / reorder / show-hide a category chip. Id is fixed (used by products). */
export const saveCategory = createServerFn({ method: "POST" })
  .validator((d: CategoryInput) => categoryInputSchema.parse(d))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireAdmin(bearerOf(context), "catalog.manage");
    const id = String(data.id || "").trim();
    const label = String(data.label || "").trim();
    const hint = String(data.hint || "").trim();
    if (!id) return { ok: false as const, message: "ไม่พบหมวด" };
    if (!label) return { ok: false as const, message: "ใส่ชื่อหมวดก่อน" };
    const connection = await getSql();
    return connection.transaction(async (sql) => {
      const exists = await sql<{ id: string }>`select id from categories where id = ${id}`;
      if (!exists[0]) {
        await sql`
        insert into categories (id, label, hint, sort_order, visible, image, icon, color)
        values (${id}, ${label}, ${hint || label}, ${Math.max(0, Math.round(Number(data.sort_order) || 0))}, ${Boolean(data.visible)}, ${data.image ?? ""}, ${data.icon ?? ""}, ${data.color ?? "#18181b"})
      `;
        await audit(sql, String(context.userId), "category.created", "category", id, { label });
        return { ok: true as const, message: "สร้างหมวดสินค้าแล้ว" };
      }
      await sql`
      update categories
      set label = ${label},
          hint = ${hint || label},
          sort_order = ${Math.max(0, Math.round(Number(data.sort_order) || 0))},
          visible = ${Boolean(data.visible)}, image = ${data.image ?? ""}, icon = ${data.icon ?? ""}, color = ${data.color ?? "#18181b"}
      where id = ${id}
    `;
      await audit(sql, String(context.userId), "category.saved", "category", id, {
        label,
        visible: data.visible,
      });
      return { ok: true as const, message: "บันทึกหมวดแล้ว" };
    });
  });

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSeed();
  const sql = await getSql();
  const rows = await sql<ProductRow>`
    select id, name, subtitle, category_id, price, compare_at, stock, stock_mode, image, delivery, warranty_days, card_color, border_color, accent_color, badge_color, description, icon, badge, sort_order, featured, flash, active
    from products
    where active = true
    order by sort_order, featured desc, name
  `;
  return rows.map(mapProduct);
});

export const getPublicProduct = createServerFn({ method: "GET" })
  .validator((v: unknown) => z.object({ id: z.string().min(1).max(160) }).parse(v))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows =
      await sql<ProductRow>`SELECT id,name,subtitle,category_id,price,compare_at,stock,stock_mode,image,delivery,warranty_days,card_color,border_color,accent_color,badge_color,description,icon,badge,sort_order,featured,flash,active FROM products WHERE id=${data.id} AND active=true`;
    return rows[0] ? mapProduct(rows[0]) : null;
  });

export const listAllProducts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(bearerOf(context));
    await ensureSeed();
    const sql = await getSql();
    const rows = await sql<ProductRow>`
      select id, name, subtitle, category_id, price, compare_at, stock, stock_mode, image, delivery, warranty_days, card_color, border_color, accent_color, badge_color, description, icon, badge, sort_order, featured, flash, active
      from products
      order by updated_at desc
    `;
    return rows.map(mapProduct);
  });

export const saveProduct = createServerFn({ method: "POST" })
  .validator((d: ProductInput) => productInputSchema.parse(d))

  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireAdmin(bearerOf(context));
    const name = data.name.trim();
    if (!name) return { ok: false as const, message: "ใส่ชื่อสินค้าก่อน" };
    const price = Math.max(0, Math.round(Number(data.price) || 0));
    const stock = Math.max(0, Math.round(Number(data.stock) || 0));
    const id = data.id?.trim() || `p_${randomUUID()}`;
    const connection = await getSql();
    return connection.transaction(async (sql) => {
      const cats = await sql<{ id: string }>`select id from categories where id = ${data.category}`;
      if (!cats[0]) return { ok: false as const, message: "หมวดสินค้าไม่ถูกต้อง" };
      await sql`
      insert into products (
        id, name, subtitle, category_id, price, compare_at, stock, image, delivery, warranty_days, card_color, border_color, accent_color, badge_color, description, icon, badge, sort_order, featured, flash, active, updated_at
      ) values (
        ${id}, ${name}, ${data.subtitle.trim()}, ${data.category}, ${price},
        ${data.compareAt ? Math.round(Number(data.compareAt)) : null},
        ${stock}, ${data.image || "/images/cat-stream.jpg"}, ${data.delivery}, ${data.warrantyDays ?? 0}, ${data.cardColor ?? "#18181b"}, ${data.borderColor ?? ""}, ${data.accentColor ?? ""}, ${data.badgeColor ?? ""}, ${data.description ?? ""}, ${data.icon ?? ""}, ${data.badge ?? ""}, ${data.sortOrder ?? 0},
        ${Boolean(data.featured)}, ${Boolean(data.flash)}, ${data.active !== false}, now()
      )
      on conflict (id) do update set
        name = excluded.name,
        subtitle = excluded.subtitle,
        category_id = excluded.category_id,
        price = excluded.price,
        compare_at = excluded.compare_at,
        stock = CASE WHEN products.stock_mode = 'individual' THEN products.stock ELSE excluded.stock END,
        image = excluded.image,
        delivery = excluded.delivery,
        warranty_days=excluded.warranty_days,card_color=excluded.card_color,border_color=excluded.border_color,accent_color=excluded.accent_color,badge_color=excluded.badge_color,description=excluded.description,icon=excluded.icon,badge=excluded.badge,sort_order=excluded.sort_order,
        featured = excluded.featured,
        flash = excluded.flash,
        active = excluded.active,
        updated_at = now()
    `;
      const rows = await sql<ProductRow>`
      select id, name, subtitle, category_id, price, compare_at, stock, stock_mode, image, delivery, warranty_days, card_color, border_color, accent_color, badge_color, description, icon, badge, sort_order, featured, flash, active
      from products where id = ${id}
    `;
      await audit(sql, String(context.userId), "product.saved", "product", id, {
        price,
        active: data.active !== false,
        cardColor: data.cardColor,
        borderColor: data.borderColor,
        accentColor: data.accentColor,
        badgeColor: data.badgeColor,
      });
      return { ok: true as const, product: mapProduct(rows[0]), message: "บันทึกสินค้าแล้ว" };
    });
  });

export const checkoutProduct = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({
        id: z.string().trim().min(1).max(160),
        idempotencyKey: z.string().uuid(),
        coupon: z.string().max(40).optional(),
        customerInput: z.string().max(2000).optional(),
      })
      .parse(value),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    if (LIST_ONLY_STORE) return { ok: false as const, message: listOnlyMessage };
    try {
      await limit(await getSql(), `checkout:${context.userId}`, 20);
      const result = await purchase(
        await getSql(),
        String(context.userId),
        data.id,
        data.idempotencyKey,
        { coupon: data.coupon, customerInput: data.customerInput },
      );
      return {
        ok: true as const,
        ...result,
        message:
          result.status === "completed"
            ? "จัดส่งสินค้าสำเร็จแล้ว"
            : "รับคำสั่งซื้อแล้ว · รอดำเนินการจัดส่ง",
      };
    } catch (error) {
      if (error instanceof CommerceError) return { ok: false as const, message: error.message };
      return { ok: false as const, message: "ทำรายการไม่สำเร็จ โปรดตรวจประวัติการซื้อก่อนลองใหม่" };
    }
  });

export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      balance: number;
    }>`select balance from wallet_accounts where user_id = ${context.userId}`;
    return { balance: Number(rows[0]?.balance ?? 0) };
  });

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql<{ id: string; name: string; price: number; status: string; created_at: string }>`
      select o.id, i.product_name as name, o.total as price, o.status, o.created_at::text as created_at
      from orders o join order_items i on i.order_id = o.id
      where o.user_id = ${context.userId} order by o.created_at desc limit 100
    `;
  });

export const archiveProduct = createServerFn({ method: "POST" })
  .validator((v: unknown) => z.object({ id: z.string().trim().min(1).max(160) }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireAdmin(bearerOf(context));
    const connection = await getSql();
    return connection.transaction(async (sql) => {
      const rows = await sql<ProductRow>`
      update products
      set active = false, updated_at = now()
      where id = ${data.id}
      returning id, name, subtitle, category_id, price, compare_at, stock, stock_mode, image, delivery, warranty_days, card_color, border_color, accent_color, badge_color, description, icon, badge, sort_order, featured, flash, active
    `;
      if (!rows[0]) return { ok: false as const, message: "ไม่พบสินค้า" };
      await audit(sql, String(context.userId), "product.archived", "product", data.id);
      return {
        ok: true as const,
        product: mapProduct(rows[0]),
        message: "ซ่อนสินค้าแล้ว (soft-delete)",
      };
    });
  });

export const getShopSettings = createServerFn({ method: "GET" }).handler(async () => {
  return readSettings();
});

export const saveShopSettings = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({
        slip_provider: z.string().max(30).optional(),
        wallet_fee: z.number().int().min(0).max(100).optional(),
        receive_account: z
          .string()
          .regex(/^[0-9-]{10,17}$/)
          .optional(),
        receive_name: z.string().trim().min(1).max(200).optional(),
        wallet_phone: z
          .string()
          .regex(/^0[0-9]{9}$/)
          .optional(),
      })
      .parse(v),
  )

  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireAdmin(bearerOf(context), "system.manage");
    const sql = await getSql();
    const current = await readSettings();
    const next = { ...current, ...data };
    if (next.receive_account.replace(/\D/g, "") !== VERIFIER_PROMPTPAY) {
      return {
        ok: false as const,
        message: `ปลายทาง PromptPay ต้องตรงกับ verifier (${VERIFIER_PROMPTPAY}) ก่อนเปลี่ยนค่าได้`,
      };
    }
    const provider = next.slip_provider === "slip2go" ? "slip2go" : "thunder";
    await sql.transaction(async (sql) => {
      await sql`
      insert into shop_settings (id, slip_provider, wallet_fee, receive_account, receive_name, wallet_phone)
      values (1, ${provider}, ${Math.max(0, Math.round(Number(next.wallet_fee) || 0))},
        ${next.receive_account.trim()}, ${next.receive_name.trim()}, ${next.wallet_phone.trim()})
      on conflict (id) do update set
        slip_provider = excluded.slip_provider,
        wallet_fee = excluded.wallet_fee,
        receive_account = excluded.receive_account,
        receive_name = excluded.receive_name,
        wallet_phone = excluded.wallet_phone
    `;
      await audit(sql, String(context.userId), "payment-settings.saved", "settings", "1", {
        receiver: next.receive_account,
        fee: next.wallet_fee,
      });
    });
    return { ok: true as const, settings: await readSettings() };
  });

export const processPayment = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({
        method: z.enum(["promptpay", "truewallet", "slip"]),
        amount: z.number().int().min(1).max(100000000),
        slipHash: z.string().max(128).optional(),
        fileName: z.string().max(240).optional(),
        ocrText: z.string().max(50000).optional(),
        orderId: z.string().max(200).optional(),
        slipImage: z.string().max(8000000).optional(),
        slipMime: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
      })
      .parse(value),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    if (LIST_ONLY_STORE) return { ok: false as const, message: listOnlyMessage };
    const config = await configuration(await getSql());
    if (data.method === "truewallet" ? !config.trueMoney : !config.slip2go)
      return { ok: false as const, message: "ช่องทางนี้ปิดชั่วคราว" };
    if (config.maintenance) return { ok: false as const, message: "ร้านกำลังปรับปรุง" };
    await limit(await getSql(), `topup:${context.userId}`, 5);
    const amount = Number(data.amount);
    if (amount < config.minimumTopup || amount > config.maximumTopup)
      return {
        ok: false as const,
        message: `ยอดเติมเงินต้องอยู่ระหว่าง ${config.minimumTopup}–${config.maximumTopup} บาท`,
      };
    if (!Number.isSafeInteger(amount) || amount > 100000000)
      return { ok: false as const, message: "ยอดเงินไม่ถูกต้อง" };

    const settings = await readSettings();
    const sql = await getSql();
    const id = uid("pay");
    const userId = String(context.userId || "");
    const fee =
      data.method === "truewallet" ? Math.ceil(amount * (Number(settings.wallet_fee) / 100)) : 0;

    // PromptPay / TrueWallet: destination only — never auto-credit.
    if (data.method === "promptpay" || data.method === "truewallet") {
      await sql`
        insert into payments (id, method, amount, fee, credit, status, provider, reject_reason, user_id)
        values (
          ${id}, ${data.method}, ${amount}, ${fee}, 0, 'pending', 'slip2go',
          ${"รออัปโหลดสลิป"}, ${userId || null}
        )
      `;
      return {
        ok: false as const,
        pending: true as const,
        paymentId: id,
        message:
          data.method === "promptpay"
            ? `โอนพร้อมเพย์ไป ${settings.receive_account} แล้วอัปโหลดสลิป — ตรวจที่บริการกลางก่อนเติมเครดิต`
            : `โอน True Wallet ไป ${settings.wallet_phone} แล้วอัปโหลดสลิปเพื่อตรวจ — ยังไม่เติมเครดิต`,
        note: `ปลายทาง ${settings.receive_account} · shared slip API`,
      };
    }

    // method === "slip": never trust client flags — require image bytes and verify on :8787.
    return creditSlipAfterUpstreamVerify({
      amount,
      fee,
      paymentId: id,
      userId,
      slipImage: data.slipImage,
      slipMime: data.slipMime,
      fileName: data.fileName,
      orderId: data.orderId,
      clientSlipHash: data.slipHash,
    });
  });

/**
 * Preferred top-up path: upload slip → server verifies on :8787 → credit only if ok.
 * Client verification claims are not accepted.
 */
export const topupWithSlip = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({
        amount: z.number().int().min(1).max(100000000),
        method: z.enum(["promptpay", "truewallet"]).optional(),
        slipDataUrl: z.string().max(8000000).optional(),
        slipBase64: z.string().max(8000000).optional(),
        fileName: z.string().max(240).optional(),
        slipMime: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
        orderId: z.string().max(200).optional(),
      })
      .parse(value),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    if (LIST_ONLY_STORE) return { ok: false as const, message: listOnlyMessage };
    const config = await configuration(await getSql());
    if (data.method === "truewallet" ? !config.trueMoney : !config.slip2go)
      return { ok: false as const, message: "ช่องทางนี้ปิดชั่วคราว" };
    if (config.maintenance) return { ok: false as const, message: "ร้านกำลังปรับปรุง" };
    await limit(await getSql(), `topup:${context.userId}`, 5);
    const amount = Number(data.amount);
    if (amount < config.minimumTopup || amount > config.maximumTopup)
      return {
        ok: false as const,
        message: `ยอดเติมเงินต้องอยู่ระหว่าง ${config.minimumTopup}–${config.maximumTopup} บาท`,
      };
    if (!Number.isSafeInteger(amount) || amount > 100000000)
      return { ok: false as const, message: "ยอดเงินไม่ถูกต้อง" };
    const slipImage = (data.slipDataUrl || data.slipBase64 || "").trim();
    if (!slipImage) {
      return { ok: false as const, message: "ต้องอัปโหลดไฟล์สลิป" };
    }
    const method = data.method === "truewallet" ? "truewallet" : "promptpay";
    const userId = String(context.userId || "");
    if (method === "truewallet") {
      const parsed = slipImageToBlob(slipImage, data.slipMime);
      if (!parsed) return { ok: false as const, message: "ไฟล์สลิปไม่ถูกต้องหรือมีขนาดเกินกำหนด" };
      const { createHash } = await import("node:crypto");
      const bytes = Buffer.from(await parsed.blob.arrayBuffer());
      const hash = createHash("sha256").update(bytes).digest("hex");
      const sql = await getSql();
      const duplicate = await sql<{ id: string }>`
        select id from payments where slip_hash = ${hash} and status = 'success'
      `;
      if (duplicate[0]) return { ok: false as const, message: "สลิปนี้เคยใช้แล้ว" };
      const id = uid("pay");
      const settings = await readSettings();
      const fee = Math.ceil(amount * (Number(settings.wallet_fee) / 100));
      await sql`
        insert into payments (id, method, amount, fee, credit, status, provider, slip_hash, reject_reason, user_id, slip_evidence)
        values (
          ${id}, 'truewallet', ${amount}, ${fee}, 0, 'pending', 'manual-review', ${hash},
          'รอแอดมินตรวจสลิป True Wallet · ยังไม่มีตัวตรวจอัตโนมัติ', ${userId || null}, ${slipImage}
        )
      `;
      return {
        ok: false as const,
        pending: true as const,
        paymentId: id,
        message: "รับสลิป True Wallet แล้ว · รอแอดมินตรวจ ไม่มีการเติมเครดิตอัตโนมัติ",
      };
    }
    const id = uid("pay");
    return creditSlipAfterUpstreamVerify({
      amount,
      fee: 0,
      paymentId: id,
      userId,
      slipImage,
      slipMime: data.slipMime,
      fileName: data.fileName,
      orderId: data.orderId,
    });
  });

async function creditSlipAfterUpstreamVerify(input: {
  amount: number;
  fee: number;
  paymentId: string;
  userId: string;
  slipImage?: string;
  slipMime?: string;
  fileName?: string;
  orderId?: string;
  clientSlipHash?: string;
}) {
  const sql = await getSql();
  const { amount, userId } = input;
  const paymentConfiguration = await configuration(sql);
  const fee = Math.ceil((amount * paymentConfiguration.slipFeeBps) / 10000);
  let id = input.paymentId;

  const parsed = slipImageToBlob(input.slipImage || "", input.slipMime);
  if (!parsed) {
    return {
      ok: false as const,
      message: "ต้องส่งไฟล์สลิปให้เซิร์ฟเวอร์ตรวจ — ไม่รับเครดิตจากฝั่งลูกค้า",
    };
  }

  const { createHash } = await import("node:crypto");
  const bytes = Buffer.from(await parsed.blob.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  // Ignore client slipHash for credit decisions (kept only for logging if needed).
  void input.clientSlipHash;

  const [existing] = await sql.query<{
    id: string;
    status: string;
    user_id: string;
    amount: number;
  }>("SELECT id,status,user_id,amount FROM payments WHERE slip_hash=$1", [hash]);
  if (existing) {
    if (existing.status === "success" || existing.user_id !== userId || existing.amount !== amount)
      return { ok: false as const, message: "สลิปนี้เคยใช้แล้วหรือไม่ตรงกับรายการเดิม" };
    if (existing.status === "reconciliation_required")
      return {
        ok: false as const,
        pending: true as const,
        paymentId: existing.id,
        message: "ระบบกำลังเติมเครดิตตามผลตรวจเดิม",
      };
    if (existing.status !== "pending") return { ok: false as const, message: "สลิปนี้ตรวจสอบแล้ว" };
    id = existing.id;
  }

  let verify;
  try {
    const settings = await readSettings();
    const official = await paymentProviders.promptpay.verify({
      file: new Blob([new Uint8Array(bytes)], { type: parsed.blob.type || "image/png" }),
      fileName: parsed.fileName,
      amount,
      receiver: settings.receive_account,
    });
    verify = {
      ok: official.ok,
      amountFound: official.amount,
      promptpayMatched: official.ok,
      reason: official.reason,
      orderId: null,
      reference: official.reference,
    };
  } catch {
    await sql`
      insert into payments (id, method, amount, fee, credit, status, provider, slip_hash, reject_reason, user_id, slip_evidence)
      values (
        ${id}, 'slip', ${amount}, ${fee}, 0, 'pending', 'slip2go', ${hash},
        ${"ตรวจสลิปไม่สำเร็จ กรุณาติดต่อทีมงาน"},
        ${userId || null}, ${input.slipImage || null}
      ) on conflict(id) do update set reject_reason=excluded.reject_reason where payments.status='pending'
    `;
    return {
      ok: false as const,
      pending: true as const,
      message: "ยังไม่เติมเครดิต — บริการตรวจสลิปไม่พร้อมใช้งาน",
      note: `ปลายทาง ${VERIFIER_PROMPTPAY}`,
      paymentId: id,
    };
  }

  const amountMatched = verify.amountFound != null && verify.amountFound === amount;
  if (!verify.ok || !verify.promptpayMatched || !amountMatched) {
    const reason = !verify.ok
      ? verify.reason
      : !verify.promptpayMatched
        ? "บัญชีปลายทางในสลิปไม่ตรงกับ PromptPay ที่กำหนด"
        : !amountMatched
          ? "ยอดเงินในสลิปไม่ตรงกับยอดที่เลือก"
          : verify.reason || "ตรวจสลิปไม่ผ่าน";
    await sql`
      insert into payments (id, method, amount, fee, credit, status, provider, slip_hash, reject_reason, user_id, slip_evidence)
      values (
        ${id}, 'slip', ${amount}, ${fee}, 0, 'pending', 'slip2go', ${hash},
        ${reason},
        ${userId || null}, ${input.slipImage || null}
      ) on conflict(id) do update set reject_reason=excluded.reject_reason where payments.status='pending'
    `;
    return {
      ok: false as const,
      pending: true as const,
      message: `ยังไม่เติมเครดิต — ${reason}`,
      note: `ปลายทาง ${VERIFIER_PROMPTPAY}`,
      paymentId: id,
    };
  }

  // Credit from upstream match only — never from client verifiedAmount.
  const netFee = fee;
  const credit = Math.round(verify.amountFound || 0) - netFee;
  if (credit <= 0) return { ok: false as const, message: "ยอดจากสลิปไม่ถูกต้อง" };

  // Save the official verified result before credit so transient DB failures can reconcile safely.
  await sql.transaction(async (tx) => {
    await tx.query(
      "INSERT INTO payments(id,method,amount,fee,credit,status,provider,slip_hash,user_id,slip_evidence) VALUES($1,'slip',$2,$3,0,'reconciliation_required','slip2go',$4,$5,$6) ON CONFLICT(id) DO UPDATE SET status='reconciliation_required',fee=excluded.fee WHERE payments.status='pending'",
      [id, amount, netFee, hash, userId, input.slipImage ?? null],
    );
    await tx.query(
      "INSERT INTO payment_verifications(payment_id,user_id,amount,fee,credit,hash,reference) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [id, userId, amount, netFee, credit, hash, verify.reference],
    );
    const { enqueue } = await import("./jobs-service.server");
    await enqueue(tx, "payment_reconcile", { paymentId: id });
  });
  let balance: number;
  try {
    balance = await creditVerifiedSlip(sql, {
      id,
      userId,
      amount,
      fee: netFee,
      credit,
      hash,
      provider: "slip2go",
      reference: verify.reference!,
    });
  } catch (error) {
    if (error instanceof CommerceError) return { ok: false as const, message: error.message };
    return {
      ok: false as const,
      pending: true as const,
      paymentId: id,
      message: "รับผลตรวจแล้ว ระบบจะดำเนินการเติมเครดิตซ้ำอย่างปลอดภัย",
    };
  }

  return {
    ok: true as const,
    credit,
    balance,
    fee: netFee,
    paymentId: id,
    message: `เติม ฿${credit} สำเร็จ (ตรวจสลิปผ่าน Slip2Go)`,
    note: `Slip2Go · พร้อมเพย์ ${VERIFIER_PROMPTPAY}`,
    orderId: verify.orderId,
  };
}

export const listPayments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(bearerOf(context), "topups.manage");
    const sql = await getSql();
    return sql<PaymentRow>`
      select id, method, amount, fee, credit, status, provider, slip_hash, reject_reason,
        (slip_evidence is not null) as has_slip, created_at::text as created_at
      from payments
      order by created_at desc
      limit 40
    `;
  });

export const getPaymentSlipEvidence = createServerFn({ method: "GET" })
  .validator((v: unknown) => z.object({ id: z.string().trim().min(1).max(160) }).parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireAdmin(bearerOf(context), "topups.manage");
    const sql = await getSql();
    const rows = await sql<{ slip_evidence: string | null }>`
      select slip_evidence from payments where id = ${data.id} and status IN ('pending','reconciliation_required')
    `;
    if (!rows[0]?.slip_evidence) return { ok: false as const, message: "ไม่พบสลิปที่รอตรวจ" };
    await audit(sql, String(context.userId), "payment.evidence-viewed", "payment", data.id);
    return { ok: true as const, dataUrl: rows[0].slip_evidence };
  });

/** Signed-in user's own top-up / payment rows. */
export const listMyPayments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const userId = String(context.userId || "");
    return sql<PaymentRow>`
      select id, method, amount, fee, credit, status, provider, slip_hash, reject_reason, created_at::text as created_at
      from payments
      where user_id = ${userId}
      order by created_at desc
      limit 80
    `;
  });

/**
 * Admin-only image upload through the shared validation and durable media service.
 */
export const uploadProductImage = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z
      .object({ dataUrl: z.string().max(7500000), fileName: z.string().max(240).optional() })
      .parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireAdmin(bearerOf(context), "media.manage");
    const { storeMedia } = await import("./media-service.server");
    const result = await storeMedia(
      await getSql(),
      String(context.userId),
      "product",
      data.dataUrl,
      data.fileName ?? "",
    );
    return { ok: true as const, ...result, message: "อัปโหลดรูปแล้ว" };
  });
