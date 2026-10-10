import { z } from "zod";
const localOrHttps = z
  .string()
  .max(2048)
  .refine(
    (v) => !v || (/^\/(?!\/)/.test(v) && !v.includes("..")) || /^https:\/\//.test(v),
    "ลิงก์ต้องเป็น HTTPS หรือรูปในเว็บไซต์",
  );
export const configurationSchema = z
  .object({
    name: z.string().trim().min(1).max(120).default("Veltshop"),
    description: z.string().max(500).default("ร้านสินค้าดิจิทัล ซื้อขายได้ตลอด 24 ชั่วโมง"),
    logo: localOrHttps.default(""),
    favicon: localOrHttps.default("/favicon.svg"),
    primary: z
      .string()
      .regex(/^#[a-f\d]{6}$/i)
      .default("#18181b"),
    secondary: z
      .string()
      .regex(/^#[a-f\d]{6}$/i)
      .default("#64748b"),
    discord: z
      .string()
      .url()
      .refine(
        (v) =>
          new URL(v).protocol === "https:" &&
          ["discord.gg", "discord.com"].includes(new URL(v).hostname),
      )
      .default("https://discord.gg/bjakzMKXK"),
    facebook: z
      .string()
      .url()
      .refine(
        (v) =>
          new URL(v).protocol === "https:" &&
          ["facebook.com", "www.facebook.com"].includes(new URL(v).hostname),
      )
      .default("https://www.facebook.com/Veltshop/"),
    terms: z
      .string()
      .max(10000)
      .default("เติมเงินเข้าระบบแล้ว ไม่สามารถคืนได้ เป็นไปตามเงื่อนไขของเว็บไซต์"),
    refundText: z
      .string()
      .max(10000)
      .default("ขอคืนเครดิตสำหรับออเดอร์ที่มีปัญหาผ่านหน้าเคลม ทีมงานตรวจสอบก่อนอนุมัติ"),
    privacy: z
      .string()
      .max(20000)
      .default(
        "ใช้ข้อมูลบัญชีเพื่อจัดส่งสินค้าและบันทึกธุรกรรม ติดต่อทีมงานเพื่อขอสำเนาหรือลบบัญชี ข้อมูลธุรกรรมที่ต้องเก็บตามข้อกำหนดจะถูกจำกัดการเข้าถึง",
      ),
    maintenance: z.boolean().default(false),
    lowStock: z.number().int().min(0).max(100000).default(5),
    vip: z.number().int().min(0).default(500),
    vvip: z.number().int().min(0).default(2000),
    minimumTopup: z.number().int().min(1).max(100000000).default(20),
    maximumTopup: z.number().int().min(1).max(100000000).default(100000),
    slipFeeBps: z.number().int().min(0).max(10000).default(290),
    google: z.boolean().default(true),
    trueMoney: z.boolean().default(true),
    slip2go: z.boolean().default(true),
    notificationRetentionDays: z.number().int().min(0).max(3650).default(0),
    loginRetentionDays: z.number().int().min(0).max(3650).default(0),
    jobRetentionDays: z.number().int().min(0).max(3650).default(0),
    imageMaxMb: z.number().min(0.1).max(5).default(5),
    imageQuality: z.number().int().min(40).max(95).default(82),
    imageSquare: z.number().int().min(128).max(2048).default(800),
    imageBannerWidth: z.number().int().min(320).max(2560).default(1920),
    imageBannerHeight: z.number().int().min(100).max(1440).default(600),
  })
  .refine(
    (v) => v.maximumTopup >= v.minimumTopup && v.vvip >= v.vip,
    "ช่วงยอดเงินหรือระดับสมาชิกไม่ถูกต้อง",
  );
export type SiteConfiguration = z.infer<typeof configurationSchema>;
export const defaultConfiguration = configurationSchema.parse({});
