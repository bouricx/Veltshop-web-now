import { z } from "zod";

export const categoryInputSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(120),
  hint: z.string().trim().max(240),
  sort_order: z.number().finite().int().min(0).max(100000),
  visible: z.boolean(),
  image: z
    .string()
    .max(2048)
    .refine((v) => !v || /^\/(?!\/)/.test(v) || /^https:\/\//.test(v))
    .optional(),
  icon: z.string().max(20).optional(),
  color: z
    .string()
    .regex(/^#[a-f\d]{6}$/i)
    .optional(),
});

export const productInputSchema = z.object({
  id: z.string().trim().max(160).optional(),
  name: z.string().trim().min(1).max(240),
  subtitle: z.string().trim().max(500),
  category: z.string().trim().min(1).max(120),
  price: z.number().finite().int().min(0).max(100000000),
  compareAt: z.number().finite().int().min(0).max(100000000).nullable().optional(),
  stock: z.number().finite().int().min(0).max(100000000),
  image: z
    .string()
    .trim()
    .max(8_000_000)
    .refine(
      (v) =>
        !v ||
        /^\/(?!\/)/.test(v) ||
        /^https:\/\//.test(v) ||
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),
      "ลิงก์รูปไม่ถูกต้อง",
    ),
  delivery: z.enum([
    "account",
    "code",
    "otp",
    "smm",
    "topup",
    "email-password",
    "license",
    "text",
    "file",
    "link",
  ]),
  warrantyDays: z.number().int().min(0).max(3650).optional(),
  cardColor: z
    .string()
    .regex(/^#[a-f\d]{6}$/i)
    .optional(),
  borderColor: z
    .string()
    .regex(/^#[a-f\d]{6}$/i)
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[a-f\d]{6}$/i)
    .optional(),
  badgeColor: z
    .string()
    .regex(/^#[a-f\d]{6}$/i)
    .optional(),
  description: z.string().trim().max(10000).optional(),
  icon: z.string().trim().max(20).optional(),
  badge: z.string().max(80).optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  featured: z.boolean().optional(),
  flash: z.boolean().optional(),
  active: z.boolean().optional(),
});

export function parseServerInput<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
