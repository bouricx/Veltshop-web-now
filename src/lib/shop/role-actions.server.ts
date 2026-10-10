import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { uid } from "@/lib/utils";
import { assertCanAssignRole, requirePermission, ROLE_IDS } from "./permissions.server";

const schema = z.object({ userId: z.string().trim().min(1).max(200), roleId: z.enum(ROLE_IDS) });

export const setUserRole = createServerFn({ method: "POST" })
  .validator((value: unknown) => schema.parse(value))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const actor = await requirePermission(
      String(context.userId),
      "roles.manage",
      context.bearerToken,
    );
    await assertCanAssignRole(actor.id, data.roleId);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      const [target] = await tx.query('SELECT id FROM "user" WHERE id=$1', [data.userId]);
      if (!target) throw new Error("User not found");
      await tx.query(
        "INSERT INTO user_roles(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [data.userId, data.roleId],
      );
      await tx.query(
        "INSERT INTO audit_logs(id,actor_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'role.assigned','user',$3,$4)",
        [uid("audit"), actor.id, data.userId, JSON.stringify({ roleId: data.roleId })],
      );
    });
    return { ok: true as const };
  });
