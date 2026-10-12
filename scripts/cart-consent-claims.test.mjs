import { requestDeletion, reviewDeletion } from "../src/lib/shop/privacy-service.server.ts";
import { purchase } from "../src/lib/shop/commerce.server.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { quoteCart } from "../src/lib/shop/cart-quote.server.ts";
import { createCartRequest } from "../src/lib/shop/cart-request-service.server.ts";
import {
  createCartClaim,
  reviewCartClaim,
  cartClaimEligibility,
} from "../src/lib/shop/cart-claims-service.server.ts";
import { readCartDelivery } from "../src/lib/shop/cart-delivery-service.server.ts";
import { encryptInventory } from "../src/lib/shop/inventory-crypto.server.ts";
import { useCart } from "../src/lib/shop/cart-store.ts";
async function setup() {
  const db = new PGlite();
  for (const name of (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((n) => /^\d.*\.sql$/.test(n))
    .sort())
    await db.exec(await readFile(new URL("../migrations/" + name, import.meta.url), "utf8"));
  const wrap = (client) => ({
    query: async (s, p = []) => (await client.query(s, p)).rows,
    transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
  });
  const sql = wrap(db);
  await db.exec(
    `INSERT INTO "user"(id,name,email,"emailVerified","updatedAt") VALUES('a','A','a@example.test',true,now()),('b','B','b@example.test',true,now());INSERT INTO categories(id,label) VALUES('test','Test');INSERT INTO products(id,name,category_id,price,stock,warranty_days) VALUES('p','Product','test',60,20,7);INSERT INTO wallet_accounts(user_id,balance) VALUES('a',0),('b',0);`,
  );
  const quote = (user = "a", quantity = 1, coupon = "") =>
    sql.transaction((tx) => quoteCart(tx, user, [{ productId: "p", quantity }], coupon));
  const create = async (user = "a", quantity = 1, coupon = "") =>
    createCartRequest(sql, user, {
      key: randomUUID(),
      items: [{ productId: "p", quantity }],
      contact: "discord:test",
      note: "",
      coupon,
      acceptedQuote: await quote(user, quantity, coupon),
    });
  return { db, sql, quote, create };
}
test("catalog sync updates rising/falling prices and preserves quantity and saved line fields", () => {
  useCart.setState({
    items: [
      {
        productId: "p",
        name: "Saved option",
        price: 60,
        quantity: 3,
        markColor: "#000000",
        selection: "keep",
      },
    ],
  });
  for (const price of [90, 40]) {
    useCart.getState().syncProductMarks([{ id: "p", price, cardColor: "#123456" }]);
    const line = useCart.getState().items[0];
    assert.equal(line.price, price);
    assert.equal(line.quantity, 3);
    assert.equal(line.name, "Saved option");
    assert.equal(line.selection, "keep");
  }
  useCart.getState().quantity("p", 4);
  assert.equal(useCart.getState().items[0].price, 40);
  assert.equal(useCart.getState().items[0].quantity, 4);
  useCart.getState().clear();
});
for (const changedPrice of [90, 40])
  test(`checkout price 60 -> ${changedPrice} requires new consent and retry creates once`, async () => {
    const { db, sql, quote } = await setup();
    try {
      const accepted = await quote("a", 2),
        data = {
          key: randomUUID(),
          items: [{ productId: "p", quantity: 2 }],
          contact: "discord:test",
          note: "keep note",
          acceptedQuote: accepted,
        };
      await sql.query("UPDATE products SET price=$1 WHERE id=$2", [changedPrice, "p"]);
      const changed = await createCartRequest(sql, "a", data);
      assert.equal(changed.code, "PRICE_CHANGED");
      assert.equal(changed.quote.total, changedPrice * 2);
      assert.equal((await sql.query("SELECT count(*)::int n FROM cart_requests"))[0].n, 0);
      assert.equal((await sql.query("SELECT count(*)::int n FROM cart_request_payments"))[0].n, 0);
      const retry = { ...data, acceptedQuote: changed.quote };
      const r = await createCartRequest(sql, "a", retry);
      assert.equal(r.total, changedPrice * 2);
      assert.deepEqual(await createCartRequest(sql, "a", retry), r);
      assert.equal((await sql.query("SELECT stock FROM products WHERE id=$1", ["p"]))[0].stock, 20);
    } finally {
      await db.close();
    }
  });
test("missing consent and quantity changes do not create payment; quantity can be requoted", async () => {
  const { db, sql, quote } = await setup();
  try {
    const accepted = await quote();
    const data = {
      key: randomUUID(),
      items: [{ productId: "p", quantity: 2 }],
      contact: "discord:test",
      note: "",
    };
    assert.equal((await createCartRequest(sql, "a", data)).code, "PRICE_CHANGED");
    const changed = await createCartRequest(sql, "a", { ...data, acceptedQuote: accepted });
    assert.equal(changed.code, "PRICE_CHANGED");
    assert.equal(changed.quote.total, 120);
    assert.equal(
      (await createCartRequest(sql, "a", { ...data, acceptedQuote: changed.quote })).total,
      120,
    );
  } finally {
    await db.close();
  }
});
test("coupon reserves a single use across buyers and discount changes require consent", async () => {
  const { db, sql, quote } = await setup();
  try {
    await sql.query(
      "INSERT INTO coupons(id,code,kind,amount,minimum,usage_limit,per_user_limit) VALUES('coupon','SAVE','fixed',10,1,1,1)",
    );
    const a = await quote("a", 1, "SAVE"),
      b = await quote("b", 1, "SAVE");
    assert.equal(a.total, 50);
    const attempts = await Promise.allSettled(
      ["a", "b"].map((user, index) =>
        createCartRequest(sql, user, {
          key: randomUUID(),
          items: [{ productId: "p", quantity: 1 }],
          contact: "discord:test",
          note: "",
          coupon: "SAVE",
          acceptedQuote: index ? b : a,
        }),
      ),
    );
    assert.equal(attempts.filter((r) => r.status === "fulfilled" && r.value.ok).length, 1);
    assert.equal((await sql.query("SELECT count(*)::int n FROM cart_requests"))[0].n, 1);
    await assert.rejects(
      purchase(sql, "a", "p", "legacy-after-cart", { coupon: "SAVE" }),
      /ส่วนลด|ครบสิทธิ์/,
    );
    const [r] = await sql.query("SELECT id FROM cart_requests");
    await sql.query("UPDATE cart_requests SET status='cancelled' WHERE id=$1", [r.id]);
    const before = await quote("a", 1, "SAVE");
    await sql.query("UPDATE coupons SET amount=20 WHERE id=$1", ["coupon"]);
    const changed = await createCartRequest(sql, "a", {
      key: randomUUID(),
      items: [{ productId: "p", quantity: 1 }],
      contact: "discord:test",
      note: "",
      coupon: "SAVE",
      acceptedQuote: before,
    });
    assert.equal(changed.code, "PRICE_CHANGED");
    assert.equal(changed.quote.total, 40);
    await sql.query("UPDATE coupons SET expires_at=now()-interval '1 minute' WHERE id='coupon'");
    await assert.rejects(quote("a", 1, "SAVE"), /หมดอายุ/);
    await sql.query(
      "INSERT INTO products(id,name,category_id,price,stock) VALUES('other','Other','test',20,2)",
    );
    await sql.query("UPDATE coupons SET expires_at=NULL,product_id='other' WHERE id='coupon'");
    await assert.rejects(quote("a", 1, "SAVE"), /ไม่ตรง/);
  } finally {
    await db.close();
  }
});
test("cart claim verifies ownership, warranty and duplicate opening; refund once revokes product secret", async () => {
  const { db, sql, create } = await setup();
  const previous = process.env.INVENTORY_ENCRYPTION_KEY;
  process.env.INVENTORY_ENCRYPTION_KEY = "ab".repeat(32);
  try {
    const r = await create();
    const encoded = encryptInventory(
      `cart-delivery:${r.id}`,
      JSON.stringify([{ productId: "p", name: "Product", quantity: 1, payload: "test-secret" }]),
    ).ciphertext;
    await sql.query(
      "UPDATE cart_requests SET status='done',delivered_at=now(),delivery_ciphertext=$2,delivery_channel='web' WHERE id=$1",
      [r.id, encoded],
    );
    await sql.query("UPDATE cart_request_payments SET status='paid' WHERE cart_request_id=$1", [
      r.id,
    ]);
    const data = {
      requestId: r.id,
      productId: "p",
      title: "Problem",
      message: "Please check",
      evidence: "",
    };
    await assert.rejects(createCartClaim(sql, "b", data), /ของคุณ/);
    const c = await createCartClaim(sql, "a", data);
    await assert.rejects(createCartClaim(sql, "a", data), /ดำเนินการ/);
    assert.equal((await cartClaimEligibility(sql, "a", r.id)).claims.length, 1);
    const deletion = await requestDeletion(sql, "a", "test-only deletion request");
    await assert.rejects(
      reviewDeletion(sql, "admin", deletion.id, true, "test approval"),
      /รายการค้าง/,
    );
    assert.equal((await readCartDelivery(sql, "a", r.id)).entries[0].payload, "test-secret");
    assert.equal(await readCartDelivery(sql, "b", r.id), null);
    await reviewCartClaim(sql, "admin", {
      id: c.id,
      status: "refunded",
      reply: "Confirmed refund",
    });
    await assert.rejects(
      reviewCartClaim(sql, "admin", { id: c.id, status: "refunded", reply: "Again" }),
      /ปิดแล้ว/,
    );
    assert.equal(
      (await sql.query("SELECT balance FROM wallet_accounts WHERE user_id='a'"))[0].balance,
      60,
    );
    assert.equal((await readCartDelivery(sql, "a", r.id)).entries[0].payload, "");
    assert.equal((await sql.query("SELECT stock FROM products WHERE id=$1", ["p"]))[0].stock, 20);
    assert.ok(
      !(await sql.query("SELECT metadata FROM audit_logs")).some((r) =>
        JSON.stringify(r.metadata).includes("test-secret"),
      ),
    );
    const expired = await create("b");
    await sql.query(
      "UPDATE cart_requests SET status='done',delivered_at=now()-interval '8 days' WHERE id=$1",
      [expired.id],
    );
    await sql.query("UPDATE cart_request_payments SET status='paid' WHERE cart_request_id=$1", [
      expired.id,
    ]);
    await assert.rejects(createCartClaim(sql, "b", { ...data, requestId: expired.id }), /หมดระยะ/);
  } finally {
    await db.close();
    if (previous === undefined) delete process.env.INVENTORY_ENCRYPTION_KEY;
    else process.env.INVENTORY_ENCRYPTION_KEY = previous;
  }
});
