import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { purchase, creditVerifiedSlip } from "../src/lib/shop/commerce.server.ts";
async function setup(stock = 1, balance = 100) {
  const db = new PGlite();
  for (const file of [
    "0002_shop.sql",
    "0003_payments_hash.sql",
    "0004_promptpay.sql",
    "0005_payments_user.sql",
    "0006_wallet_slip_evidence.sql",
    "0007_phase1_foundation.sql",
    "0008_phase2_auth_roles.sql",
    "0009_checkout_idempotency.sql",
  ])
    await db.exec(await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"));
  const wrap = (client) => ({
    query: async (text, params = []) => (await client.query(text, params)).rows,
    transaction: (work) => db.transaction((tx) => work(wrap(tx))),
  });
  await db.exec(
    `INSERT INTO categories(id,label) VALUES('test','Test'); INSERT INTO products(id,name,category_id,price,stock) VALUES('p','P','test',60,${stock}); INSERT INTO wallet_accounts(user_id,balance) VALUES('a',${balance}),('b',100);`,
  );
  return { db, sql: wrap(db) };
}
test("last stock can only be sold once", async () => {
  const { db, sql } = await setup();
  try {
    const r = await Promise.allSettled([
      purchase(sql, "a", "p", "key-a"),
      purchase(sql, "b", "p", "key-b"),
    ]);
    assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal((await sql.query("SELECT stock FROM products"))[0].stock, 0);
    assert.equal((await sql.query("SELECT count(*)::int as n FROM orders"))[0].n, 1);
  } finally {
    await db.close();
  }
});
test("retry returns same order without another debit", async () => {
  const { db, sql } = await setup(2);
  try {
    const a = await purchase(sql, "a", "p", "key");
    const b = await purchase(sql, "a", "p", "key");
    assert.equal(a.orderId, b.orderId);
    assert.equal(b.balance, 40);
    assert.equal((await sql.query("SELECT stock FROM products"))[0].stock, 1);
  } finally {
    await db.close();
  }
});
test("insufficient funds leaves stock and orders intact", async () => {
  const { db, sql } = await setup(1, 10);
  try {
    await assert.rejects(purchase(sql, "a", "p", "key"));
    assert.equal((await sql.query("SELECT stock FROM products"))[0].stock, 1);
    assert.equal((await sql.query("SELECT count(*)::int as n FROM orders"))[0].n, 0);
  } finally {
    await db.close();
  }
});
test("ledger failure rolls back debit and stock", async () => {
  const { db, sql } = await setup();
  try {
    await db.exec("ALTER TABLE wallet_ledger ADD CONSTRAINT test_fail CHECK(reason <> 'purchase')");
    await assert.rejects(purchase(sql, "a", "p", "key"));
    assert.equal(
      (await sql.query("SELECT balance FROM wallet_accounts WHERE user_id='a'"))[0].balance,
      100,
    );
    assert.equal((await sql.query("SELECT stock FROM products"))[0].stock, 1);
  } finally {
    await db.close();
  }
});
test("duplicate verified slip credits exactly once across users", async () => {
  const { db, sql } = await setup();
  try {
    const input = {
      id: "payment-a",
      userId: "a",
      amount: 50,
      fee: 0,
      credit: 50,
      hash: "same-slip",
    };
    await creditVerifiedSlip(sql, input);
    await assert.rejects(creditVerifiedSlip(sql, { ...input, id: "payment-b", userId: "b" }));
    assert.equal(
      (await sql.query("SELECT sum(balance)::int as total FROM wallet_accounts"))[0].total,
      250,
    );
    assert.equal((await sql.query("SELECT count(*)::int as n FROM wallet_ledger"))[0].n, 1);
  } finally {
    await db.close();
  }
});
test("payment ledger failure rolls back successful payment", async () => {
  const { db, sql } = await setup();
  try {
    await db.exec("ALTER TABLE wallet_ledger ADD CONSTRAINT test_fail CHECK(reason <> 'topup')");
    await assert.rejects(
      creditVerifiedSlip(sql, {
        id: "payment",
        userId: "a",
        amount: 50,
        fee: 0,
        credit: 50,
        hash: "hash",
      }),
    );
    assert.equal((await sql.query("SELECT count(*)::int as n FROM payments"))[0].n, 0);
    assert.equal(
      (await sql.query("SELECT balance FROM wallet_accounts WHERE user_id='a'"))[0].balance,
      100,
    );
  } finally {
    await db.close();
  }
});

test('same provider reference with a different image cannot credit twice', async () => {
  const { db, sql } = await setup();
  try {
    const first = { id: 'reference-a', userId: 'a', amount: 50, fee: 0, credit: 50, hash: 'image-a', provider: 'slip2go', reference: 'bank-transfer' };
    await creditVerifiedSlip(sql, first);
    await assert.rejects(creditVerifiedSlip(sql, { ...first, id: 'reference-b', userId: 'b', hash: 'image-b' }));
    assert.equal((await sql.query('SELECT sum(balance)::int as total FROM wallet_accounts'))[0].total, 250);
  } finally { await db.close(); }
});
