import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { chatInputSchema } from "./chat-policy";

export const chatAvailability = createServerFn({ method: "GET" }).handler(async () => ({
  available: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
}));

export const askShopAssistant = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(chatInputSchema)
  .handler(async ({ data, context }) => {
    const { answerShopQuestion } = await import("./chat-service.server");
    const { getSql } = await import("@/lib/db");
    return answerShopQuestion(await getSql(), context.userId, data.messages);
  });
