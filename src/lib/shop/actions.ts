import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireAdmin } from "@/lib/shop/require-admin.server";
import { getSql } from "@/lib/db";
import { categories as seedCats, type Product } from "@/lib/shop/catalog";
import { uid } from "@/lib/utils";
import { productImageStorage } from "./storage";
import { categoryInputSchema, productInputSchema } from "./validation";
import {
  slipImageToBlob,
  verifySlipWithSharedApi,
  VERIFIER_PROMPTPAY,
} from "@/lib/shop/slip-verify-upstream.server";

function bearerOf(context: { bearerToken?: string }): string | undefined {
  return context.bearerToken;
}

export type CategoryRow = {
  id: string;
  label: string;
  hint: string;
  sort_order: number;
  visible: boolean;
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
  /** Legacy UI field only — not used for live credit. Shared :8787 is the verifier. */
  slip_provider: "thunder" | "slip2go";
  wallet_fee: number;
  /**
   * Display / QR destination. Must stay aligned with hardcoded verifier
   * PromptPay 0928160016 (veltshop-discord-topup). Do NOT reintroduce
   * Slip2Go/Thunder as live credit providers.
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
  image: string;
  delivery: string;
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
    image: row.image,
    delivery: row.delivery as Product["delivery"],
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
      receive_account: "0928160016",
      receive_name: "VELTSHOP",
      wallet_phone: "0928160016",
    }
  );
}

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSeed();
  const sql = await getSql();
  return sql<CategoryRow>`
    select id, label, hint, sort_order, visible
    from categories
    where visible = true
    order by sort_order, label
  `;
});

/** Admin: all categories including hidden. */
export const listAllCategories = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(bearerOf(context));
    await ensureSeed();
    const sql = await getSql();
    return sql<CategoryRow>`
      select id, label, hint, sort_order, visible
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
};

/** Admin: rename / reorder / show-hide a category chip. Id is fixed (used by products). */
export const saveCategory = createServerFn({ method: "POST" })
  .validator((d: CategoryInput) => categoryInputSchema.parse(d))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireAdmin(bearerOf(context));
    const id = String(data.id || "").trim();
    const label = String(data.label || "").trim();
    const hint = String(data.hint || "").trim();
    if (!id) return { ok: false as const, message: "ไม่พบหมวด" };
    if (!label) return { ok: false as const, message: "ใส่ชื่อหมวดก่อน" };
    const sql = await getSql();
    const exists = await sql<{ id: string }>`select id from categories where id = ${id}`;
    if (!exists[0]) {
      await sql`
        insert into categories (id, label, hint, sort_order, visible)
        values (${id}, ${label}, ${hint || label}, ${Math.max(0, Math.round(Number(data.sort_order) || 0))}, ${Boolean(data.visible)})
      `;
      return { ok: true as const, message: "สร้างหมวดสินค้าแล้ว" };
    }
    await sql`
      update categories
      set label = ${label},
          hint = ${hint || label},
          sort_order = ${Math.max(0, Math.round(Number(data.sort_order) || 0))},
          visible = ${Boolean(data.visible)}
      where id = ${id}
    `;
    return { ok: true as const, message: "บันทึกหมวดแล้ว" };
  });

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSeed();
  const sql = await getSql();
  const rows = await sql<ProductRow>`
    select id, name, subtitle, category_id, price, compare_at, stock, image, delivery, featured, flash, active
    from products
    where active = true
    order by featured desc, name
  `;
  return rows.map(mapProduct);
});

export const listAllProducts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(bearerOf(context));
    await ensureSeed();
    const sql = await getSql();
    const rows = await sql<ProductRow>`
      select id, name, subtitle, category_id, price, compare_at, stock, image, delivery, featured, flash, active
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
    const id = data.id?.trim() || `p_${Date.now().toString(36)}`;
    const sql = await getSql();
    const cats = await sql<{ id: string }>`select id from categories where id = ${data.category}`;
    if (!cats[0]) return { ok: false as const, message: "หมวดสินค้าไม่ถูกต้อง" };
    await sql`
      insert into products (
        id, name, subtitle, category_id, price, compare_at, stock, image, delivery, featured, flash, active, updated_at
      ) values (
        ${id}, ${name}, ${data.subtitle.trim()}, ${data.category}, ${price},
        ${data.compareAt ? Math.round(Number(data.compareAt)) : null},
        ${stock}, ${data.image || "/images/cat-stream.jpg"}, ${data.delivery},
        ${Boolean(data.featured)}, ${Boolean(data.flash)}, ${data.active !== false}, now()
      )
      on conflict (id) do update set
        name = excluded.name,
        subtitle = excluded.subtitle,
        category_id = excluded.category_id,
        price = excluded.price,
        compare_at = excluded.compare_at,
        stock = excluded.stock,
        image = excluded.image,
        delivery = excluded.delivery,
        featured = excluded.featured,
        flash = excluded.flash,
        active = excluded.active,
        updated_at = now()
    `;
    const rows = await sql<ProductRow>`
      select id, name, subtitle, category_id, price, compare_at, stock, image, delivery, featured, flash, active
      from products where id = ${id}
    `;
    return { ok: true as const, product: mapProduct(rows[0]), message: "บันทึกสินค้าแล้ว" };
  });

