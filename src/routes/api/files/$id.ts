import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth/verify.server";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSql } from "@/lib/db";
import { downloadOwnedFile } from "@/lib/shop/private-files-service.server";
export const Route = createFileRoute("/api/files/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const headers = {
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        };
        try {
          assertSameSiteRequest();
          const user = await getSessionUser();
          if (!user) return new Response("กรุณาเข้าสู่ระบบ", { status: 401, headers });
          if (!/^[a-f\d-]{36}$/i.test(params.id))
            return new Response(null, { status: 404, headers });
          const file = await downloadOwnedFile(await getSql(), user.id, params.id);
          if (!file)
            return new Response("ไม่พบไฟล์ที่คุณมีสิทธิ์ดาวน์โหลด", { status: 404, headers });
          return new Response(new Uint8Array(file.bytes), {
            headers: {
              ...headers,
              "content-type": file.mime,
              "content-disposition": `attachment; filename="download.${file.name.split(".").pop()}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
              "content-security-policy": "sandbox; default-src 'none'",
            },
          });
        } catch {
          return new Response("ดาวน์โหลดไม่สำเร็จ", { status: 403, headers });
        }
      },
    },
  },
});
