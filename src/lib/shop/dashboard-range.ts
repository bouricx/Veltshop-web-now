import { z } from "zod";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "วันที่ไม่ถูกต้อง");
export const dashboardRangeSchema = z
  .object({
    days: z.number().int().min(1).max(3650).default(30),
    period: z.enum(["rolling", "today", "month", "all", "custom"]).default("rolling"),
    from: date.optional(),
    to: date.optional(),
  })
  .refine(
    (v) => v.period !== "custom" || Boolean(v.from && v.to && v.from <= v.to),
    "เลือกช่วงวันที่เริ่มต้นและสิ้นสุดให้ถูกต้อง",
  );
export function dashboardRange(input: z.infer<typeof dashboardRangeSchema>, now = new Date()) {
  if (input.period === "all") return { from: null, to: now.toISOString() };
  const bangkok = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
  if (input.period === "custom") {
    const start = new Date(`${input.from}T00:00:00+07:00`);
    const end = new Date(new Date(`${input.to}T00:00:00+07:00`).getTime() + 86400000);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  return {
    from:
      input.period === "today"
        ? new Date(`${bangkok}T00:00:00+07:00`).toISOString()
        : input.period === "month"
          ? new Date(`${bangkok.slice(0, 7)}-01T00:00:00+07:00`).toISOString()
          : new Date(now.getTime() - input.days * 86400000).toISOString(),
    to: now.toISOString(),
  };
}
