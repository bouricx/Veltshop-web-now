import { randomUUID } from "node:crypto";
import type { Sql } from "../db";
import { audit, notify } from "./operations-service.server.ts";
import { CommerceError } from "./commerce.server.ts";

export async function exportPersonalData(sql: Sql, userId: string) {
  const queries: Record<string, string> = {
    profile: 'SELECT id,name,email,image,"emailVerified","createdAt" FROM "user" WHERE id=$1',
    membership: "SELECT rank,rank_color,disabled FROM member_profiles WHERE user_id=$1",
    wallet: "SELECT balance FROM wallet_accounts WHERE user_id=$1",
    orders:
      "SELECT id,status,total,subtotal,created_at,warranty_end FROM orders WHERE user_id=$1 ORDER BY created_at,id",
    payments:
      "SELECT id,method,amount,fee,credit,status,provider,provider_reference,created_at FROM payments WHERE user_id=$1 ORDER BY created_at,id",
    ledger:
      "SELECT id,reason,amount,(balance_after-amount) AS balance_before,balance_after,order_id,payment_id,created_at FROM wallet_ledger WHERE user_id=$1 ORDER BY created_at,id",
    claims:
      "SELECT id,order_id,title,message,status,reply,created_at FROM claims WHERE user_id=$1 ORDER BY created_at,id",
    notifications:
      "SELECT id,title,body,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at,id",
    loginHistory:
      "SELECT event,ip_address,user_agent,created_at FROM login_history WHERE user_id=$1 ORDER BY created_at,id",
    privacyRequests:
      "SELECT id,kind,status,reason,reply,created_at,reviewed_at FROM privacy_requests WHERE user_id=$1 ORDER BY created_at,id",
  };
  return sql.transaction(async (tx) => {
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    const data: Record<string, unknown[]> = {};
    // Refuse incomplete exports, rather than silently truncating a customer's data.
    for (const [key, query] of Object.entries(queries)) {
      const rows = await tx.query(query + " LIMIT 10001", [userId]);
      if (rows.length > 10000)
        throw new CommerceError("ข้อมูลมีจำนวนมาก กรุณาติดต่อทีมงานเพื่อรับสำเนาครบถ้วน");
      data[key] = rows;
    }
    await audit(tx, userId, "privacy.exported", "user", userId);
    return { version: 1, createdAt: new Date().toISOString(), data };
  });
}
export async function requestDeletion(sql: Sql, userId: string, reason: string) {
  return sql.transaction(async (tx) => {
    const [row] = await tx.query<{ id: string }>(
      "INSERT INTO privacy_requests(id,user_id,kind,reason) VALUES($1,$2,'deletion',$3) ON CONFLICT(user_id,kind) WHERE status='pending' DO UPDATE SET reason=privacy_requests.reason RETURNING id",
      [randomUUID(), userId, reason],
    );
    await audit(tx, userId, "privacy.deletion_requested", "privacy_request", row.id);
    return row;
  });
}
export async function reviewDeletion(
  sql: Sql,
  actor: string,
  id: string,
  approve: boolean,
  reply: string,
) {
  return sql.transaction(async (tx) => {
    const [row] = await tx.query<{ user_id: string; status: string }>(
      "SELECT user_id,status FROM privacy_requests WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!row) throw new CommerceError("ไม่พบคำขอ");
    if (row.status !== "pending") return { ok: true };
    if (approve) {
      // Do not remove an administrator's recovery identity or silently discard money/cases.
      await tx.query(
        "LOCK TABLE user_roles, wallet_accounts, payments, claims IN SHARE ROW EXCLUSIVE MODE",
      );
      await tx.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [row.user_id]);
      const [blocked] = await tx.query<{ blocked: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=$1 AND role_id IN ('super_admin','admin','staff')) OR EXISTS(SELECT 1 FROM wallet_accounts WHERE user_id=$1 AND balance<>0) OR EXISTS(SELECT 1 FROM payments WHERE user_id=$1 AND status IN ('pending','reconciliation_required')) OR EXISTS(SELECT 1 FROM claims WHERE user_id=$1 AND status IN ('pending','accepted')) AS blocked",
        [row.user_id],
      );
      if (blocked.blocked)
        throw new CommerceError("ต้องจัดการสิทธิ์แอดมิน เครดิตคงเหลือ และรายการค้างก่อนปิดบัญชี");
      await tx.query(
        'UPDATE "user" SET name=$2,email=$3,image=NULL,"emailVerified"=false,"updatedAt"=now() WHERE id=$1',
        [row.user_id, "บัญชีที่ปิดแล้ว", `removed-${randomUUID()}@account.invalid`],
      );
      await tx.query(
        "INSERT INTO member_profiles(user_id,disabled) VALUES($1,true) ON CONFLICT(user_id) DO UPDATE SET disabled=true,updated_at=now()",
        [row.user_id],
      );
      await tx.query('DELETE FROM session WHERE "userId"=$1', [row.user_id]);
      await tx.query('DELETE FROM account WHERE "userId"=$1', [row.user_id]);
    } else await notify(tx, row.user_id, "ผลคำขอปิดบัญชี", reply);
    await tx.query(
      "UPDATE privacy_requests SET status=$2,reply=$3,reviewed_at=now(),reviewed_by=$4 WHERE id=$1",
      [id, approve ? "approved" : "rejected", reply, actor],
    );
    await audit(
      tx,
      actor,
      approve ? "privacy.deletion_approved" : "privacy.deletion_rejected",
      "privacy_request",
      id,
      { reason: reply, financialRecordsRetained: true },
    );
    return { ok: true };
  });
}
