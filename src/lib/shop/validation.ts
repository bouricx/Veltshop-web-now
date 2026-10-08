import { z } from "zod";

export const categoryInputSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(120),
  hint: z.string().trim().max(240),
  sort_order: z.number().finite().int().min(0).max(100000),
  visible: z.boolean(),
});

export const productInputSchema = z.object({
  id: z.string().trim().max(160).optional(),
  name: z.string().trim().min(1).max(240),
  subtitle: z.string().trim().max(500),
  category: z.string().trim().min(1).max(120),
  price: z.number().finite().int().min(0).max(100000000),
  compareAt: z.number().finite().int().min(0).max(100000000).nullable().optional(),
  stock: z.number().finite().int().min(0).max(100000000),
  image: z.string().trim().max(8_000_000),
  delivery: z.enum(["account", "code", "otp", "smm", "topup"]),
  featured: z.boolean().optional(),
  flash: z.boolean().optional(),
  active: z.boolean().optional(),
});

export function parseServerInput<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
