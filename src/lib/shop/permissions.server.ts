import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSessionUser } from "@/lib/auth/verify.server";
import { getSql } from "@/lib/db";
import { uid } from "@/lib/utils";
import { isAdminEmail } from "./admin";

export const ROLE_IDS = ["super_admin", "admin", "staff", "customer"] as const;
export type RoleId = (typeof ROLE_IDS)[number];
export type PermissionId = string;

const auditMetadata = (value: Record<string, unknown>) => JSON.stringify(value);

export async function hasPermission(userId: string, permission: PermissionId): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ allowed: boolean }>`
    select exists (
      select 1
      from user_roles ur
      join role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = ${userId} and rp.permission_id = ${permission}
    ) as allowed
  `;
  return Boolean(rows[0]?.allowed);
}

/** Existing allowlisted admins remain fully compatible during role migration. */
export async function requirePermission(
  userId: string,
  permission: PermissionId,
  bearerToken?: string,
) {
  const user = await getSessionUser(bearerToken);
  if (!user || user.id !== userId) throw new Error("Unauthorized");
  if (isAdminEmail(user.email)) return user;
  if (!(await hasPermission(userId, permission))) throw new Error("Forbidden");
  return user;
}

export const listMyAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const roles = await sql<{ id: RoleId; name: string }>`
      select r.id, r.name
      from user_roles ur join roles r on r.id = ur.role_id
      where ur.user_id = ${context.userId}
      order by r.id
    `;
    const permissions = await sql<{ id: string }>`
      select distinct rp.permission_id as id
      from user_roles ur join role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = ${context.userId}
      order by rp.permission_id
    `;
    return { roles, permissions: permissions.map((row) => row.id) };
  });

const roleAssignmentSchema = z.object({
  userId: z.string().trim().min(1).max(200),
  roleId: z.enum(ROLE_IDS),
});

export const assignRole = createServerFn({ method: "POST" })
  .validator((value: unknown) => roleAssignmentSchema.parse(value))
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
        ${auditMetadata({ roleId: data.roleId })})
    `;
    return { ok: true as const };
  });
