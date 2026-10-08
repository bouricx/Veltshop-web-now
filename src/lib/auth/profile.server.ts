import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { uid } from "@/lib/utils";

export const DEFAULT_AVATAR = "/favicon.svg";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  image: z.string().trim().max(2048).nullable().optional(),
});

function safeImage(image: string | null | undefined): string | null {
  if (!image) return null;
  try {
    const url = new URL(image, "http://profile.invalid");
    if (url.origin !== "http://profile.invalid" && !["https:", "http:"].includes(url.protocol)) return null;
    if (url.origin === "http://profile.invalid" && !url.pathname.startsWith("/")) return null;
    return image;
  } catch {
    return null;
  }
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string; name: string; email: string; image: string | null }>`
      select "id", "name", "email", "image" from "user" where "id" = ${context.userId}
    `;
    const user = rows[0];
    if (!user) return { ok: false as const, message: "ไม่พบโปรไฟล์" };
    return { ok: true as const, profile: { ...user, image: user.image || DEFAULT_AVATAR } };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .validator((value: unknown) => profileSchema.parse(value))
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const image = safeImage(data.image);
    const sql = await getSql();
    const rows = await sql<{ id: string; name: string; email: string; image: string | null }>`
      update "user"
      set "name" = ${data.name}, "image" = ${image}, "updatedAt" = now()
      where "id" = ${context.userId}
      returning "id", "name", "email", "image"
    `;
    const user = rows[0];
    if (!user) return { ok: false as const, message: "ไม่พบโปรไฟล์" };
    await sql`
      insert into audit_logs (id, actor_id, action, entity_type, entity_id, metadata)
      values (${uid("audit")}, ${context.userId}, 'profile.updated', 'user', ${context.userId},
        ${JSON.stringify({ changed: ["name", "image"] })})
    `;
    return { ok: true as const, profile: { ...user, image: user.image || DEFAULT_AVATAR } };
  });
