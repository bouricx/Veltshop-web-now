import { createHash } from "node:crypto";
import type { Sql } from "../db";
import { CommerceError } from "./commerce.server.ts";
import { encryptInventory, decryptInventory } from "./inventory-crypto.server.ts";
import { audit, notify, limit } from "./operations-service.server.ts";
import { defaultAppUsageGuide } from "./app-usage-guide.ts";
import type { DeliveryChannel, DeliveryLine } from "./cart-delivery-service.server.ts";
import type { RequestItem } from "./cart-request-service.server.ts";
import {
  orderMessageInput,
  deliveryEditInput,
  type ConversationCursor,
  type DeliveryEditInput,
} from "./order-support-policy.ts";

// The existing durable operation ledger already participates in backups and
// idempotency. Keep support records append-only; never put secrets in audit or
// notification bodies. The admin flag is supplied only by permission-checked RPCs.
export type SupportAccess = { actorId: string; admin: boolean };
type RequestRow = {
  user_id: string;
  items: RequestItem[];
  delivery_ciphertext: string | null;
  delivery_channel: DeliveryChannel | null;
  delivered_at: string;
};
type RecordRow = {
  user_id: string;
  key: string;
  created_at: string;
  name: string;
  result: {
    requestId: string;
    ciphertext?: string;
    role?: "admin" | "customer";
    version?: string;
  };
};
export function supportBinding(id: string, actor: string, key: string) {
  return `cart-support:${id}:${actor}:${key}`;
}
export function deliveryVersion(ciphertext: string | null, channel: string | null) {
  return createHash("sha256")
    .update(JSON.stringify([ciphertext, channel]))
    .digest("hex");
}
async function authorizedRequest(sql: Sql, access: SupportAccess, id: string, lock = false) {
  const [row] = await sql.query<RequestRow>(
    `SELECT r.user_id,r.items,r.delivery_ciphertext,r.delivery_channel,r.delivered_at::text
     FROM cart_requests r JOIN cart_request_payments p ON p.cart_request_id=r.id
     LEFT JOIN member_profiles m ON m.user_id=r.user_id
     WHERE r.id=$1 AND ($2::boolean OR r.user_id=$3) AND r.status='done' AND p.status='paid'
       AND COALESCE(m.disabled,false)=false ${lock ? "FOR UPDATE OF r,p" : ""}`,
    [id, access.admin, access.actorId],
  );
  if (!row) throw new CommerceError("ไม่พบรายการที่จัดส่งแล้ว หรือไม่มีสิทธิ์เข้าถึงรายการนี้");
  return row;
}
function linesFor(row: RequestRow, id: string): DeliveryLine[] {
  return row.delivery_ciphertext
    ? JSON.parse(decryptInventory(`cart-delivery:${id}`, row.delivery_ciphertext))
    : row.items.map((item) => ({
        ...item,
        payload: "",
        instructions: defaultAppUsageGuide(item.name),
      }));
}
async function editableLines(sql: Sql, row: RequestRow, id: string) {
  const lines = linesFor(row, id);
  const refunds = await sql.query<{ key: string }>(
    "SELECT key FROM operation_keys WHERE user_id=$1 AND kind='cart_refund' AND key=ANY($2::text[])",
    [row.user_id, lines.map((line) => `cart-refund:${id}:${line.productId}`)],
  );
  const revoked = new Set(refunds.map((row) => row.key));
  return lines.filter((line) => !revoked.has(`cart-refund:${id}:${line.productId}`));
}
async function replay(
  sql: Sql,
  actor: string,
  key: string,
  kind: string,
  matches: (result: RecordRow["result"]) => boolean,
) {
  const [row] = await sql.query<{ kind: string; result: RecordRow["result"] }>(
    "SELECT kind,result FROM operation_keys WHERE user_id=$1 AND key=$2",
    [actor, key],
  );
  if (row && (row.kind !== kind || !matches(row.result)))
    throw new CommerceError("รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว กรุณาโหลดรายการใหม่");
  return row?.result;
}
export async function listOrderMessages(
  sql: Sql,
  access: SupportAccess,
  id: string,
  before?: ConversationCursor,
) {
  return sql.transaction(async (tx) => {
    await authorizedRequest(tx, access, id, true);
    const rows = await tx.query<RecordRow>(
      `SELECT o.user_id,o.key,o.result,o.created_at::text,COALESCE(u.name,'สมาชิก') AS name
       FROM operation_keys o LEFT JOIN "user" u ON u.id=o.user_id
       WHERE o.kind='cart_message' AND o.result->>'requestId'=$1
         AND ($2::timestamptz IS NULL OR (o.created_at,o.user_id,o.key)<($2::timestamptz,$3::text,$4::text))
       ORDER BY o.created_at DESC,o.user_id DESC,o.key DESC LIMIT 51`,
      [id, before?.at ?? null, before?.userId ?? "", before?.key ?? ""],
    );
    const selected = rows.slice(0, 50),
      oldest = selected.at(-1);
    return {
      messages: selected.reverse().map((row) => ({
        id: `${row.user_id}:${row.key}`,
        at: row.created_at,
        role: row.result.role === "admin" ? ("admin" as const) : ("customer" as const),
        name: row.result.role === "admin" ? "ทีมงาน" : row.name,
        mine: row.user_id === access.actorId,
        body: row.result.ciphertext
          ? decryptInventory(supportBinding(id, row.user_id, row.key), row.result.ciphertext)
          : "ข้อความถูกลบตามคำขอปิดบัญชี",
      })),
      before:
        rows.length > 50 && oldest
          ? { at: oldest.created_at, userId: oldest.user_id, key: oldest.key }
          : null,
    };
  });
}
export async function sendOrderMessage(
  sql: Sql,
  access: SupportAccess,
  input: { id: string; key: string; body: string },
) {
  const data = orderMessageInput.parse(input);
  const role = access.admin ? "admin" : "customer";
  return sql.transaction(async (tx) => {
    const request = await authorizedRequest(tx, access, data.id, true);
    if (
      await replay(tx, access.actorId, data.key, "cart_message", (saved) =>
        Boolean(
          saved.requestId === data.id &&
          saved.role === role &&
          saved.ciphertext &&
          decryptInventory(supportBinding(data.id, access.actorId, data.key), saved.ciphertext) ===
            data.body,
        ),
      )
    )
      return { ok: true as const, message: "ส่งข้อความแล้ว" };
    await limit(tx, `order-chat:${access.actorId}`, 10, 60);
    await tx.query(
      "INSERT INTO operation_keys(user_id,key,kind,result) VALUES($1,$2,'cart_message',$3)",
      [
        access.actorId,
        data.key,
        JSON.stringify({
          requestId: data.id,
          role,
          ciphertext: encryptInventory(supportBinding(data.id, access.actorId, data.key), data.body)
            .ciphertext,
        }),
      ],
    );
    await audit(tx, access.actorId, "cart.message_sent", "cart_request", data.id, { role });
    if (access.admin)
      await notify(
        tx,
        request.user_id,
        "ทีมงานส่งข้อความเกี่ยวกับออเดอร์",
        `เลขรายการ ${data.id} · เปิดรายการสั่งซื้อแล้วเลือกคุยกับทีมงาน`,
      );
    else
      await tx.query("INSERT INTO admin_events(kind,entity_id) VALUES('cart.message',$1)", [
        data.id,
      ]);
    return { ok: true as const, message: "ส่งข้อความแล้ว" };
  });
}
export async function readAdminDeliveryEditor(sql: Sql, actor: string, id: string) {
  return sql.transaction(async (tx) => {
    const request = await authorizedRequest(tx, { actorId: actor, admin: true }, id, true);
    const rows = await tx.query<RecordRow>(
      `SELECT o.user_id,o.key,o.result,o.created_at::text,COALESCE(u.name,'ทีมงาน') AS name
       FROM operation_keys o LEFT JOIN "user" u ON u.id=o.user_id
       WHERE o.kind='cart_delivery_edit' AND o.result->>'requestId'=$1
       ORDER BY o.created_at DESC,o.user_id DESC,o.key DESC LIMIT 20`,
      [id],
    );
    await audit(tx, actor, "cart.delivery_editor_viewed", "cart_request", id);
    return {
      entries: await editableLines(tx, request, id),
      channel: request.delivery_channel ?? "web",
      version: deliveryVersion(request.delivery_ciphertext, request.delivery_channel),
      history: rows.map((row) => {
        const details = row.result.ciphertext
          ? (JSON.parse(
              decryptInventory(supportBinding(id, row.user_id, row.key), row.result.ciphertext),
            ) as { reason: string })
          : null;
        return {
          id: `${row.user_id}:${row.key}`,
          at: row.created_at,
          name: row.name,
          reason: details?.reason ?? "ข้อมูลถูกลบตามคำขอปิดบัญชี",
        };
      }),
    };
  });
}
export async function editDeliveredOrder(sql: Sql, actor: string, input: DeliveryEditInput) {
  const data = deliveryEditInput.parse(input);
  const canonical = (entries: DeliveryEditInput["entries"]) =>
    JSON.stringify(
      entries
        .map(({ productId, payload, instructions }) => ({ productId, payload, instructions }))
        .sort((a, b) => a.productId.localeCompare(b.productId)),
    );
  return sql.transaction(async (tx) => {
    const request = await authorizedRequest(tx, { actorId: actor, admin: true }, data.id, true);
    const previous = await replay(tx, actor, data.key, "cart_delivery_edit", (saved) => {
      if (saved.requestId !== data.id || !saved.ciphertext) return false;
      const details = JSON.parse(
        decryptInventory(supportBinding(data.id, actor, data.key), saved.ciphertext),
      ) as {
        expectedVersion: string;
        editedProductIds: string[];
        reason: string;
        after: { channel: DeliveryChannel; entries: DeliveryEditInput["entries"] };
      };
      return (
        details.expectedVersion === data.expectedVersion &&
        details.reason === data.reason &&
        details.after.channel === data.channel &&
        canonical(
          details.after.entries.filter((line) => details.editedProductIds.includes(line.productId)),
        ) === canonical(data.entries)
      );
    });
    if (previous)
      return { ok: true as const, version: previous.version!, message: "บันทึกข้อมูลที่แก้ไขแล้ว" };
    if (
      deliveryVersion(request.delivery_ciphertext, request.delivery_channel) !==
      data.expectedVersion
    )
      throw new CommerceError(
        "ข้อมูลสินค้าเปลี่ยนแล้ว กรุณาโหลดฉบับล่าสุดก่อนแก้ไข ยังไม่ได้บันทึกทับ",
      );
    const before = linesFor(request, data.id);
    const editable = await editableLines(tx, request, data.id);
    if (
      data.entries.length !== editable.length ||
      new Set(data.entries.map((e) => e.productId)).size !== editable.length ||
      editable.some((line) => !data.entries.some((e) => e.productId === line.productId))
    )
      throw new CommerceError(
        "แก้ไขได้เฉพาะสินค้าที่ยังอยู่ในข้อมูลส่งมอบ ห้ามเพิ่มสินค้าที่คืนเงินแล้ว",
      );
    const after = before.map((line) => {
      const entry = data.entries.find((e) => e.productId === line.productId)!;
      if (!entry) return line; // Preserve revoked refund lines without reissuing credentials.
      if (data.channel === "web" && !entry.payload)
        throw new CommerceError(`กรอกข้อมูล ${line.name} ให้ครบก่อนบันทึก`);
      if (!entry.instructions) throw new CommerceError(`กรอกวิธีใช้งาน ${line.name} ให้ครบ`);
      if (data.channel !== "web" && entry.payload)
        throw new CommerceError("การส่งผ่านเพจหรือ Discord ให้บันทึกเฉพาะวิธีใช้งานในเว็บ");
      return { ...line, payload: entry.payload, instructions: entry.instructions };
    });
    const encoded = JSON.stringify(after);
    if (encoded.length > 60000)
      throw new CommerceError("ข้อมูลจัดส่งมากเกินไป กรุณาลดรายละเอียดก่อนบันทึก");
    if (JSON.stringify(before) === encoded && request.delivery_channel === data.channel)
      throw new CommerceError("ข้อมูลยังเหมือนเดิม ไม่มีการเปลี่ยนแปลงให้บันทึก");
    await limit(tx, `delivery-edit:${actor}`, 10, 60);
    const ciphertext = encryptInventory(`cart-delivery:${data.id}`, encoded).ciphertext;
    const version = deliveryVersion(ciphertext, data.channel);
    const archive = JSON.stringify({
      expectedVersion: data.expectedVersion,
      editedProductIds: data.entries.map((line) => line.productId),
      reason: data.reason,
      before: { entries: before, channel: request.delivery_channel },
      after: { entries: after, channel: data.channel },
    });
    await tx.query(
      "INSERT INTO operation_keys(user_id,key,kind,result) VALUES($1,$2,'cart_delivery_edit',$3)",
      [
        actor,
        data.key,
        JSON.stringify({
          requestId: data.id,
          version,
          ciphertext: encryptInventory(supportBinding(data.id, actor, data.key), archive)
            .ciphertext,
        }),
      ],
    );
    // A correction changes only the delivery snapshot. Payment, inventory,
    // fulfillment time and warranty remain governed by their existing flows.
    await tx.query(
      "UPDATE cart_requests SET delivery_ciphertext=$2,delivery_channel=$3,updated_at=now() WHERE id=$1",
      [data.id, ciphertext, data.channel],
    );
    await audit(tx, actor, "cart.delivery_edited", "cart_request", data.id, {
      revision: data.key,
      channel: data.channel,
      lines: after.length,
    });
    await notify(
      tx,
      request.user_id,
      "ข้อมูลสินค้าที่จัดส่งได้รับการแก้ไข",
      `เลขรายการ ${data.id} · เปิดดูสินค้าอีกครั้งเพื่อใช้ข้อมูลฉบับล่าสุด`,
    );
    return { ok: true as const, version, message: "บันทึกข้อมูลใหม่และแจ้งลูกค้าแล้ว" };
  });
}
