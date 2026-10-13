import { z } from "zod";

export const conversationInput = z.object({
  id: z.string().uuid(),
  before: z
    .object({ at: z.string().max(80), userId: z.string().max(200), key: z.string().uuid() })
    .optional(),
});
export const orderMessageInput = z.object({
  id: z.string().uuid(),
  key: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});
export const deliveryEditInput = z.object({
  id: z.string().uuid(),
  key: z.string().uuid(),
  expectedVersion: z.string().regex(/^[a-f\d]{64}$/),
  channel: z.enum(["web", "facebook", "discord"]),
  reason: z.string().trim().min(3).max(500),
  entries: z
    .array(
      z.object({
        productId: z.string().min(1).max(160),
        payload: z.string().trim().max(10000),
        instructions: z.string().trim().max(10000),
      }),
    )
    .min(1)
    .max(30),
  confirmed: z.literal(true),
});
export type ConversationCursor = NonNullable<z.infer<typeof conversationInput>["before"]>;
export type DeliveryEditInput = z.infer<typeof deliveryEditInput>;
