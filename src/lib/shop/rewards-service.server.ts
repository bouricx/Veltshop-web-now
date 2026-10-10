import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Sql } from "../db";
import { configuration, notify } from "./operations-service.server.ts";
import { CommerceError } from "./commerce.server.ts";
export const rewardSchema = z.object({
  id: z.enum(["wheel", "box"]),
  title: z.string().trim().min(1).max(120),
  cost: z.number().int().min(0).max(10000),
  dailyLimit: z.number().int().min(1).max(100),
  active: z.boolean(),
  prizes: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        weight: z.number().int().min(1).max(10000),
        credit: z.number().int().min(0).max(10000),
      }),
    )
    .min(2)
    .max(20),
});
export async function playReward(sql: Sql, user: string, campaign: string, key: string) {
  return sql.transaction(async (tx) => {
    await tx.query("INSERT INTO wallet_accounts(user_id) VALUES($1) ON CONFLICT DO NOTHING", [
      user,
    ]);
    const [wallet] = await tx.query<{ balance: number }>(
      "SELECT balance FROM wallet_accounts WHERE user_id=$1 FOR UPDATE",
      [user],
    );
    const [old] = await tx.query<{
      campaign_id: string;
      balance: number;
      prize_index: number;
      reward: number;
    }>(
      "SELECT campaign_id,balance,prize_index,reward FROM reward_plays WHERE user_id=$1 AND key=$2",
      [user, key],
    );
    if (old) {
      if (old.campaign_id !== campaign) throw new CommerceError("คำขอซ้ำไม่ตรงกิจกรรม");
      return { balance: old.balance, prizeIndex: old.prize_index, reward: old.reward };
    }
    if ((await configuration(tx)).maintenance) throw new CommerceError("ร้านกำลังปรับปรุง");
    const [record] = await tx.query<{
      id: string;
      title: string;
      cost: number;
      daily_limit: number;
      active: boolean;
      prizes: unknown;
    }>("SELECT * FROM reward_campaigns WHERE id=$1 FOR UPDATE", [campaign]);
    if (!record) throw new CommerceError("ยังไม่ได้ตั้งค่ากิจกรรม");
    const config = rewardSchema.parse({ ...record, dailyLimit: record.daily_limit });
    if (!config.active) throw new CommerceError("กิจกรรมปิดอยู่");
    const [usage] = await tx.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM reward_plays WHERE user_id=$1 AND campaign_id=$2 AND (created_at AT TIME ZONE 'Asia/Bangkok')::date=(now() AT TIME ZONE 'Asia/Bangkok')::date",
      [user, campaign],
    );
    if (usage.n >= config.dailyLimit) throw new CommerceError("ใช้สิทธิ์วันนี้ครบแล้ว");
    if (wallet.balance < config.cost) throw new CommerceError("เครดิตไม่พอ");
    const total = config.prizes.reduce((n, p) => n + p.weight, 0);
    let roll = randomInt(total),
      prizeIndex = 0;
    for (let i = 0; i < config.prizes.length; i++) {
      if (roll < config.prizes[i].weight) {
        prizeIndex = i;
        break;
      }
      roll -= config.prizes[i].weight;
    }
    const reward = config.prizes[prizeIndex].credit;
    const debited = wallet.balance - config.cost;
    const balance = debited + reward;
    if (balance > 2147483647) throw new CommerceError("ยอดเกินขีดจำกัด");
    if (config.cost)
      await tx.query(
        "INSERT INTO wallet_ledger(id,user_id,amount,balance_after,reason) VALUES($1,$2,$3,$4,'reward_entry')",
        [randomUUID(), user, -config.cost, debited],
      );
    if (reward)
      await tx.query(
        "INSERT INTO wallet_ledger(id,user_id,amount,balance_after,reason) VALUES($1,$2,$3,$4,'reward_credit')",
        [randomUUID(), user, reward, balance],
      );
    await tx.query("UPDATE wallet_accounts SET balance=$2,updated_at=now() WHERE user_id=$1", [
      user,
      balance,
    ]);
    await tx.query(
      "INSERT INTO reward_plays(id,campaign_id,user_id,key,prize_index,cost,reward,balance) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [randomUUID(), campaign, user, key, prizeIndex, config.cost, reward, balance],
    );
    await tx.query(
      "INSERT INTO transactions(id,user_id,kind,status,amount) VALUES($1,$2,$3,'success',$4)",
      [randomUUID(), user, campaign === "wheel" ? "WHEEL" : "BOX", reward - config.cost],
    );
    await notify(tx, user, config.title, `ได้รับเครดิต ${reward} บาท`);
    return { balance, prizeIndex, reward };
  });
}
