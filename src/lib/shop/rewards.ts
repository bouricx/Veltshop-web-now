import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { requirePermission } from "./permissions.server";
import { audit, limit } from "./operations-service.server";
import { rewardSchema, playReward } from "./rewards-service.server";
import { CommerceError } from "./commerce.server";
export const getRewardCampaign = createServerFn({ method: "GET" })
  .validator((v: unknown) => z.object({ id: z.enum(["wheel", "box"]) }).parse(v))
  .handler(async ({ data }) => {
    const [row] = await (
      await getSql()
    ).query<{
      id: string;
      title: string;
      cost: number;
      daily_limit: number;
      active: boolean;
      prizes: unknown;
    }>("SELECT * FROM reward_campaigns WHERE id=$1", [data.id]);
    return row ? rewardSchema.parse({ ...row, dailyLimit: row.daily_limit }) : null;
  });
export const saveRewardCampaign = createServerFn({ method: "POST" })
  .validator((v: unknown) => rewardSchema.parse(v))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    await requirePermission(String(context.userId), "promotions.manage", context.bearerToken);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx.query(
        "INSERT INTO reward_campaigns(id,title,cost,daily_limit,active,prizes) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET title=excluded.title,cost=excluded.cost,daily_limit=excluded.daily_limit,active=excluded.active,prizes=excluded.prizes",
        [data.id, data.title, data.cost, data.dailyLimit, data.active, JSON.stringify(data.prizes)],
      );
      await audit(tx, String(context.userId), "reward.configured", "campaign", data.id, {
        cost: data.cost,
        dailyLimit: data.dailyLimit,
        active: data.active,
        prizes: data.prizes,
      });
    });
    return { ok: true };
  });
export const playCampaign = createServerFn({ method: "POST" })
  .validator((v: unknown) =>
    z.object({ id: z.enum(["wheel", "box"]), key: z.string().uuid() }).parse(v),
  )
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    try {
      const sql = await getSql();
      await limit(sql, `reward:${context.userId}`, 5);
      return {
        ok: true as const,
        result: await playReward(sql, String(context.userId), data.id, data.key),
      };
    } catch (err) {
      return {
        ok: false as const,
        message:
          err instanceof CommerceError
            ? err.message
            : "ทำรายการไม่สำเร็จ โปรดตรวจรายการเครดิตก่อนลองใหม่",
      };
    }
  });
