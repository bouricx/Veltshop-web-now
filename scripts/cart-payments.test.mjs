import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createCartRequest } from "../src/lib/shop/cart-request-service.server.ts";
import { verifyCartRequestSlip } from "../src/lib/shop/cart-payment-service.server.ts";
import { reviewCartPayment } from "../src/lib/shop/cart-payment-review.server.ts";
import { changeCartRequestStatus } from "../src/lib/shop/cart-status-service.server.ts";
import {
  fulfillCartRequest,
  readCartDelivery,
} from "../src/lib/shop/cart-delivery-service.server.ts";
import { snapshot } from "../src/lib/shop/backup-service.server.ts";
import { exportPersonalData } from "../src/lib/shop/privacy-service.server.ts";
import {
  checkoutReadiness,
  refreshCartPaymentStates,
} from "../src/lib/shop/checkout-service.server.ts";
import { paymentProviders } from "../src/lib/shop/payment-providers.server.ts";

// Test-only images and provider responses. No bank transfers or external requests.
const image = (value = "one") =>
  `data:image/png;base64,${Buffer.from(`test-only-image-bytes-${value}`.padEnd(80, ".")).toString("base64")}`;
async function setup() {
  const db = new PGlite();
  for (const name of (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((n) => /^\d.*\.sql$/.test(n))
    .sort())
    await db.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  const wrap = (client) => ({
    query: async (sql, values = []) => (await client.query(sql, values)).rows,
    transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
  });
  const sql = wrap(db);
  await sql.query(
    `INSERT INTO "user"(id,name,email,"emailVerified","updatedAt") VALUES('buyer','Buyer','buyer@example.test',true,now()),('other','Other','other@example.test',true,now())`,
  );
  await sql.query(
    "INSERT INTO categories(id,label) VALUES('test-category','Test category') ON CONFLICT DO NOTHING",
  );
  await sql.query(
    "INSERT INTO products(id,name,category_id,price,stock) VALUES('test-product','Test product','test-category',60,10)",
  );
  const create = (user = "buyer", quantity = 1) =>
    createCartRequest(sql, user, {
      key: randomUUID(),
      items: [{ productId: "test-product", quantity }],
      contact: "test@example.test",
      note: "Automated test",
    });
  const row = async (id) =>
    (await sql.query("SELECT * FROM cart_request_payments WHERE cart_request_id=$1", [id]))[0];
  return { db, sql, create, row };
}

test("manual payment: order -> evidence -> merchant approval -> stock/delivery, once only", async () => {
  const { db, sql, create, row } = await setup();
  const secret = process.env.SLIP2GO_API_SECRET;
  delete process.env.SLIP2GO_API_SECRET;
  try {
    assert.deepEqual((await checkoutReadiness(sql)).verification, "manual");
    const order = await create();
    const payment = await row(order.id);
    assert.equal(Date.parse(payment.expires_at) - Date.parse(payment.created_at), 300000);
    assert.equal(payment.receive_account, "0928160016");
    await sql.query("UPDATE shop_settings SET receive_account='0812345678' WHERE id=1");
    assert.equal((await row(order.id)).receive_account, "0928160016");
    assert.equal((await verifyCartRequestSlip(sql, "other", order.id, image())).ok, false);
    assert.equal((await row(order.id)).status, "unpaid");
    const submitted = await verifyCartRequestSlip(sql, "buyer", order.id, image());
    assert.equal(submitted.status, "manual_review");
    assert.equal((await row(order.id)).status, "manual_review");
    assert.ok((await row(order.id)).slip_evidence);
    assert.equal(
      (await sql.query("SELECT count(*)::int n FROM transactions WHERE kind='CART_PAYMENT'"))[0].n,
      0,
    );
    assert.equal(
      (await verifyCartRequestSlip(sql, "buyer", order.id, image("changed"))).status,
      "manual_review",
    );
    assert.equal(
      (
        await changeCartRequestStatus(sql, "admin", {
          id: order.id,
          expectedStatus: "pending",
          status: "done",
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await reviewCartPayment(sql, "admin", {
          id: order.id,
          decision: "approve",
          expectedStatus: "manual_review",
          bankConfirmed: true,
          reference: "   ",
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await reviewCartPayment(sql, "admin", {
          id: order.id,
          decision: "approve",
          expectedStatus: "manual_review",
          bankConfirmed: true,
          reference: "TEST-BANK-REF-1",
        })
      ).ok,
      true,
    );
    assert.equal((await row(order.id)).status, "paid");
    assert.equal(
      (
        await reviewCartPayment(sql, "admin", {
          id: order.id,
          decision: "approve",
          expectedStatus: "manual_review",
          bankConfirmed: true,
          reference: "TEST-BANK-REF-1",
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await changeCartRequestStatus(sql, "admin", {
          id: order.id,
          expectedStatus: "pending",
          status: "cancelled",
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await changeCartRequestStatus(sql, "admin", {
          id: order.id,
          expectedStatus: "pending",
          status: "received",
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await fulfillCartRequest(sql, "admin", {
          id: order.id,
          expectedStatus: "received",
          channel: "facebook",
          entries: [],
          confirmedDelivered: true,
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await fulfillCartRequest(sql, "admin", {
          id: order.id,
          expectedStatus: "received",
          channel: "facebook",
          entries: [],
          confirmedDelivered: true,
        })
      ).ok,
      false,
    );
    assert.equal(
      (await sql.query("SELECT stock FROM products WHERE id='test-product'"))[0].stock,
      9,
    );
    assert.equal(
      (await sql.query("SELECT count(*)::int n FROM transactions WHERE kind='CART_PAYMENT'"))[0].n,
      1,
    );
  } finally {
    if (secret !== undefined) process.env.SLIP2GO_API_SECRET = secret;
    await db.close();
  }
});

test("expired orders hide payment eligibility, preserve late evidence, recover interrupted checks", async () => {
  const { db, sql, create, row } = await setup();
  const verify = paymentProviders.promptpay.verify;
  paymentProviders.promptpay.verify = async () => {
    throw new Error("Late evidence must not call automatic verification");
  };
  try {
    const order = await create();
    await sql.query(
      "UPDATE cart_request_payments SET expires_at=now()-interval '1 second' WHERE cart_request_id=$1",
      [order.id],
    );
    await refreshCartPaymentStates(sql, "buyer");
    assert.equal((await row(order.id)).status, "expired");
    assert.equal(
      (await verifyCartRequestSlip(sql, "buyer", order.id, image())).status,
      "manual_review",
    );
    assert.equal((await row(order.id)).status, "manual_review");
    const next = await create();
    await sql.query(
      "UPDATE cart_request_payments SET status='verifying',submitted_at=now()-interval '2 minutes',slip_evidence=$2 WHERE cart_request_id=$1",
      [next.id, image("next")],
    );
    await refreshCartPaymentStates(sql, "buyer");
    assert.equal((await row(next.id)).status, "manual_review");
  } finally {
    paymentProviders.promptpay.verify = verify;
    await db.close();
  }
});

test("provider success must match amount, order window and unique bank reference", async () => {
  const { db, sql, create, row } = await setup();
  const verify = paymentProviders.promptpay.verify;
  let calls = 0;
  paymentProviders.promptpay.verify = async () => {
    calls++;
    return {
      ok: true,
      amount: 60,
      reference: "TEST-VERIFIED-REFERENCE",
      transferredAt: Date.now(),
      reason: "verified fixture",
    };
  };
  try {
    const first = await create();
    const results = await Promise.all([
      verifyCartRequestSlip(sql, "buyer", first.id, image()),
      verifyCartRequestSlip(sql, "buyer", first.id, image()),
    ]);
    assert.ok(results.some((r) => r.ok));
    assert.equal(calls, 1);
    assert.equal((await row(first.id)).status, "paid");
    const second = await create();
    assert.equal((await verifyCartRequestSlip(sql, "buyer", second.id, image())).ok, false);
    assert.equal(
      (await verifyCartRequestSlip(sql, "buyer", second.id, image("different"))).ok,
      false,
    );
    assert.equal((await row(second.id)).status, "rejected");
    paymentProviders.promptpay.verify = async () => ({
      ok: true,
      amount: 61,
      reference: "OTHER",
      transferredAt: Date.now(),
      reason: "wrong amount",
    });
    assert.equal((await verifyCartRequestSlip(sql, "buyer", second.id, image("wrong"))).ok, false);
    paymentProviders.promptpay.verify = async () => ({
      ok: true,
      amount: 60,
      reference: "OLD",
      transferredAt: Date.now() - 60000,
      reason: "old",
    });
    assert.equal((await verifyCartRequestSlip(sql, "buyer", second.id, image("old"))).ok, false);
    paymentProviders.promptpay.verify = async () => {
      throw new Error("timeout");
    };
    assert.equal(
      (await verifyCartRequestSlip(sql, "buyer", second.id, image("timeout"))).status,
      "manual_review",
    );
  } finally {
    paymentProviders.promptpay.verify = verify;
    await db.close();
  }
});

test("unpaid orders reserve stock only for their window; invalid files/cancelled orders never charge", async () => {
  const { db, sql, create, row } = await setup();
  try {
    const first = await create("buyer", 10);
    await assert.rejects(create("other"), /สต็อกยืนยันแล้ว 0/);
    await sql.query(
      "UPDATE cart_request_payments SET expires_at=now()-interval '1 second' WHERE cart_request_id=$1",
      [first.id],
    );
    const second = await create("other");
    assert.equal((await verifyCartRequestSlip(sql, "other", second.id, "invalid")).ok, false);
    assert.equal(
      (
        await verifyCartRequestSlip(
          sql,
          "other",
          second.id,
          `data:image/png;base64,${Buffer.alloc(3 * 1024 * 1024 + 1).toString("base64")}`,
        )
      ).ok,
      false,
    );
    assert.equal((await row(second.id)).status, "unpaid");
    assert.equal(
      (
        await changeCartRequestStatus(sql, "admin", {
          id: second.id,
          expectedStatus: "pending",
          status: "cancelled",
        })
      ).ok,
      true,
    );
    assert.equal((await verifyCartRequestSlip(sql, "other", second.id, image())).ok, false);
  } finally {
    await db.close();
  }
});

test("merchant can reconcile an expired order against real bank records, without uploaded proof", async () => {
  const { db, sql, create, row } = await setup();
  try {
    const order = await create();
    await sql.query(
      "UPDATE cart_request_payments SET expires_at=now()-interval '1 second' WHERE cart_request_id=$1",
      [order.id],
    );
    await refreshCartPaymentStates(sql, "buyer");
    const approve = {
      id: order.id,
      decision: "approve",
      expectedStatus: "expired",
      reference: "MANUAL-EXPIRED-REF",
    };
    assert.equal((await reviewCartPayment(sql, "admin", approve)).ok, false);
    assert.equal((await row(order.id)).status, "expired");
    assert.equal(
      (
        await reviewCartPayment(sql, "admin", {
          ...approve,
          expectedStatus: "unpaid",
          bankConfirmed: true,
        })
      ).ok,
      false,
    );
    assert.equal(
      (await reviewCartPayment(sql, "admin", { ...approve, bankConfirmed: true })).ok,
      true,
    );
    assert.equal((await row(order.id)).status, "paid");
    assert.equal((await row(order.id)).slip_evidence, null);
    assert.equal(
      (
        await sql.query("SELECT provider FROM transactions WHERE provider_ref=$1", [
          approve.reference,
        ])
      )[0].provider,
      "manual_bank",
    );
    const next = await create();
    assert.equal(
      (
        await reviewCartPayment(sql, "admin", {
          ...approve,
          id: next.id,
          expectedStatus: "unpaid",
          bankConfirmed: true,
        })
      ).ok,
      false,
    );
    await changeCartRequestStatus(sql, "admin", {
      id: next.id,
      expectedStatus: "pending",
      status: "cancelled",
    });
    assert.equal(
      (
        await reviewCartPayment(sql, "admin", {
          ...approve,
          id: next.id,
          expectedStatus: "unpaid",
          reference: "OTHER-BANK-REF",
          bankConfirmed: true,
        })
      ).ok,
      false,
    );
  } finally {
    await db.close();
  }
});

test("web delivery is encrypted, owner-only, immutable, and deducts stock exactly once", async () => {
  const { db, sql, create } = await setup();
  const previousKey = process.env.INVENTORY_ENCRYPTION_KEY;
  process.env.INVENTORY_ENCRYPTION_KEY = "a1".repeat(32);
  try {
    const order = await create();
    const payload = "TEST-ONLY-SECRET: user@example.test / demonstration-password";
    const delivery = {
      id: order.id,
      expectedStatus: "pending",
      channel: "web",
      entries: [{ productId: "test-product", payload }],
      confirmedDelivered: true,
    };
    assert.equal((await fulfillCartRequest(sql, "admin", delivery)).ok, false);
    await reviewCartPayment(sql, "admin", {
      id: order.id,
      decision: "approve",
      expectedStatus: "unpaid",
      bankConfirmed: true,
      reference: "WEB-DELIVERY-REF",
    });
    assert.equal(
      (await fulfillCartRequest(sql, "admin", { ...delivery, confirmedDelivered: false })).ok,
      false,
    );
    assert.equal((await fulfillCartRequest(sql, "admin", { ...delivery, entries: [] })).ok, false);
    delete process.env.INVENTORY_ENCRYPTION_KEY;
    assert.equal((await fulfillCartRequest(sql, "admin", delivery)).ok, false);
    assert.equal(
      (await sql.query("SELECT stock FROM products WHERE id='test-product'"))[0].stock,
      10,
    );
    process.env.INVENTORY_ENCRYPTION_KEY = "a1".repeat(32);
    assert.equal((await fulfillCartRequest(sql, "admin", delivery)).ok, true);
    const [record] = await sql.query(
      "SELECT status,delivery_ciphertext,delivery_channel,delivered_at FROM cart_requests WHERE id=$1",
      [order.id],
    );
    assert.equal(record.status, "done");
    assert.equal(record.delivery_channel, "web");
    assert.ok(record.delivered_at);
    assert.ok(record.delivery_ciphertext.startsWith("v1."));
    assert.ok(!record.delivery_ciphertext.includes(payload));
    assert.equal(await readCartDelivery(sql, "other", order.id), null);
    const received = await readCartDelivery(sql, "buyer", order.id);
    assert.equal(received.entries[0].payload, payload);
    assert.equal(received.entries[0].name, "Test product");
    assert.equal(
      (
        await fulfillCartRequest(sql, "admin", {
          ...delivery,
          entries: [{ productId: "test-product", payload: "replacement" }],
        })
      ).ok,
      false,
    );
    assert.equal((await readCartDelivery(sql, "buyer", order.id)).entries[0].payload, payload);
    assert.equal(
      (await sql.query("SELECT stock FROM products WHERE id='test-product'"))[0].stock,
      9,
    );
    assert.equal(
      (
        await sql.query("SELECT count(*)::int n FROM inventory_movements WHERE reason=$1", [
          `cart:${order.id}`,
        ])
      )[0].n,
      1,
    );
    const records = await sql.query(
      "SELECT to_jsonb(t) data FROM audit_logs t UNION ALL SELECT to_jsonb(n) FROM notifications n",
    );
    assert.ok(!JSON.stringify(records).includes(payload));
    const backup = await snapshot(sql);
    assert.equal(backup.tables.cart_requests[0].delivery_ciphertext, record.delivery_ciphertext);
    assert.ok(!JSON.stringify(await exportPersonalData(sql, "buyer")).includes(payload));
    await sql.query("UPDATE cart_request_payments SET status='rejected' WHERE cart_request_id=$1", [
      order.id,
    ]);
    assert.equal(await readCartDelivery(sql, "buyer", order.id), null);
  } finally {
    if (previousKey === undefined) delete process.env.INVENTORY_ENCRYPTION_KEY;
    else process.env.INVENTORY_ENCRYPTION_KEY = previousKey;
    await db.close();
  }
});

test("multi-product delivery rolls back all stock and credentials if any item is unavailable", async () => {
  const { db, sql } = await setup();
  const previousKey = process.env.INVENTORY_ENCRYPTION_KEY;
  process.env.INVENTORY_ENCRYPTION_KEY = "b2".repeat(32);
  try {
    await sql.query(
      "INSERT INTO products(id,name,category_id,price,stock) VALUES('z-product','Second product','test-category',40,1)",
    );
    const order = await createCartRequest(sql, "buyer", {
      key: randomUUID(),
      items: [
        { productId: "test-product", quantity: 1 },
        { productId: "z-product", quantity: 1 },
      ],
      contact: "test@example.test",
      note: "",
    });
    await reviewCartPayment(sql, "admin", {
      id: order.id,
      decision: "approve",
      expectedStatus: "unpaid",
      bankConfirmed: true,
      reference: "MULTI-STOCK-REF",
    });
    await sql.query("UPDATE products SET stock=0 WHERE id='z-product'");
    const delivery = {
      id: order.id,
      expectedStatus: "pending",
      channel: "web",
      confirmedDelivered: true,
      entries: [
        { productId: "test-product", payload: "test secret one" },
        { productId: "z-product", payload: "test secret two" },
      ],
    };
    assert.equal((await fulfillCartRequest(sql, "admin", delivery)).ok, false);
    assert.equal(
      (await sql.query("SELECT stock FROM products WHERE id='test-product'"))[0].stock,
      10,
    );
    assert.deepEqual(
      await sql.query("SELECT status,delivery_ciphertext FROM cart_requests WHERE id=$1", [
        order.id,
      ]),
      [{ status: "pending", delivery_ciphertext: null }],
    );
    assert.equal(
      (
        await sql.query("SELECT count(*)::int n FROM inventory_movements WHERE reason=$1", [
          `cart:${order.id}`,
        ])
      )[0].n,
      0,
    );
    await sql.query("UPDATE products SET stock=1 WHERE id='z-product'");
    assert.equal((await fulfillCartRequest(sql, "admin", delivery)).ok, true);
    assert.equal((await readCartDelivery(sql, "buyer", order.id)).entries.length, 2);
  } finally {
    if (previousKey === undefined) delete process.env.INVENTORY_ENCRYPTION_KEY;
    else process.env.INVENTORY_ENCRYPTION_KEY = previousKey;
    await db.close();
  }
});
