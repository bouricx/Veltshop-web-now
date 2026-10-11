import type { Sql } from "../db";
import { configuration } from "./operations-service.server.ts";
import { promptPayAccount, type CheckoutReadiness } from "./payment-policy.ts";
import { slip2GoConfigured } from "./slip2go.server.ts";

export async function checkoutReadiness(sql: Sql): Promise<CheckoutReadiness> {
  const config = await configuration(sql);
  const [settings] = await sql.query<{ receive_account: string; receive_name: string }>(
    "SELECT receive_account,receive_name FROM shop_settings WHERE id=1",
  );
  const available =
    !config.maintenance &&
    Boolean(settings?.receive_name?.trim() && promptPayAccount(settings?.receive_account ?? ""));
  const automatic = slip2GoConfigured();
  return {
    available,
    verification: automatic ? "automatic" : "manual",
    message: !available
      ? "ร้านพักรับชำระเงินชั่วคราว กรุณาติดต่อแอดมินก่อนโอน"
      : automatic
        ? "ชำระด้วยพร้อมเพย์ · แนบสลิปเพื่อตรวจสอบการโอน"
        : "ชำระด้วยพร้อมเพย์ · แอดมินตรวจสลิปและยืนยันยอดเงิน",
  };
}

export async function refreshCartPaymentStates(sql: Sql, userId: string | null = null) {
  await sql.query(
    `UPDATE cart_request_payments SET status='manual_review',reject_reason='รอแอดมินตรวจสอบหลักฐานการโอน'
     WHERE ($1::text IS NULL OR user_id=$1) AND status='verifying'
       AND COALESCE(submitted_at,created_at)<now()-interval '60 seconds'`,
    [userId],
  );
  await sql.query(
    `UPDATE cart_request_payments SET status='expired'
     WHERE ($1::text IS NULL OR user_id=$1) AND status IN ('unpaid','rejected') AND expires_at<=now()`,
    [userId],
  );
}
