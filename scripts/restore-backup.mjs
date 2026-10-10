// Restore an authenticated encrypted snapshot only into a separately initialized,
// empty recovery database. Never clear or overwrite the running shop database.
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { openBackup, restoreIntoEmpty } from "../src/lib/shop/backup-service.server.ts";
const file = process.argv[2];
const target = process.env.RESTORE_DATABASE_URL;
if (!file || !target || target === process.env.DATABASE_URL)
  throw new Error("Provide a backup file and a separate RESTORE_DATABASE_URL");
const value = openBackup(await readFile(file));
const pool = new Pool({ connectionString: target });
const wrap = (client) => ({
  query: async (text, params = []) => (await client.query(text, params)).rows,
  transaction: async (work) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(wrap(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
});
try {
  const restored = await restoreIntoEmpty(wrap(pool), value);
  console.log(JSON.stringify({ restored }));
} finally {
  await pool.end();
}
