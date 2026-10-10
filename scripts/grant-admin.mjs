// Operator-only bootstrap for an existing native account. No HTTP route or password bypass.
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
const email = process.argv[2]?.trim().toLowerCase();
if (!process.env.DATABASE_URL || !email || process.argv[3] !== "--grant-existing-account")
  throw new Error(
    "Use DATABASE_URL and: node scripts/grant-admin.mjs EMAIL --grant-existing-account",
  );
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const role = await client.query("SELECT id FROM roles WHERE id='super_admin' FOR UPDATE");
  if (!role.rowCount) throw new Error("Run database migrations first");
  const users = await client.query('SELECT id FROM "user" WHERE lower(email)=$1 FOR UPDATE', [
    email,
  ]);
  if (users.rowCount !== 1) throw new Error("Exactly one existing account is required");
  const id = users.rows[0].id;
  await client.query(
    "INSERT INTO user_roles(user_id,role_id) VALUES($1,'super_admin') ON CONFLICT DO NOTHING",
    [id],
  );
  await client.query(
    "INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'roles.bootstrap','user',$2,$3)",
    [randomUUID(), id, JSON.stringify({ role: "super_admin", source: "database-operator-cli" })],
  );
  await client.query("COMMIT");
  console.log("Existing account granted super_admin. Sign in through the normal login flow.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
