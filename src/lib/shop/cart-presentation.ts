export const requestStatuses: Record<string, [string, string]> = {
  pending: ["รอร้านตรวจสอบ", "bg-amber-50 text-amber-900"],
  received: ["ร้านรับเรื่องแล้ว", "bg-sky-50 text-sky-900"],
  done: ["จัดการแล้ว", "bg-emerald-50 text-emerald-900"],
  cancelled: ["ยกเลิก", "bg-rose-50 text-rose-900"],
};
