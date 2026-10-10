import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createCartRequest } from "../src/lib/shop/cart-request-service.server.ts";
import {
  exportPersonalData,
  requestDeletion,
  reviewDeletion,
} from "../src/lib/shop/privacy-service.server.ts";
import { snapshot, restoreIntoEmpty } from "../src/lib/shop/backup-service.server.ts";
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
  if (seed)
    await db.exec(
      `INSERT INTO "user"(id,name,email,"emailVerified","updatedAt") VALUES('buyer','Buyer','buyer@example.test',true,now()),('other','Other','other@example.test',true,now());INSERT INTO categories(id,label) VALUES('test','Test category');INSERT INTO products(id,name,category_id,price,stock) VALUES('product','Test product','test',60,3);INSERT INTO wallet_accounts(user_id,balance) VALUES('buyer',100);`,
    );
  return { db, sql: wrap(db) };
}
const input = {
  key: "5aa3b8ca-a2c4-4010-8c83-4344e36403f2",
  items: [{ productId: "product", quantity: 2 }],
  contact: "buyer@example.test",
  note: "Two items please",
};
test("cart requests use server prices, replay once, and never debit or deliver stock", async () => {
  const { db, sql } = await setup();
  try {
    const result = await createCartRequest(sql, "buyer", input);
    assert.equal(result.total, 120);
    assert.deepEqual(await createCartRequest(sql, "buyer", input), result);
    assert.equal((await sql.query("SELECT count(*)::int AS n FROM cart_requests"))[0].n, 1);
    assert.equal((await sql.query("SELECT balance FROM wallet_accounts"))[0].balance, 100);
    assert.equal((await sql.query("SELECT stock FROM products"))[0].stock, 3);
    for (const table of ["orders", "order_deliveries", "wallet_ledger"])
      assert.equal((await sql.query(`SELECT count(*)::int AS n FROM ${table}`))[0].n, 0);
    const [row] = await sql.query("SELECT items,status FROM cart_requests");
    assert.equal(row.status, "pending");
    assert.deepEqual(row.items, [
      {
        productId: "product",
        name: "Test product",
        category: "Test category",
        price: 60,
        quantity: 2,
      },
    ]);
    await assert.rejects(
      createCartRequest(sql, "buyer", { ...input, note: "Changed request" }),
      /คำขอซ้ำ/,
    );
    assert.equal(
      (
        await sql.query("SELECT count(*)::int AS n FROM admin_events WHERE kind='cart.requested'")
      )[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
test("unavailable, disabled and maintenance requests do not create records", async () => {
  const { db, sql } = await setup();
  try {
    await assert.rejects(
      createCartRequest(sql, "buyer", { ...input, items: [{ productId: "product", quantity: 4 }] }),
      /มีไม่พอ/,
    );
    await sql.query("UPDATE products SET active=false WHERE id='product'");
    await assert.rejects(createCartRequest(sql, "buyer", input), /ไม่ได้เปิดขาย/);
    await sql.query("UPDATE products SET active=true");
    await sql.query("INSERT INTO member_profiles(user_id,disabled) VALUES('buyer',true)");
    await assert.rejects(createCartRequest(sql, "buyer", input), /ถูกระงับ/);
    await sql.query("UPDATE member_profiles SET disabled=false");
    await sql.query(
      `UPDATE site_configuration SET value=jsonb_set(value,'{maintenance}','true'::jsonb)`,
    );
    await assert.rejects(createCartRequest(sql, "buyer", input), /ปรับปรุง/);
    assert.equal((await sql.query("SELECT count(*)::int AS n FROM cart_requests"))[0].n, 0);
  } finally {
    await db.close();
  }
});
test("cart data is owner scoped in privacy exports, backed up and redacted after account closure", async () => {
  const source = await setup(),
    target = await setup(false);
  try {
    await createCartRequest(source.sql, "buyer", input);
    assert.equal((await exportPersonalData(source.sql, "buyer")).data.cartRequests.length, 1);
    assert.equal((await exportPersonalData(source.sql, "other")).data.cartRequests.length, 0);
    const backup = await snapshot(source.sql);
    assert.equal(backup.tables.cart_requests.length, 1);
    await restoreIntoEmpty(target.sql, backup);
    assert.equal((await target.sql.query("SELECT count(*)::int AS n FROM cart_requests"))[0].n, 1);
    await source.sql.query("UPDATE wallet_accounts SET balance=0");
    const deletion = await requestDeletion(source.sql, "buyer", "Please remove my account");
    await assert.rejects(
      reviewDeletion(source.sql, "admin", deletion.id, true, "Confirmed"),
      /รายการค้าง/,
    );
    await source.sql.query("UPDATE cart_requests SET status='done'");
    await reviewDeletion(source.sql, "admin", deletion.id, true, "Confirmed");
    const [row] = await source.sql.query("SELECT contact,note FROM cart_requests");
    assert.equal(row.contact, "บัญชีที่ปิดแล้ว");
    assert.equal(row.note, "");
  } finally {
    await source.db.close();
    await target.db.close();
  }
});
