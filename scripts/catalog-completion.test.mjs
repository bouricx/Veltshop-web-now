import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { selectProducts, contrastText } from "../src/lib/shop/presentation.ts";
import { dashboardRange, dashboardRangeSchema } from "../src/lib/shop/dashboard-range.ts";
import { productInputSchema } from "../src/lib/shop/validation.ts";
import { redeemGift, giftHash } from "../src/lib/shop/operations-service.server.ts";

test("catalog searches all words across category, description and id; sort never mutates source", () => {
  const products = [
    {
      id: "SKU-1",
      name: "Alpha",
      subtitle: "",
      category: "game",
      description: "คู่มือภาษาไทย",
      price: 60,
      stock: 0,
    },
    { id: "SKU-2", name: "Beta", subtitle: "", category: "game", price: 20, stock: 2 },
    { id: "SKU-3", name: "Gamma", category: "hidden", price: 10, stock: 5 },
  ];
  const base = {
    category: "all",
    query: "",
    sort: "price-asc",
    inStock: false,
    categories: [{ id: "game", label: "เกม" }],
  };
  assert.deepEqual(
    selectProducts(products, base).map((p) => p.id),
    ["SKU-2", "SKU-1"],
  );
  assert.equal(products[0].id, "SKU-1");
  assert.deepEqual(
    selectProducts(products, { ...base, query: "เกม คู่มือ sku-1" }).map((p) => p.id),
    ["SKU-1"],
  );
  assert.deepEqual(
    selectProducts(products, { ...base, inStock: true }).map((p) => p.id),
    ["SKU-2"],
  );
  assert.equal(selectProducts(products, { ...base, query: "not-found" }).length, 0);
});
test("product palette selects a foreground with at least WCAG AA text contrast", () => {
  const lum = (hex) => {
    const v = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  for (const hex of [
    "#ffffff",
    "#000000",
    "#dc2626",
    "#7c3aed",
    "#2563eb",
    "#059669",
    "#d97706",
    "#db2777",
    "#777777",
  ]) {
    const a = lum(hex),
      b = lum(contrastText(hex));
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, hex);
  }
});
test("presentation fields reject CSS injection and retain descriptive data", () => {
  const base = {
    name: "Product",
    subtitle: "",
    category: "game",
    price: 10,
    stock: 1,
    image: "/image.webp",
    delivery: "code",
  };
  assert.throws(() =>
    productInputSchema.parse({ ...base, accentColor: "red;background:url(https://bad.test)" }),
  );
  assert.throws(() => productInputSchema.parse({ ...base, borderColor: "#abc" }));
  const parsed = productInputSchema.parse({
    ...base,
    accentColor: "#ffffff",
    description: "Details",
    icon: "🎮",
  });
  assert.equal(parsed.description, "Details");
});
test("dashboard dates use Thai midnight, inclusive final day and real calendar dates", () => {
  const now = new Date("2026-10-10T18:00:00Z");
  assert.equal(
    dashboardRange(dashboardRangeSchema.parse({ period: "today" }), now).from,
    "2026-10-10T17:00:00.000Z",
  );
  assert.equal(
    dashboardRange(dashboardRangeSchema.parse({ period: "month" }), now).from,
    "2026-09-30T17:00:00.000Z",
  );
  assert.deepEqual(
    dashboardRange(
      dashboardRangeSchema.parse({ period: "custom", from: "2026-10-01", to: "2026-10-10" }),
      now,
    ),
    { from: "2026-09-30T17:00:00.000Z", to: "2026-10-10T17:00:00.000Z" },
  );
  assert.equal(dashboardRange(dashboardRangeSchema.parse({ period: "all" }), now).from, null);
  assert.throws(() =>
    dashboardRangeSchema.parse({ period: "custom", from: "2026-02-30", to: "2026-03-01" }),
  );
  assert.throws(() =>
    dashboardRangeSchema.parse({ period: "custom", from: "2026-10-11", to: "2026-10-10" }),
  );
});
test("category gift enforces chosen category, rejects changed retries and grants one free order", async () => {
  const db = new PGlite();
  for (const f of (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((f) => /^\d.*\.sql$/.test(f))
    .sort())
    await db.exec(await readFile(new URL("../migrations/" + f, import.meta.url), "utf8"));
  const wrap = (client) => ({
    query: async (text, params = []) => (await client.query(text, params)).rows,
    transaction: (work) => db.transaction((tx) => work(wrap(tx))),
  });
  const sql = wrap(db);
  try {
    await db.exec(
      `INSERT INTO "user"(id,name,email,"emailVerified","updatedAt") VALUES('a','A','a@gift.test',true,now());INSERT INTO categories(id,label) VALUES('game','Game'),('other','Other');INSERT INTO products(id,name,category_id,price,stock) VALUES('p','P','game',60,1),('q','Q','game',40,1),('x','X','other',10,1);`,
    );
    await sql.query(
      "INSERT INTO gift_codes(id,code_hash,label,reward,amount,category_id,usage_limit) VALUES('g',$1,'Gift','product',0,'game',1)",
      [giftHash("CATEGORY-GIFT")],
    );
    await assert.rejects(redeemGift(sql, "a", "CATEGORY-GIFT", "choose-1", "x"));
    await assert.rejects(redeemGift(sql, "a", "CATEGORY-GIFT", "choose-1"));
    assert.equal((await sql.query("SELECT used FROM gift_codes"))[0].used, 0);
    const result = await redeemGift(sql, "a", "CATEGORY-GIFT", "choose-1", "p");
    assert.equal(result.balance, 0);
    assert.equal((await sql.query("SELECT total FROM orders"))[0].total, 0);
    assert.deepEqual(await redeemGift(sql, "a", "CATEGORY-GIFT", "choose-1", "p"), result);
    await assert.rejects(redeemGift(sql, "a", "CATEGORY-GIFT", "choose-1", "q"));
    assert.equal((await sql.query("SELECT count(*)::int AS n FROM orders"))[0].n, 1);
    assert.equal((await sql.query("SELECT stock FROM products WHERE id='p'"))[0].stock, 0);
    await assert.rejects(sql.query("UPDATE products SET badge_color='invalid' WHERE id='p'"));
    await assert.rejects(sql.query("UPDATE gift_codes SET product_id='p' WHERE id='g'"));
  } finally {
    await db.close();
  }
});

test("admin event triggers are commit-bound and restore does not replay historical alerts", async () => {
  const db = new PGlite();
  for (const f of (await readdir(new URL("../migrations/", import.meta.url)))
    .filter((f) => /^\d.*\.sql$/.test(f))
    .sort())
    await db.exec(await readFile(new URL("../migrations/" + f, import.meta.url), "utf8"));
  const wrap = (client) => ({
    query: async (text, params = []) => (await client.query(text, params)).rows,
    transaction: (work) => db.transaction((tx) => work(wrap(tx))),
  });
  const sql = wrap(db);
  try {
    await db.exec(
      `INSERT INTO "user"(id,name,email,"emailVerified","updatedAt") VALUES('n','N','n@notification.test',true,now());INSERT INTO categories(id,label) VALUES('g','G');INSERT INTO products(id,name,category_id,price,stock) VALUES('p','P','g',10,6);UPDATE products SET stock=5 WHERE id='p';UPDATE products SET stock=4 WHERE id='p';`,
    );
    assert.equal(
      (await sql.query("SELECT count(*)::int AS n FROM admin_events WHERE kind='stock.low'"))[0].n,
      1,
    );
    const before = (await sql.query("SELECT count(*)::int AS n FROM admin_events"))[0].n;
    await assert.rejects(
      sql.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO "user"(id,name,email,"emailVerified","updatedAt") VALUES('rollback','N','rollback@notification.test',true,now())`,
        );
        throw Error("rollback");
      }),
    );
    assert.equal((await sql.query("SELECT count(*)::int AS n FROM admin_events"))[0].n, before);
    const { snapshot, restoreIntoEmpty } = await import("../src/lib/shop/backup-service.server.ts");
    const backup = await snapshot(sql);
    const target = new PGlite();
    try {
      for (const f of (await readdir(new URL("../migrations/", import.meta.url)))
        .filter((f) => /^\d.*\.sql$/.test(f))
        .sort())
        await target.exec(await readFile(new URL("../migrations/" + f, import.meta.url), "utf8"));
      const targetWrap = (client) => ({
        query: async (text, params = []) => (await client.query(text, params)).rows,
        transaction: (work) => target.transaction((tx) => work(targetWrap(tx))),
      });
      await restoreIntoEmpty(targetWrap(target), backup);
      assert.equal(
        (await target.query("SELECT count(*)::int AS n FROM admin_events")).rows[0].n,
        before,
      );
    } finally {
      await target.close();
    }
  } finally {
    await db.close();
  }
});
test("image policy honors icon/profile/logo sizes and format constraints", async () => {
  const { configurationSchema } = await import("../src/lib/shop/settings-schema.ts");
  const { imageTarget, allowedImageFormats } = await import("../src/lib/shop/image-policy.ts");
  const settings = configurationSchema.parse({
    imageFormats: "png,jpeg",
    imageIcon: 512,
    imageThumbnail: 128,
  });
  assert.deepEqual(imageTarget("icon", settings), { width: 512, height: 512 });
  assert.deepEqual(imageTarget("banner", settings), { width: 1920, height: 600 });
  assert.deepEqual(imageTarget("logo", settings), { width: 500, height: 150 });
  assert.deepEqual(allowedImageFormats(settings), ["png", "jpeg"]);
  assert.throws(() => configurationSchema.parse({ imageFormats: "svg,png" }));
  assert.throws(() => configurationSchema.parse({ imageThumbnail: 10000 }));
});
