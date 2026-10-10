import { PGlite } from "@electric-sql/pglite";
import { restoreIntoEmpty, backupTables, type Snapshot } from "./backup-service.server";
import type { Sql } from "../db";
export async function verifyRestoration(value: Snapshot) {
  const db = new PGlite();
  try {
    const migrations = import.meta.glob("../../../migrations/*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    for (const name of Object.keys(migrations).sort()) await db.exec(migrations[name]);
    const wrap = (client: Pick<PGlite, "query">) => ({
      query: async <T>(text: string, params: unknown[] = []) =>
        (await client.query<T>(text, params)).rows,
      transaction: async <T>(work: (sql: Sql) => Promise<T>) =>
        db.transaction((tx) => work(wrap(tx) as Sql)),
    });
    await restoreIntoEmpty(wrap(db) as Sql, value);
    for (const table of backupTables) {
      const result = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}"`);
      if (result.rows[0].n !== (value.tables[table]?.length ?? 0))
        throw new Error("Restore count mismatch");
    }
    return { tables: backupTables.length, verified: true };
  } finally {
    await db.close();
  }
}
