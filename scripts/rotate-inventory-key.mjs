// Offline, transactional rotation. Pause the site and workers first. This script
// prints only counts; update hosting's INVENTORY_ENCRYPTION_KEY after it succeeds.
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { encryptInventory, decryptInventory } from "../src/lib/shop/inventory-crypto.server.ts";
const oldKey = process.env.INVENTORY_ENCRYPTION_KEY,
  nextKey = process.env.NEXT_INVENTORY_ENCRYPTION_KEY;
if (
  process.argv[2] !== "--rotate" ||
  !process.env.DATABASE_URL ||
  !/^[a-f\d]{64}$/i.test(oldKey ?? "") ||
  !/^[a-f\d]{64}$/i.test(nextKey ?? "") ||
  oldKey === nextKey
)
  throw new Error(
    "Set DATABASE_URL and distinct valid INVENTORY_ENCRYPTION_KEY / NEXT_INVENTORY_ENCRYPTION_KEY; pass --rotate",
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
let count = 0;
try {
  await client.query("BEGIN");
  await client.query(
    "LOCK TABLE products,inventory_items,order_deliveries,payments,site_configuration IN EXCLUSIVE MODE",
  );
  const config = (await client.query("SELECT value FROM site_configuration WHERE id=1")).rows[0]
    ?.value;
  if (config?.maintenance !== true)
    throw new Error("Enable maintenance and pause workers before key rotation");
  for (const [table, column, aad] of [
    ["inventory_items", "payload_ciphertext", "product_id"],
    ["order_deliveries", "payload_ciphertext", "product_id"],
    ["payments", "gift_ciphertext", null],
  ]) {
    const rows = (
      await client.query(
        `SELECT id,${column}${aad ? "," + aad : ""} FROM ${table} WHERE ${column} IS NOT NULL`,
      )
    ).rows;
    for (const row of rows) {
      const binding = aad ? row[aad] : "gift:" + row.id;
      process.env.INVENTORY_ENCRYPTION_KEY = oldKey;
      const plain = decryptInventory(binding, row[column]);
      process.env.INVENTORY_ENCRYPTION_KEY = nextKey;
      const encrypted = encryptInventory(binding, plain);
      if (table === "inventory_items")
        await client.query(
          "UPDATE inventory_items SET payload_ciphertext=$2,payload_fingerprint=$3 WHERE id=$1",
          [row.id, encrypted.ciphertext, encrypted.fingerprint],
        );
      else
        await client.query(`UPDATE ${table} SET ${column}=$2 WHERE id=$1`, [
          row.id,
          encrypted.ciphertext,
        ]);
      count++;
    }
  }
  await client.query(
    "INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,'offline-operator','inventory.key-rotated','system','inventory',$2)",
    [randomUUID(), JSON.stringify({ count })],
  );
  await client.query("COMMIT");
  console.log(
    JSON.stringify({
      rotated: count,
      next: "Update hosting key before resuming traffic; preserve old key for old backups",
    }),
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  process.env.INVENTORY_ENCRYPTION_KEY = oldKey;
  client.release();
  await pool.end();
}
