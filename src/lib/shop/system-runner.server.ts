import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Sql } from "../db";
import { processJobs, scheduleBackup } from "./jobs-service.server.ts";
import { configuration } from "./operations-service.server.ts";
export function authorizedCron(actual: string | null, secret = process.env.CRON_SECRET) {
  const expected = `Bearer ${secret}`;
  return Boolean(
    secret &&
    secret.length >= 32 &&
    actual &&
    Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected)),
  );
}
export async function runSystemMaintenance(sql: Sql) {
  const id = randomUUID();
  await sql.query("INSERT INTO system_runs(id,kind,status) VALUES($1,'maintenance','running')", [
    id,
  ]);
  try {
    const settings = await configuration(sql);
    await sql.transaction(async (tx) => {
      // Only expiring/security and explicitly configured operational data is pruned. Financial/audit records stay immutable.
      await tx.query("DELETE FROM request_limits WHERE expires_at<now()");
      await tx.query("DELETE FROM realtime_revisions WHERE created_at<now()-interval '7 days'");
      await tx.query('DELETE FROM session WHERE "expiresAt"<now()');
      if (settings.notificationRetentionDays > 0)
        await tx.query(
          "DELETE FROM notifications WHERE read_at IS NOT NULL AND created_at<now()-$1*interval '1 day'",
          [settings.notificationRetentionDays],
        );
      if (settings.loginRetentionDays > 0)
        await tx.query("DELETE FROM login_history WHERE created_at<now()-$1*interval '1 day'", [
          settings.loginRetentionDays,
        ]);
      if (settings.jobRetentionDays > 0)
        await tx.query(
          "DELETE FROM jobs WHERE status='success' AND updated_at<now()-$1*interval '1 day'",
          [settings.jobRetentionDays],
        );
    });
    await scheduleBackup(sql);
    const result = await processJobs(sql, 10);
    await sql.query(
      "UPDATE system_runs SET status='success',finished_at=now(),result=$2 WHERE id=$1",
      [id, JSON.stringify(result)],
    );
    return { id, ...result };
  } catch {
    await sql.query(
      "UPDATE system_runs SET status='failed',finished_at=now(),result='{}' WHERE id=$1",
      [id],
    );
    throw new Error("ประมวลผลงานระบบไม่สำเร็จ");
  }
}
