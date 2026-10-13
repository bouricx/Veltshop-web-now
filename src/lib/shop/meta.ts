export const shopMeta = {
  name: "VeltShop.com",
  tagline: "ร้านดิจิทัลอย่างเป็นทางการ · VeltShop.com",
  lineId: "@veltshop",
  email: "support@veltshop.com",
  facebook: "VELTSHOP",
  facebookUrl: "https://www.facebook.com/Veltshop/",
  discordInvite: "https://discord.gg/bjakzMKXK",
  hoursWeek: "ซื้อขายได้ตลอด 24 ชั่วโมง",
  hoursWeekend: "",
  note: "หากพบปัญหา กรุณาติดต่อทีมงานผ่านช่องทางด้านล่าง",
};

export const dayShort = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
export const monthShort = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export function formatThaiClock(d: Date) {
  const thai = new Date(d.getTime() + 7 * 3600000);
  const hh = String(thai.getUTCHours()).padStart(2, "0");
  const mm = String(thai.getUTCMinutes()).padStart(2, "0");
  const ss = String(thai.getUTCSeconds()).padStart(2, "0");
  const buddhist = thai.getUTCFullYear() + 543;
  const date = `${dayShort[thai.getUTCDay()]} ${thai.getUTCDate()} ${monthShort[thai.getUTCMonth()]} ${buddhist}`;
  return { time: `${hh}:${mm}:${ss}`, date };
}

export function toThaiDateTimeInput(value: string) {
  return new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 16);
}

export function fromThaiDateTimeInput(value: string) {
  return new Date(`${value}+07:00`).toISOString();
}
