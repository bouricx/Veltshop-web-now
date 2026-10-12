import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
test("public feed uses actual masked buyers and only completed paid purchases", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,name text); CREATE TABLE orders(id text PRIMARY KEY,user_id text,status text,updated_at timestamptz); CREATE TABLE order_items(id text,order_id text,product_name text); CREATE TABLE cart_requests(id text PRIMARY KEY,user_id text,status text,items jsonb,delivered_at timestamptz); CREATE TABLE cart_request_payments(cart_request_id text,status text);
 INSERT INTO "user" VALUES('u','สมชาย'),('v','private@example.com'); INSERT INTO orders VALUES('o','u','completed',now()),('pending','u','pending',now()); INSERT INTO order_items VALUES('1','o','Netflix'),('2','o','Spotify'),('3','pending','Hidden'); INSERT INTO cart_requests VALUES('c','v','done','[{"name":"Disney"}]',now()),('unpaid','u','done','[{"name":"Hidden"}]',now()); INSERT INTO cart_request_payments VALUES('c','paid'),('unpaid','pending');`);
    const source = readFileSync(new URL("../src/lib/shop/storefront.ts", import.meta.url), "utf8");
    const query = source
      .match(/`SELECT id,product,buyer,created_at::text[\s\S]*?LIMIT 7`/)[0]
      .slice(1, -1);
    const { rows } = await db.query(query);
    assert.equal(rows.length, 2);
    assert.equal(rows.find((x) => x.id === "order:o").product, "Netflix, Spotify");
    assert.equal(rows.find((x) => x.id === "order:o").buyer, "สม***");
    assert.equal(rows.find((x) => x.id === "cart:c").buyer, "สมาชิก");
    assert.ok(rows.every((x) => !x.product.includes("Hidden") && !x.buyer.includes("@")));
  } finally {
    await db.close();
  }
});
