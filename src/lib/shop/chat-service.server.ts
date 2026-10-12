import { generateText } from "ai";
import type { Sql } from "../db";
import { configuration, limit } from "./operations-service.server.ts";
import { chatInstructions } from "./chat-policy.ts";

export async function answerShopQuestion(
  sql: Sql,
  userId: string,
  messages: { role: "user" | "assistant"; content: string }[],
  dependencies = {
    available: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
    generate: generateText,
  },
) {
  if (!dependencies.available) {
    return { ok: false as const, message: "แชต AI ยังไม่พร้อมใช้งาน กรุณาติดต่อแอดมิน" };
  }
  try {
    await limit(sql, `chat:minute:${userId}`, 5, 60);
    await limit(sql, `chat:day:${userId}`, 30, 86400);
    await limit(sql, "chat:shop:day", 300, 86400);
  } catch {
    return {
      ok: false as const,
      message: "ถึงจำนวนคำถามที่รองรับแล้ว กรุณาลองภายหลังหรือติดต่อแอดมิน",
    };
  }
  const products = await sql.query<{
    name: string;
    price: number;
    stock: number;
    warranty_days: number;
    description: string;
  }>(
    `SELECT p.name,p.price,p.stock,p.warranty_days,left(p.description,500) AS description
     FROM products p JOIN categories c ON c.id=p.category_id
     WHERE p.active=true AND c.visible=true ORDER BY p.sort_order,p.name LIMIT 40`,
  );
  const site = await configuration(sql);
  try {
    const { text } = await dependencies.generate({
      model: process.env.AI_GATEWAY_MODEL || "openai/gpt-4.1-mini",
      system: `${chatInstructions}\nร้าน: ${JSON.stringify({ name: site.name, maintenance: site.maintenance, facebook: site.facebook, discord: site.discord })}\nแค็ตตาล็อกสาธารณะ: ${JSON.stringify(products)}`,
      messages,
      maxOutputTokens: 500,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(25000),
    });
    if (!text.trim()) throw new Error("Empty response");
    return { ok: true as const, text };
  } catch {
    return { ok: false as const, message: "AI ตอบไม่ได้ในขณะนี้ กรุณาลองอีกครั้งหรือติดต่อแอดมิน" };
  }
}
