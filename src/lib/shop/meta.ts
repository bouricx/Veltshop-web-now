export const shopMeta = {
  name: "VeltShop.com",
  tagline: "ร้านดิจิทัลอย่างเป็นทางการ · VeltShop.com",
  lineId: "@veltshop",
  email: "support@veltshop.com",
  facebook: "VELTSHOP",
  facebookUrl: "https://www.facebook.com/profile.php?id=100087883835866",
  discordInvite: "https://discord.gg/ufdhU3saWE",
  hoursWeek: "จ–ศ: 15:00 – 03:00",
  hoursWeekend: "ส–อา: 10:00 – 00:00",
  note: "นอกเวลานอกจากตอบช้าเกินไป",
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
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const buddhist = d.getFullYear() + 543;
  const date = `${dayShort[d.getDay()]} ${d.getDate()} ${monthShort[d.getMonth()]} ${buddhist}`;
  return { time: `${hh}:${mm}:${ss}`, date };
}
