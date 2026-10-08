import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { uid } from "@/lib/utils";
import { requirePermission, ROLE_IDS } from "./permissions.server";

const schema = z.object({ userId: z.string().trim().min(1).max(200), roleId: z.enum(ROLE_IDS) });

export const setUserRole = createServerFn({ method: "POST" })
  .validator((value: unknown) => schema.parse(value))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const actor = await requirePermission(String(context.userId), "roles.manage", context.bearerToken);
    const sql = await getSql();
    await sql`
      insert into user_roles (user_id, role_id)
      values (${data.userId}, ${data.roleId})
      on conflict (user_id, role_id) do nothing
    `;
    await sql`
      insert into audit_logs (id, actor_id, action, entity_type, entity_id, metadata)
      values (${uid("audit")}, ${actor.id}, 'role.assigned', 'user', ${data.userId},
        ${JSON.stringify({ roleId: data.roleId })})
    `;
    return { ok: true as const };
  });
