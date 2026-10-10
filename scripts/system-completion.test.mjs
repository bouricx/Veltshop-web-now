import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { addPrivateFile, downloadOwnedFile } from "../src/lib/shop/private-files-service.server.ts";
import {
  exportPersonalData,
  requestDeletion,
  reviewDeletion,
} from "../src/lib/shop/privacy-service.server.ts";
import { authorizedCron, runSystemMaintenance } from "../src/lib/shop/system-runner.server.ts";
import { purchase } from "../src/lib/shop/commerce.server.ts";
import { refundOrder } from "../src/lib/shop/operations-service.server.ts";
import { createBackup, snapshot, restoreIntoEmpty } from "../src/lib/shop/backup-service.server.ts";
const key = "a".repeat(64);
async function setup(seed = true) {
  const db = new PGlite();
  for (const f of (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((f) => /^\d.*\.sql$/.test(f))
    .sort())
    await db.exec(await readFile(new URL("../migrations/" + f, import.meta.url), "utf8"));
  const wrap = (client) => ({
    query: async (text, params = []) => (await client.query(text, params)).rows,
    transaction: (work) => db.transaction((tx) => work(wrap(tx))),
  });
  if (seed)
    await db.exec(
      `INSERT INTO "user"(id,name,email,"emailVerified","updatedAt") VALUES('a','Alice','a@example.test',true,now()),('b','Bob','b@example.test',true,now());INSERT INTO categories(id,label) VALUES('test','Test');INSERT INTO products(id,name,category_id,price,stock) VALUES('p','Private file','test',60,0);INSERT INTO wallet_accounts(user_id,balance) VALUES('a',100),('b',0);`,
    );
  return { db, sql: wrap(db) };
}
test("private file retry, encryption, buyer isolation and refunded download revocation", async () => {
  process.env.INVENTORY_ENCRYPTION_KEY = key;
  const { db, sql } = await setup();
  try {
    const id = "d75e4d62-c0d5-4ac2-80e6-b13ef2d47dd0",
      input = {
        id,
        productId: "p",
        name: "guide.txt",
        encoded: Buffer.from("secret customer file").toString("base64"),
      };
    await addPrivateFile(sql, "admin", input);
    await addPrivateFile(sql, "admin", input);
    assert.equal((await sql.query("SELECT count(*)::int AS n FROM inventory_items"))[0].n, 1);
    assert.equal(
      (await sql.query("SELECT ciphertext FROM private_files"))[0].ciphertext.includes("secret"),
      false,
    );
    assert.equal(await downloadOwnedFile(sql, "a", id), null);
    const order = await purchase(sql, "a", "p", "file-order");
    assert.equal((await downloadOwnedFile(sql, "a", id)).bytes.toString(), "secret customer file");
    assert.equal(await downloadOwnedFile(sql, "b", id), null);
    await assert.rejects(
      addPrivateFile(sql, "admin", {
        ...input,
        encoded: Buffer.from("changed").toString("base64"),
      }),
    );
    await refundOrder(sql, "admin", order.orderId, "refund file");
    assert.equal(await downloadOwnedFile(sql, "a", id), null);
    await assert.rejects(
      addPrivateFile(sql, "admin", {
        ...input,
        id: "d75e4d62-c0d5-4ac2-80e6-b13ef2d47dd1",
        name: "fake.pdf",
      }),
    );
  } finally {
    await db.close();
  }
});
test("data export omits credentials and privacy approval preserves financial history", async () => {
  const { db, sql } = await setup();
  try {
    await sql.query(
      'INSERT INTO account(id,"accountId","providerId","userId",password,"updatedAt") VALUES($1,$2,$3,$4,$5,now())',
      ["credential-b", "b", "credential", "b", "SECRET_HASH"],
    );
    const data = await exportPersonalData(sql, "b");
    assert.equal(data.data.profile[0].email, "b@example.test");
    assert.equal(JSON.stringify(data).includes("SECRET_HASH"), false);
    assert.equal(JSON.stringify(data).includes("a@example.test"), false);
    const r = await requestDeletion(sql, "b", "delete account");
    const again = await requestDeletion(sql, "b", "retry delete");
    assert.equal(r.id, again.id);
    await reviewDeletion(sql, "admin", r.id, true, "owner confirmed");
    assert.equal(
      (await sql.query("SELECT disabled FROM member_profiles WHERE user_id='b'"))[0].disabled,
      true,
    );
    assert.equal(
      (await sql.query("SELECT count(*)::int AS n FROM account WHERE \"userId\"='b'"))[0].n,
      0,
    );
    const money = await requestDeletion(sql, "a", "delete account");
    await assert.rejects(reviewDeletion(sql, "admin", money.id, true, "reviewed deletion"));
    assert.equal(
      (await sql.query("SELECT email FROM \"user\" WHERE id='a'"))[0].email,
      "a@example.test",
    );
  } finally {
    await db.close();
  }
});
test("root account deletion is denied and rejection creates an owner notification", async () => {
  const { db, sql } = await setup();
  try {
    await sql.query("INSERT INTO user_roles(user_id,role_id) VALUES('b','super_admin')");
    const r = await requestDeletion(sql, "b", "close account");
    await assert.rejects(reviewDeletion(sql, "admin", r.id, true, "reviewed request"));
    await reviewDeletion(sql, "admin", r.id, false, "remove administrator access first");
    assert.equal(
      (await sql.query("SELECT count(*)::int AS n FROM notifications WHERE user_id='b'"))[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
test("cron rejects missing/wrong secrets, logs execution and only prunes configured nonfinancial data", async () => {
  const secret = "s".repeat(40);
  assert.equal(authorizedCron(null, secret), false);
  assert.equal(authorizedCron("Bearer " + "x".repeat(40), secret), false);
  assert.equal(authorizedCron("Bearer " + secret, secret), true);
  assert.equal(authorizedCron("Bearer short", "short"), false);
  delete process.env.BACKUP_EVERY_HOURS;
  const { db, sql } = await setup();
  try {
    await sql.query(
      "INSERT INTO notifications(id,user_id,title,read_at,created_at) VALUES('old','a','old',now(),now()-interval '100 days'),('unread','a','unread',NULL,now()-interval '100 days')",
    );
    await runSystemMaintenance(sql);
    assert.equal((await sql.query("SELECT count(*)::int AS n FROM notifications"))[0].n, 2);
    await sql.query("UPDATE site_configuration SET value='{\"notificationRetentionDays\":30}'");
    await runSystemMaintenance(sql);
    assert.equal((await sql.query("SELECT id FROM notifications"))[0].id, "unread");
    assert.equal(
      (await sql.query("SELECT count(*)::int AS n FROM system_runs WHERE status='success'"))[0].n,
      2,
    );
    const rev = (
      await sql.query("SELECT count(*)::int AS n FROM realtime_revisions WHERE scope='public'")
    )[0].n;
    await sql.query("BEGIN");
    await sql.query("UPDATE products SET price=70 WHERE id='p'");
    await sql.query("ROLLBACK");
    assert.equal(
      (await sql.query("SELECT count(*)::int AS n FROM realtime_revisions WHERE scope='public'"))[0]
        .n,
      rev,
    );
  } finally {
    await db.close();
  }
});
test("backup job writes snapshot and completes lease atomically; stale runner cannot write", async () => {
  process.env.BACKUP_ENCRYPTION_KEY = "b".repeat(64);
  const { db, sql } = await setup();
  try {
    await sql.query(
      "INSERT INTO jobs(id,kind,status,lease_token,lease_until) VALUES('backup-job','backup','processing','current',now()+interval '1 minute')",
    );
    await assert.rejects(createBackup(sql, "scheduler", { id: "backup-job", token: "stale" }));
    assert.equal((await sql.query("SELECT count(*)::int AS n FROM backup_records"))[0].n, 0);
    await createBackup(sql, "scheduler", { id: "backup-job", token: "current" });
    assert.equal(
      (await sql.query("SELECT status FROM jobs WHERE id='backup-job'"))[0].status,
      "success",
    );
    const value = await snapshot(sql);
    assert.equal(value.migration, "0012");
    assert.ok(value.tables.private_files);
    assert.ok(value.tables.privacy_requests);
  } finally {
    await db.close();
  }
});

test("private files and privacy requests restore into an isolated empty database", async () => {
  process.env.INVENTORY_ENCRYPTION_KEY = key;
  const source = await setup(),
    target = await setup(false);
  try {
    const id = "d75e4d62-c0d5-4ac2-80e6-b13ef2d47dd2";
    await addPrivateFile(source.sql, "admin", {
      id,
      productId: "p",
      name: "restore.txt",
      encoded: Buffer.from("restore payload").toString("base64"),
    });
    await requestDeletion(source.sql, "b", "test restore");
    const order = await purchase(source.sql, "a", "p", "restore-file");
    await restoreIntoEmpty(target.sql, await snapshot(source.sql));
    assert.equal(
      (await downloadOwnedFile(target.sql, "a", id)).bytes.toString(),
      "restore payload",
    );
    assert.equal(
      (await target.sql.query("SELECT count(*)::int AS n FROM privacy_requests"))[0].n,
      1,
    );
    assert.equal((await target.sql.query("SELECT id FROM orders"))[0].id, order.orderId);
  } finally {
    await source.db.close();
    await target.db.close();
  }
});
