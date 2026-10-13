import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  sendOrderMessage,
  listOrderMessages,
  readAdminDeliveryEditor,
  editDeliveredOrder,
  supportBinding,
} from "../src/lib/shop/order-support-service.server.ts";
import { encryptInventory, decryptInventory } from "../src/lib/shop/inventory-crypto.server.ts";
import { readCartDelivery } from "../src/lib/shop/cart-delivery-service.server.ts";
import { createCartClaim, reviewCartClaim } from "../src/lib/shop/cart-claims-service.server.ts";
import {
  exportPersonalData,
  requestDeletion,
  reviewDeletion,
} from "../src/lib/shop/privacy-service.server.ts";
import { snapshot, restoreIntoEmpty, backupTables } from "../src/lib/shop/backup-service.server.ts";
import { orderMessageInput, deliveryEditInput } from "../src/lib/shop/order-support-policy.ts";

const previousKey = process.env.INVENTORY_ENCRYPTION_KEY;
process.env.INVENTORY_ENCRYPTION_KEY = "18".repeat(32);
after(() => {
  if (previousKey === undefined) delete process.env.INVENTORY_ENCRYPTION_KEY;
  else process.env.INVENTORY_ENCRYPTION_KEY = previousKey;
});
const admin = { actorId: "admin", admin: true },
  buyer = { actorId: "buyer", admin: false },
  other = { actorId: "other", admin: false };
