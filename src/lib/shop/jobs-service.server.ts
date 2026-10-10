import { randomUUID } from "node:crypto";
import type { Sql } from "../db";
import { notify } from "./operations-service.server.ts";
import { creditVerifiedSlip } from "./commerce.server.ts";
export async function enqueue(
  sql: Sql,
  kind: "notification" | "payment_reconcile" | "backup",
  payload: Record<string, string | number>,
) {
  const id = randomUUID();
  await sql.query("INSERT INTO jobs(id,kind,payload) VALUES($1,$2,$3)", [
    id,
    kind,
    JSON.stringify(payload),
  ]);
  return id;
}
export async function processJobs(sql: Sql, max = 10) {
  let processed = 0;
  for (let n = 0; n < max; n++) {
    const token = randomUUID();
    const item = await sql.transaction(async (tx) => {
      const [row] = await tx.query<{
        id: string;
        kind: string;
        payload: Record<string, string | number>;
        attempts: number;
      }>(
        "SELECT id,kind,payload,attempts FROM jobs WHERE ((status IN ('pending','retry') AND available_at<=now()) OR (status='processing' AND lease_until<now())) ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1",
      );
      if (!row) return null;
      await tx.query(
        "UPDATE jobs SET status='processing',attempts=attempts+1,lease_until=now()+interval '60 seconds',lease_token=$2,updated_at=now() WHERE id=$1",
        [row.id, token],
      );
      return { ...row, attempts: row.attempts + 1 };
    });
    if (!item) break;
    try {
      if (item.kind === "backup") {
        const { createBackup } = await import("./backup-service.server.ts");
        await createBackup(sql, String(item.payload.actorId ?? "scheduler"));
        await sql.query(
          "UPDATE jobs SET status='success',lease_until=NULL,lease_token=NULL WHERE id=$1 AND lease_token=$2",
          [item.id, token],
        );
        processed++;
        continue;
      }
      // Each effect and job completion share one transaction guarded by the lease.
      await sql.transaction(async (tx) => {
        const [lease] = await tx.query(
          "SELECT id FROM jobs WHERE id=$1 AND lease_token=$2 AND status='processing' FOR UPDATE",
          [item.id, token],
        );
        if (!lease) return;
        if (item.kind === "notification")
          await notify(
            tx,
            String(item.payload.userId),
            String(item.payload.title),
            String(item.payload.body ?? ""),
          );
        else if (item.kind === "payment_reconcile") {
          const [proof] = await tx.query<{
            payment_id: string;
            user_id: string;
            amount: number;
            fee: number;
            credit: number;
            hash: string;
            reference: string;
          }>(
            "SELECT v.* FROM payment_verifications v JOIN payments p ON p.id=v.payment_id WHERE v.payment_id=$1 AND p.status IN ('pending','reconciliation_required')",
            [item.payload.paymentId],
          );
          if (proof) {
            const adapter = Object.assign(tx, {
              transaction: async <T>(work: (tx: Sql) => Promise<T>) => work(tx),
            });
            await creditVerifiedSlip(adapter, {
              id: proof.payment_id,
              userId: proof.user_id,
              amount: proof.amount,
              fee: proof.fee,
              credit: proof.credit,
              hash: proof.hash,
              reference: proof.reference,
              provider: "slip2go",
            });
          }
        } else if (item.kind === "backup") {
          throw new Error("backup requires dedicated runner");
        } else throw new Error("unsupported job");
        await tx.query(
          "UPDATE jobs SET status='success',lease_until=NULL,lease_token=NULL,last_error=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2",
          [item.id, token],
        );
      });
    } catch {
      await sql.query(
        "UPDATE jobs SET status=$3,last_error='ประมวลผลไม่สำเร็จ',available_at=now()+$4*interval '1 second',lease_until=NULL,lease_token=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2",
        [
          item.id,
          token,
          item.attempts >= 5 ? "dead_letter" : "retry",
          Math.min(3600, 30 * 2 ** item.attempts),
        ],
      );
    }
    processed++;
  }
  return { processed };
}
export async function scheduleBackup(sql: Sql) {
  const hours = Number(process.env.BACKUP_EVERY_HOURS);
  if (!Number.isFinite(hours) || hours < 1 || !process.env.BACKUP_ENCRYPTION_KEY) return;
  await sql.transaction(async (tx) => {
    await tx.query("SELECT id FROM site_configuration WHERE id=1 FOR UPDATE");
    const [row] = await tx.query<{ needed: boolean }>(
      "SELECT NOT EXISTS(SELECT 1 FROM backup_records WHERE created_at>now()-$1*interval '1 hour') AND NOT EXISTS(SELECT 1 FROM jobs WHERE kind='backup' AND status IN ('pending','processing','retry')) AS needed",
      [hours],
    );
    if (row.needed) await enqueue(tx, "backup", { actorId: "scheduler" });
  });
}
