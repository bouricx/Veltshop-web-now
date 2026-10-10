import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  changeWallet,
  refundOrder,
  deliverOrder,
  createClaim,
  reviewPayment,
  redeemGift,
  giftHash,
  limit,
} from "../src/lib/shop/operations-service.server.ts";
import { purchase } from "../src/lib/shop/commerce.server.ts";
import { readOwnedDelivery } from "../src/lib/shop/inventory-service.server.ts";
import { processJobs, enqueue } from "../src/lib/shop/jobs-service.server.ts";
async function setup() {
  const db = new PGlite();
  for (const file of (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((f) => /^\d.*\.sql$/.test(f))
    .sort())
    await db.exec(await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"));
  const wrap = (client) => ({
    query: async (text, params = []) => (await client.query(text, params)).rows,
    transaction: (work) => db.transaction((tx) => work(wrap(tx))),
  });
  await db.exec(
    `INSERT INTO "user"(id,name,email,"emailVerified","updatedAt") VALUES('a','A','a@example.test',true,now()),('b','B','b@example.test',true,now());INSERT INTO categories(id,label) VALUES('test','Test');INSERT INTO products(id,name,category_id,price,stock,warranty_days) VALUES('p','Product','test',60,10,7);INSERT INTO wallet_accounts(user_id,balance) VALUES('a',100),('b',100);`,
  );
  return { db, sql: wrap(db) };
}
test("admin adjustment retry and refund race create exactly one ledger effect", async () => {
  const { db, sql } = await setup();
  try {
    await changeWallet(sql, "admin", "a", 20, "test adjustment", "same");
    await changeWallet(sql, "admin", "a", 20, "test adjustment", "same");
    assert.equal(
      (await sql.query("SELECT balance FROM wallet_accounts WHERE user_id='a'"))[0].balance,
      120,
    );
    const sale = await purchase(sql, "a", "p", "order");
    const results = await Promise.all([
      refundOrder(sql, "admin", sale.orderId, "refund"),
      refundOrder(sql, "admin", sale.orderId, "refund"),
    ]);
    assert.equal(results.filter((r) => !r.replay).length, 1);
    assert.equal(
      (await sql.query("SELECT balance FROM wallet_accounts WHERE user_id='a'"))[0].balance,
      120,
    );
    assert.equal((await sql.query("SELECT stock FROM products"))[0].stock, 9);
    await assert.rejects(sql.query("DELETE FROM wallet_ledger"));
    await assert.rejects(sql.query("UPDATE audit_logs SET action='tampered'"));
  } finally {
    await db.close();
  }
});
test("coupon limit is serialized across buyers, applies server prices, and rollback retains use", async () => {
  const { db, sql } = await setup();
  try {
    await sql.query(
      "INSERT INTO coupons(id,code,kind,amount,usage_limit) VALUES('c','HALF','percent',50,1)",
    );
    const results = await Promise.allSettled([
      purchase(sql, "a", "p", "a", { coupon: "HALF" }),
      purchase(sql, "b", "p", "b", { coupon: "HALF" }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await sql.query("SELECT total FROM orders"))[0].total, 30);
    assert.equal((await sql.query("SELECT used FROM coupons"))[0].used, 1);
    await sql.query(
      "INSERT INTO coupons(id,code,kind,amount,usage_limit) VALUES('d','FREE','fixed',1,5)",
    );
    await sql.query("UPDATE wallet_accounts SET balance=0 WHERE user_id='b'");
    await assert.rejects(purchase(sql, "b", "p", "fail", { coupon: "FREE" }));
    assert.equal((await sql.query("SELECT used FROM coupons WHERE id='d'"))[0].used, 0);
  } finally {
    await db.close();
  }
});
test("gift races and retries do not duplicate credit; free product delivery charges zero", async () => {
  const { db, sql } = await setup();
  try {
    await sql.query(
      "INSERT INTO gift_codes(id,code_hash,label,reward,amount,usage_limit) VALUES('g',$1,'Gift','credit',25,1)",
      [giftHash("ABCDEF")],
    );
    const results = await Promise.allSettled([
      redeemGift(sql, "a", "ABCDEF", "key-a"),
      redeemGift(sql, "b", "ABCDEF", "key-b"),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const winner = results[0].status === "fulfilled" ? "a" : "b";
    const key = "key-" + winner;
    const retry = await redeemGift(sql, winner, "ABCDEF", key);
    assert.equal(retry.balance, 125);
    await assert.rejects(redeemGift(sql, winner, "ABCDEF", "new-key"));
    await sql.query(
      "INSERT INTO gift_codes(id,code_hash,label,reward,product_id,usage_limit) VALUES('p-gift',$1,'Product','product','p',2)",
      [giftHash("PRODUCT")],
    );
    const before = (await sql.query("SELECT balance FROM wallet_accounts WHERE user_id='a'"))[0]
      .balance;
    const gift = await redeemGift(sql, "a", "PRODUCT", "product-gift");
    assert.equal(gift.balance, before);
    assert.equal(
      (await sql.query("SELECT total FROM orders WHERE id=$1", [gift.orderId]))[0].total,
      0,
    );
  } finally {
    await db.close();
  }
});
test("manual review requires reference, credits once, rejects repeated transfer", async () => {
  const { db, sql } = await setup();
  try {
    await sql.query(
      "INSERT INTO payments(id,user_id,method,amount,fee,credit,status,provider) VALUES('x','a','truewallet',100,3,0,'pending','manual-review'),('y','b','truewallet',100,3,0,'pending','manual-review')",
    );
    await assert.rejects(reviewPayment(sql, "admin", "x", true, "", "no reference"));
    const r = await reviewPayment(sql, "admin", "x", true, "BANKREF", "verified transfer", 100);
    assert.equal(r.balance, 197);
    const replay = await reviewPayment(sql, "admin", "x", true, "BANKREF", "retry", 100);
    assert.equal(replay.balance, 197);
    await assert.rejects(reviewPayment(sql, "admin", "y", true, "BANKREF", "duplicate", 100));
    assert.equal(
      (await sql.query("SELECT balance FROM wallet_accounts WHERE user_id='b'"))[0].balance,
      100,
    );
  } finally {
    await db.close();
  }
});
test("claim ownership and manual encrypted replacement preserve buyer isolation and refund revokes access", async () => {
  const old = process.env.INVENTORY_ENCRYPTION_KEY;
  process.env.INVENTORY_ENCRYPTION_KEY = "ab".repeat(32);
  const { db, sql } = await setup();
  try {
    const order = await purchase(sql, "a", "p", "manual");
    await assert.rejects(createClaim(sql, "b", order.orderId, "wrong", "wrong owner"));
    const claim = await createClaim(sql, "a", order.orderId, "problem", "please check");
    assert.equal((await createClaim(sql, "a", order.orderId, "again", "repeated")).id, claim.id);
    await deliverOrder(sql, "admin", order.orderId, "first actual piece");
    assert.equal(await readOwnedDelivery(sql, "a", order.orderId), "first actual piece");
    assert.equal(await readOwnedDelivery(sql, "b", order.orderId), null);
    await deliverOrder(sql, "admin", order.orderId, "replacement", true);
    assert.equal(await readOwnedDelivery(sql, "a", order.orderId), "replacement");
    await refundOrder(sql, "admin", order.orderId, "refund");
    assert.equal(await readOwnedDelivery(sql, "a", order.orderId), null);
  } finally {
    await db.close();
    if (old === undefined) delete process.env.INVENTORY_ENCRYPTION_KEY;
    else process.env.INVENTORY_ENCRYPTION_KEY = old;
  }
});
test("database rate fence and job lease produce bounded attempts without duplicated notifications", async () => {
  const { db, sql } = await setup();
  try {
    await limit(sql, "test", 1);
    await assert.rejects(limit(sql, "test", 1));
    await enqueue(sql, "notification", { userId: "a", title: "hello" });
    await Promise.all([processJobs(sql), processJobs(sql)]);
    assert.equal(
      (await sql.query("SELECT count(*)::int AS n FROM notifications WHERE title='hello'"))[0].n,
      1,
    );
    assert.equal((await sql.query("SELECT status FROM jobs"))[0].status, "success");
    await sql.query("INSERT INTO jobs(id,kind,payload,attempts) VALUES('bad','unknown','{}',4)");
    await processJobs(sql);
    assert.equal(
      (await sql.query("SELECT status FROM jobs WHERE id='bad'"))[0].status,
      "dead_letter",
    );
  } finally {
    await db.close();
  }
});

test("encrypted backup restores real rows into an empty database and rejects tampering", async () => {
  const { snapshot, sealBackup, openBackup, restoreIntoEmpty } =
    await import("../src/lib/shop/backup-service.server.ts");
  process.env.BACKUP_ENCRYPTION_KEY = "42".repeat(32);
  const source = await setup();
  const target = new PGlite();
  try {
    for (const file of (await readdir(new URL("../migrations/", import.meta.url)))
      .filter((f) => /^\d.*\.sql$/.test(f))
      .sort())
      await target.exec(await readFile(new URL("../migrations/" + file, import.meta.url), "utf8"));
    const wrap = (client) => ({
      query: async (text, params = []) => (await client.query(text, params)).rows,
      transaction: (work) => target.transaction((tx) => work(wrap(tx))),
    });
    const value = await snapshot(source.sql);
    const encoded = sealBackup(value);
    assert.equal(encoded.includes(Buffer.from("a@example.test")), false);
    const opened = openBackup(encoded);
    await restoreIntoEmpty(wrap(target), opened);
    assert.equal(
      (await target.query("SELECT balance FROM wallet_accounts WHERE user_id=$1", ["a"])).rows[0]
        .balance,
      100,
    );
    assert.equal((await target.query('SELECT count(*)::int n FROM "user"')).rows[0].n, 2);
    await assert.rejects(restoreIntoEmpty(wrap(target), opened), /ฐานข้อมูลว่าง/);
    encoded[encoded.length - 1] ^= 1;
    assert.throws(() => openBackup(encoded), /ไฟล์สำรอง/);
  } finally {
    await source.db.close();
    await target.close();
  }
});

test("server reward is idempotent and enforces daily allowance with ledger accounting", async () => {
  const { playReward } = await import("../src/lib/shop/rewards-service.server.ts");
  const { db, sql } = await setup();
  try {
    await sql.query(
      "INSERT INTO reward_campaigns(id,title,cost,daily_limit,active,prizes) VALUES($1,$2,10,1,true,$3)",
      [
        "wheel",
        "Wheel",
        JSON.stringify([
          { label: "A", weight: 1, credit: 5 },
          { label: "B", weight: 1, credit: 5 },
        ]),
      ],
    );
    const first = await playReward(sql, "a", "wheel", "retry");
    assert.equal(first.balance, 95);
    assert.equal(first.reward, 5);
    assert.deepEqual(await playReward(sql, "a", "wheel", "retry"), first);
    await assert.rejects(playReward(sql, "a", "wheel", "new"), /วันนี้ครบ/);
    assert.equal((await sql.query("SELECT count(*)::int n FROM reward_plays"))[0].n, 1);
    assert.equal(
      (await sql.query("SELECT sum(amount)::int amount FROM wallet_ledger"))[0].amount,
      -5,
    );
    await assert.rejects(playReward(sql, "b", "box", "disabled"), /ตั้งค่า/);
  } finally {
    await db.close();
  }
});

test("central media validates actual format and strips metadata while resizing", async () => {
  const sharp = (await import("sharp")).default;
  const { storeMedia } = await import("../src/lib/shop/media-service.server.ts");
  const { db, sql } = await setup();
  try {
    const image = await sharp({
      create: { width: 30, height: 20, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer();
    await assert.rejects(
      storeMedia(
        sql,
        "a",
        "product",
        "data:image/jpeg;base64," + image.toString("base64"),
        "wrong.jpg",
      ),
      /ชนิดไฟล์/,
    );
    await assert.rejects(
      storeMedia(sql, "a", "product", "data:image/svg+xml;base64,AAAA", "x.svg"),
      /PNG/,
    );
    const result = await storeMedia(
      sql,
      "a",
      "product",
      "data:image/png;base64," + image.toString("base64"),
      "valid.png",
    );
    const row = (
      await sql.query("SELECT bytes,thumbnail FROM media_assets WHERE id=$1", [result.id])
    )[0];
    const meta = await sharp(row.bytes).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.width, 800);
    assert.equal(meta.height, 800);
    assert.equal(meta.exif, undefined);
    assert.ok(row.thumbnail.length > 0);
  } finally {
    await db.close();
  }
});

test("batch import rejects an entire invalid or duplicate batch and retries once", async () => {
  const { importRecords, validateImport } =
    await import("../src/lib/shop/import-service.server.ts");
  const { db, sql } = await setup();
  const product = {
    id: "import-p",
    name: "Imported",
    subtitle: "",
    category: "test",
    price: 10,
    stock: 0,
    image: "",
    delivery: "text",
  };
  try {
    assert.throws(
      () => validateImport("products", [product, { ...product, name: "" }]),
      /รายการ 2/,
    );
    await assert.rejects(
      importRecords(sql, "a", "products", [product, { ...product, id: "p" }], "bad"),
      /ซ้ำ/,
    );
    assert.equal((await sql.query("SELECT 1 FROM products WHERE id=$1", ["import-p"])).length, 0);
    const first = await importRecords(sql, "a", "products", [product], "retry");
    assert.deepEqual(await importRecords(sql, "a", "products", [product], "retry"), first);
    assert.equal(
      (await sql.query("SELECT count(*)::int n FROM products WHERE id=$1", ["import-p"]))[0].n,
      1,
    );
    const gift = {
      code: "SECRET-IMPORT-491827",
      label: "Gift",
      reward: "credit",
      amount: 5,
      productId: null,
      usageLimit: 1,
      expiresAt: null,
      active: true,
    };
    await assert.rejects(importRecords(sql, "a", "gifts", [gift, gift], "duplicate"), /ซ้ำ/);
    assert.equal((await sql.query("SELECT count(*)::int n FROM gift_codes"))[0].n, 0);
    await importRecords(sql, "a", "gifts", [gift], "gift-key");
    const row = (await sql.query("SELECT code_hash FROM gift_codes"))[0];
    assert.notEqual(row.code_hash, gift.code);
  } finally {
    await db.close();
  }
});