export const checkoutProduct = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const actorId = String(context.userId || "");
    const rows = await sql<ProductRow>`
      with decremented as (
        update products
        set stock = stock - 1, updated_at = now()
        where id = ${data.id} and stock > 0 and active = true
        returning id, name, subtitle, category_id, price, compare_at, stock, image, delivery, featured, flash, active
      ), movement as (
        insert into inventory_movements (id, product_id, quantity, reason, actor_id, created_at)
        select ${uid("inv")}, id, -1, 'purchase', ${actorId}, now()
        from decremented
        returning product_id
      )
      select decremented.*
      from decremented
      inner join movement on movement.product_id = decremented.id
    `;
    if (!rows[0]) return { ok: false as const, message: "สินค้าหมดหรือปิดขายแล้ว" };
    return { ok: true as const, product: mapProduct(rows[0]) };
  });

export const archiveProduct = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireAdmin(bearerOf(context));
    const sql = await getSql();
    const rows = await sql<ProductRow>`
      update products
      set active = false, updated_at = now()
      where id = ${data.id}
      returning id, name, subtitle, category_id, price, compare_at, stock, image, delivery, featured, flash, active
    `;
    if (!rows[0]) return { ok: false as const, message: "ไม่พบสินค้า" };
    return { ok: true as const, product: mapProduct(rows[0]), message: "ซ่อนสินค้าแล้ว (soft-delete)" };
  });

export const getShopSettings = createServerFn({ method: "GET" }).handler(async () => {
  return readSettings();
});

export const saveShopSettings = createServerFn({ method: "POST" })
  .validator((d: Partial<ShopSettings>) => d)
  
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireAdmin(bearerOf(context));
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
    return { ok: true as const, settings: await readSettings() };
  });

export const processPayment = createServerFn({ method: "POST" })
  .validator((d: {
    method: "promptpay" | "truewallet" | "slip";
    amount: number;
    slipHash?: string;
    fileName?: string;
    ocrText?: string;
    orderId?: string;
    /** Required for method=slip if not using topupWithSlip: slip image data-URL or base64. */
    slipImage?: string;
    slipMime?: string;
  }) => d)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const amount = Math.round(Number(data.amount) || 0);
    if (amount < 20) return { ok: false as const, message: "ยอดขั้นต่ำ ฿20" };

    const settings = await readSettings();
    const sql = await getSql();
    const id = uid("pay");
    const userId = String(context.userId || "");
    const fee = data.method === "truewallet" ? Math.ceil(amount * (Number(settings.wallet_fee) / 100)) : 0;

    // PromptPay / TrueWallet: destination only — never auto-credit.
    if (data.method === "promptpay" || data.method === "truewallet") {
      await sql`
        insert into payments (id, method, amount, fee, credit, status, provider, reject_reason, user_id)
        values (
          ${id}, ${data.method}, ${amount}, ${fee}, 0, 'pending', 'slip-api-8787',
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
 * Client slipVerified / verifiedAmount are not accepted.
 */
export const topupWithSlip = createServerFn({ method: "POST" })
  .validator((d: {
    amount: number;
    method?: "promptpay" | "truewallet";
    /** data:image/...;base64,... preferred */
    slipDataUrl?: string;
    /** raw base64 if slipDataUrl omitted */
    slipBase64?: string;
    fileName?: string;
    slipMime?: string;
    orderId?: string;
  }) => d)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const amount = Math.round(Number(data.amount) || 0);
    if (amount < 20) return { ok: false as const, message: "ยอดขั้นต่ำ ฿20" };
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
  const { amount, fee, paymentId: id, userId } = input;

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

  const dup = await sql<{ id: string }>`
    select id from payments where slip_hash = ${hash} and status = 'success'
  `;
  if (dup[0]) {
    try {
      await sql`
        insert into payments (id, method, amount, fee, credit, status, provider, slip_hash, reject_reason, user_id)
        values (${id}, 'slip', ${amount}, 0, 0, 'rejected', 'slip-api-8787', ${hash}, 'สลิปซ้ำ', ${userId || null})
      `;
    } catch {
      /* ignore older unique index races */
    }
    return { ok: false as const, message: "สลิปนี้เคยใช้แล้ว · กันซ้ำชั้นที่ 1" };
  }

  let verify;
  try {
    verify = await verifySlipWithSharedApi({
      file: new Blob([new Uint8Array(bytes)], { type: parsed.blob.type || "image/png" }),
      fileName: input.fileName || parsed.fileName,
      amount,
      orderId: input.orderId,
    });
  } catch (err) {
    await sql`
      insert into payments (id, method, amount, fee, credit, status, provider, slip_hash, reject_reason, user_id)
      values (
        ${id}, 'slip', ${amount}, 0, 0, 'pending', 'slip-api-8787', ${hash},
        ${`ตรวจสลิปไม่สำเร็จ: ${err instanceof Error ? err.message : "upstream error"}`},
        ${userId || null}
      )
    `;
    return {
      ok: false as const,
      pending: true as const,
      message: "ยังไม่เติมเครดิต — เรียกบริการกลางไม่สำเร็จ",
      note: `ปลายทาง ${VERIFIER_PROMPTPAY}`,
      paymentId: id,
    };
  }

  const amountMatched = verify.amountFound != null && Math.round(verify.amountFound) === amount;
  if (!verify.ok || !verify.promptpayMatched || !amountMatched) {
    const reason = !verify.promptpayMatched
      ? "บัญชีปลายทางในสลิปไม่ตรงกับ PromptPay ที่กำหนด"
      : !amountMatched
        ? "ยอดเงินในสลิปไม่ตรงกับยอดที่เลือก"
        : verify.reason || "ตรวจสลิปไม่ผ่าน";
    await sql`
      insert into payments (id, method, amount, fee, credit, status, provider, slip_hash, reject_reason, user_id)
      values (
        ${id}, 'slip', ${amount}, 0, 0, 'pending', 'slip-api-8787', ${hash},
        ${reason},
        ${userId || null}
      )
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
  const credit = Math.round(verify.amountFound || 0);
  if (credit < 20) return { ok: false as const, message: "ยอดจากสลิปไม่ถูกต้อง" };

  try {
    await sql`
      insert into payments (id, method, amount, fee, credit, status, provider, slip_hash, user_id)
      values (${id}, 'slip', ${amount}, ${fee}, ${credit}, 'success', 'slip-api-8787', ${hash}, ${userId || null})
    `;
  } catch {
    return { ok: false as const, message: "สลิปนี้เคยใช้แล้ว · กันซ้ำชั้นที่ 1" };
  }

  return {
    ok: true as const,
    credit,
    fee,
    paymentId: id,
    message: `เติม ฿${credit} สำเร็จ (ตรวจสลิปผ่านบริการกลาง)`,
    note: `slip-api-8787 · พร้อมเพย์ ${VERIFIER_PROMPTPAY}`,
    orderId: verify.orderId,
  };
}