async function setup(seed = true) {
  const db = new PGlite();
  for (const file of (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((f) => /^\d.*\.sql$/.test(f))
    .sort())
    await db.exec(await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"));
  const wrap = (client) => ({
    query: async (text, params = []) => (await client.query(text, params)).rows,
    transaction: (work) => db.transaction((tx) => work(wrap(tx))),
  });
  const sql = wrap(db);
  const id = randomUUID(),
    otherId = randomUUID();
  const items = [
    {
      productId: "first",
      name: "First product",
      category: "Test",
      quantity: 1,
      price: 49,
      lineTotal: 49,
      warrantyDays: 7,
    },
    {
      productId: "second",
      name: "Second product",
      category: "Test",
      quantity: 1,
      price: 89,
      lineTotal: 89,
      warrantyDays: 7,
    },
  ];
  if (seed) {
    await db.exec(
      `INSERT INTO "user"(id,name,email,"emailVerified","updatedAt") VALUES('admin','Admin','admin@example.test',true,now()),('buyer','Buyer','buyer@example.test',true,now()),('other','Other','other@example.test',true,now());INSERT INTO categories(id,label) VALUES('support-test','Support test');INSERT INTO products(id,name,category_id,price,stock) VALUES('first','First product','support-test',49,20),('second','Second product','support-test',89,20);`,
    );
    for (const [requestId, user] of [
      [id, "buyer"],
      [otherId, "other"],
    ]) {
      const lines = items.map((item) => ({
        ...item,
        payload: `${user}-old-private-${item.productId}`,
        instructions: "Original usage guide",
      }));
      const ciphertext = encryptInventory(
        `cart-delivery:${requestId}`,
        JSON.stringify(lines),
      ).ciphertext;
      await sql.query(
        `INSERT INTO cart_requests(id,user_id,idempotency_key,fingerprint,contact,items,total,status,delivery_ciphertext,delivery_channel,delivered_at,delivered_by) VALUES($1,$2,$3,'fixture','fixture contact',$4,138,'done',$5,'web',now(),'admin')`,
        [requestId, user, randomUUID(), JSON.stringify(items), ciphertext],
      );
      await sql.query(
        "INSERT INTO cart_request_payments(cart_request_id,user_id,amount,status) VALUES($1,$2,138,'paid')",
        [requestId, user],
      );
    }
  }
  return { db, sql, id, otherId, items };
}
function correction(id, state, extra = {}) {
  return {
    id,
    key: randomUUID(),
    expectedVersion: state.version,
    channel: "web",
    reason: "Correct delivered credentials",
    entries: state.entries.map((line) => ({
      productId: line.productId,
      payload: "new-private-" + line.productId,
      instructions: "Updated usage guide",
    })),
    confirmed: true,
    ...extra,
  };
}

test("order conversation enforces ownership and completed payment, and retries only once", async () => {
  const { db, sql, id, otherId } = await setup();
  try {
    await assert.rejects(listOrderMessages(sql, other, id), /ไม่มีสิทธิ์/);
    await assert.rejects(
      sendOrderMessage(sql, other, { id, key: randomUUID(), body: "Wrong buyer" }),
      /ไม่มีสิทธิ์/,
    );
    const input = { id, key: randomUUID(), body: "customer-private-message" };
    await sendOrderMessage(sql, buyer, input);
    await sendOrderMessage(sql, buyer, input);
    await assert.rejects(
      sendOrderMessage(sql, buyer, { ...input, body: "Changed retry" }),
      /ข้อมูลอื่น/,
    );
    await sendOrderMessage(sql, admin, { id, key: randomUUID(), body: "team-private-reply" });
    const page = await listOrderMessages(sql, buyer, id);
    assert.deepEqual(
      page.messages.map((m) => m.body),
      ["customer-private-message", "team-private-reply"],
    );
    assert.equal(page.messages[0].mine, true);
    assert.equal(page.messages[1].role, "admin");
    assert.equal((await listOrderMessages(sql, other, otherId)).messages.length, 0);
    const records = await sql.query(
      "SELECT user_id,key,result FROM operation_keys WHERE kind='cart_message'",
    );
    assert.equal(records.length, 2);
    assert.equal(JSON.stringify(records).includes("customer-private-message"), false);
    assert.throws(() =>
      decryptInventory(
        supportBinding(otherId, records[0].user_id, records[0].key),
        records[0].result.ciphertext,
      ),
    );
    const publicRecords = JSON.stringify(
      await sql.query(
        "SELECT body FROM notifications UNION ALL SELECT metadata::text AS body FROM audit_logs",
      ),
    );
    assert.equal(publicRecords.includes("private-message"), false);
    assert.equal(publicRecords.includes("private-reply"), false);
    assert.equal(
      (await sql.query("SELECT count(*)::int n FROM admin_events WHERE kind='cart.message'"))[0].n,
      1,
    );
    await sql.query("UPDATE cart_requests SET status='received' WHERE id=$1", [id]);
    await assert.rejects(listOrderMessages(sql, buyer, id), /ไม่พบรายการ/);
    await sql.query("UPDATE cart_requests SET status='done' WHERE id=$1", [id]);
    await sql.query("UPDATE cart_request_payments SET status='unpaid' WHERE cart_request_id=$1", [
      id,
    ]);
    await assert.rejects(
      sendOrderMessage(sql, admin, { id, key: randomUUID(), body: "Not paid" }),
      /ไม่พบรายการ/,
    );
  } finally {
    await db.close();
  }
});

test("delivery correction changes buyer data but never stock, amount, fulfillment time or duplicate notifications", async () => {
  const { db, sql, id } = await setup();
  try {
    const state = await readAdminDeliveryEditor(sql, "admin", id),
      input = correction(id, state);
    const stockBefore = await sql.query("SELECT id,stock FROM products ORDER BY id");
    const original = (
      await sql.query(
        "SELECT total,delivered_at::text,delivered_by,status FROM cart_requests WHERE id=$1",
        [id],
      )
    )[0];
    await editDeliveredOrder(sql, "admin", input);
    await editDeliveredOrder(sql, "admin", input);
    const delivery = await readCartDelivery(sql, "buyer", id);
    assert.equal(delivery.entries[0].payload, "new-private-first");
    assert.equal(delivery.entries[0].quantity, 1);
    assert.deepEqual(
      (
        await sql.query(
          "SELECT total,delivered_at::text,delivered_by,status FROM cart_requests WHERE id=$1",
          [id],
        )
      )[0],
      original,
    );
    assert.deepEqual(await sql.query("SELECT id,stock FROM products ORDER BY id"), stockBefore);
    assert.equal((await sql.query("SELECT count(*)::int n FROM inventory_movements"))[0].n, 0);
    assert.equal(
      (
        await sql.query(
          "SELECT count(*)::int n FROM notifications WHERE title='ข้อมูลสินค้าที่จัดส่งได้รับการแก้ไข'",
        )
      )[0].n,
      1,
    );
    const history = await readAdminDeliveryEditor(sql, "admin", id);
    assert.equal(history.history.length, 1);
    const [record] = await sql.query(
      "SELECT result FROM operation_keys WHERE kind='cart_delivery_edit'",
    );
    assert.equal(JSON.stringify(record).includes("new-private-first"), false);
    const archive = JSON.parse(
      decryptInventory(supportBinding(id, "admin", input.key), record.result.ciphertext),
    );
    assert.equal(archive.before.entries[0].payload, "buyer-old-private-first");
    assert.equal(archive.after.entries[0].payload, "new-private-first");
    const publicRecords = JSON.stringify(await sql.query("SELECT metadata FROM audit_logs"));
    assert.equal(publicRecords.includes("new-private-first"), false);
    await assert.rejects(
      editDeliveredOrder(sql, "admin", { ...input, reason: "Different retry" }),
      /ข้อมูลอื่น/,
    );
  } finally {
    await db.close();
  }
});

test("concurrent corrections cannot overwrite a newer delivery snapshot", async () => {
  const { db, sql, id } = await setup();
  try {
    const state = await readAdminDeliveryEditor(sql, "admin", id);
    const a = correction(id, state),
      b = correction(id, state, { reason: "Second administrator correction" });
    b.entries[0].payload = "another-private-value";
    const results = await Promise.allSettled([
      editDeliveredOrder(sql, "admin", a),
      editDeliveredOrder(sql, "admin", b),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.match(results.find((r) => r.status === "rejected").reason.message, /ฉบับล่าสุด/);
    assert.equal((await readAdminDeliveryEditor(sql, "admin", id)).history.length, 1);
  } finally {
    await db.close();
  }
});

test("corrections cannot resurrect refunded credentials and preserve other purchased items", async () => {
  const { db, sql, id } = await setup();
  try {
    const stale = await readAdminDeliveryEditor(sql, "admin", id);
    const claim = await createCartClaim(sql, "buyer", {
      requestId: id,
      productId: "first",
      title: "Item problem",
      message: "Cannot use this item",
      evidence: "",
    });
    await reviewCartClaim(sql, "admin", {
      id: claim.id,
      status: "refunded",
      reply: "Refund approved",
    });
    const state = await readAdminDeliveryEditor(sql, "admin", id);
    assert.deepEqual(
      state.entries.map((i) => i.productId),
      ["second"],
    );
    await assert.rejects(
      editDeliveredOrder(sql, "admin", correction(id, state, { expectedVersion: stale.version })),
      /ฉบับล่าสุด/,
    );
    await assert.rejects(
      editDeliveredOrder(
        sql,
        "admin",
        correction(id, state, { entries: correction(id, stale).entries }),
      ),
      /คืนเงินแล้ว/,
    );
    await editDeliveredOrder(sql, "admin", correction(id, state));
    const delivery = await readCartDelivery(sql, "buyer", id);
    assert.equal(delivery.entries.find((i) => i.productId === "first").payload, "");
    assert.match(delivery.entries.find((i) => i.productId === "first").instructions, /คืนเครดิต/);
    assert.equal(
      delivery.entries.find((i) => i.productId === "second").payload,
      "new-private-second",
    );
  } finally {
    await db.close();
  }
});

test("conversation pagination is bounded and handles identical timestamps without losing messages", async () => {
  const { db, sql, id } = await setup();
  try {
    for (let n = 0; n < 55; n++) {
      const actor = n % 2 ? "admin" : "buyer",
        key = randomUUID();
      const result = {
        requestId: id,
        role: actor === "admin" ? "admin" : "customer",
        ciphertext: encryptInventory(supportBinding(id, actor, key), "Message " + n).ciphertext,
      };
      await sql.query(
        "INSERT INTO operation_keys(user_id,key,kind,result,created_at) VALUES($1,$2,'cart_message',$3,'2026-10-13 00:00:00+00')",
        [actor, key, JSON.stringify(result)],
      );
    }
    const first = await listOrderMessages(sql, buyer, id),
      second = await listOrderMessages(sql, buyer, id, first.before);
    assert.equal(first.messages.length, 50);
    assert.equal(second.messages.length, 5);
    assert.equal(second.before, null);
    assert.equal(new Set([...first.messages, ...second.messages].map((m) => m.id)).size, 55);
  } finally {
    await db.close();
  }
});

test("messages and correction archives survive backup, export only to the buyer, and are scrubbed on account closure", async () => {
  const { db, sql, id, otherId } = await setup();
  let restored;
  try {
    await sendOrderMessage(sql, buyer, { id, key: randomUUID(), body: "buyer-private-support" });
    await sendOrderMessage(sql, admin, { id, key: randomUUID(), body: "team-private-support" });
    await sendOrderMessage(sql, other, {
      id: otherId,
      key: randomUUID(),
      body: "other-private-support",
    });
    await editDeliveredOrder(
      sql,
      "admin",
      correction(id, await readAdminDeliveryEditor(sql, "admin", id)),
    );
    const exported = await exportPersonalData(sql, "buyer");
    assert.equal(exported.data.orderMessages.length, 2);
    assert.equal(JSON.stringify(exported).includes("other-private-support"), false);
    assert.equal(JSON.stringify(exported).includes("admin@example.test"), false);
    const backup = await snapshot(sql);
    assert.equal(JSON.stringify(backup).includes("buyer-private-support"), false);
    restored = await setup(false);
    const seedTables = new Set([
      "roles",
      "permissions",
      "role_permissions",
      "shop_settings",
      "site_configuration",
    ]);
    await restored.db.exec(
      "TRUNCATE " +
        backupTables
          .filter((table) => !seedTables.has(table))
          .map((table) => `"${table}"`)
          .join(",") +
        " CASCADE",
    );
    await restoreIntoEmpty(restored.sql, backup);
    assert.equal((await listOrderMessages(restored.sql, buyer, id)).messages.length, 2);
    assert.equal((await readAdminDeliveryEditor(restored.sql, "admin", id)).history.length, 1);
    const request = await requestDeletion(sql, "buyer", "Close account");
    await reviewDeletion(sql, "admin", request.id, true, "Confirmed closure");
    const scrubbed = await sql.query(
      "SELECT result FROM operation_keys WHERE kind IN ('cart_message','cart_delivery_edit') AND result->>'requestId'=$1",
      [id],
    );
    assert.equal(
      scrubbed.some((r) => r.result.ciphertext),
      false,
    );
    await assert.rejects(listOrderMessages(sql, admin, id), /ไม่พบรายการ/);
    assert.equal(
      (await listOrderMessages(sql, other, otherId)).messages[0].body,
      "other-private-support",
    );
  } finally {
    await db.close();
    if (restored) await restored.db.close();
  }
});

test("support validators reject oversized messages, missing confirmation and forged role fields", () => {
  assert.equal(
    orderMessageInput.safeParse({ id: randomUUID(), key: randomUUID(), body: "x".repeat(2001) })
      .success,
    false,
  );
  const parsed = orderMessageInput.parse({
    id: randomUUID(),
    key: randomUUID(),
    body: " hello ",
    admin: true,
    role: "admin",
    userId: "admin",
  });
  assert.equal(parsed.body, "hello");
  assert.equal("admin" in parsed, false);
  assert.equal("userId" in parsed, false);
  assert.equal(
    deliveryEditInput.safeParse({
      id: randomUUID(),
      key: randomUUID(),
      expectedVersion: "0".repeat(64),
      channel: "web",
      reason: "Valid reason",
      entries: [],
      confirmed: false,
    }).success,
    false,
  );
});