export const listPayments = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdmin(bearerOf(context));
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
  .validator((d: { id: string }) => d)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireAdmin(bearerOf(context));
    const sql = await getSql();
    const rows = await sql<{ slip_evidence: string | null }>`
      select slip_evidence from payments where id = ${data.id} and status = 'pending'
    `;
    if (!rows[0]?.slip_evidence) return { ok: false as const, message: "ไม่พบสลิปที่รอตรวจ" };
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
 * Admin-only: accept a product image and return a URL the catalog can store.
 * On Vercel/serverless the filesystem under /var/task is read-only, so we keep
 * the validated data URL (persisted on the product row) instead of writing
 * public/uploads — that path caused ENOENT mkdir '/var/task/public'.
 * Locally we still try a public/ file for nicer static URLs, then fall back.
 */
export const uploadProductImage = createServerFn({ method: "POST" })
  .validator((d: { dataUrl: string; fileName?: string }) => d)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requireAdmin(bearerOf(context));
    const raw = (data.dataUrl || "").trim();
    const m = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i.exec(raw);
    if (!m) return { ok: false as const, message: "รองรับเฉพาะรูป PNG / JPEG / WebP / GIF" };
    const ext = m[2].toLowerCase() === "jpeg" ? "jpg" : m[2].toLowerCase();
    if (m[3].length > Math.ceil((2.5 * 1024 * 1024) / 3) * 4) {
      return { ok: false as const, message: "ไฟล์ใหญ่เกิน 2.5MB" };
    }
    const buf = Buffer.from(m[3], "base64");
    if (buf.byteLength > 2.5 * 1024 * 1024) {
      return { ok: false as const, message: "ไฟล์ใหญ่เกิน 2.5MB" };
    }
    const isPng = ext === "png" && buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = ext === "jpg" && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isGif = ext === "gif" && ["GIF87a", "GIF89a"].includes(buf.toString("ascii", 0, 6));
    const isWebp = ext === "webp" && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
    if (!isPng && !isJpeg && !isGif && !isWebp) {
      return { ok: false as const, message: "ชนิดไฟล์ไม่ตรงกับข้อมูลรูปภาพ" };
    }

    const result = await productImageStorage.putProductImage({
      bytes: buf,
      extension: ext,
      fileName: data.fileName,
      dataUrl: raw,
    });
    return { ok: true as const, ...result };
  });

