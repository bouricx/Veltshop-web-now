export type CategoryId = "stream" | "game" | "custom" | "otp" | "smm" | "code";

export type Product = {
  id: string;
  name: string;
  subtitle: string;
  category: CategoryId;
  price: number;
  compareAt?: number;
  stock: number;
  stockMode?: "quantity" | "individual";
  image: string;
  delivery: "account" | "code" | "otp" | "smm" | "topup";
  featured?: boolean;
  flash?: boolean;
  active?: boolean;
};

export const categories: {
  id: CategoryId;
  label: string;
  hint: string;
}[] = [
  { id: "stream", label: "บัตรเติม / พรีเมียม", hint: "VOUCHER" },
  { id: "custom", label: "บริการดิจิทัล", hint: "SERVICE" },
  { id: "otp", label: "ซื้อเบอร์ OTP", hint: "SMS/OTP" },
  { id: "smm", label: "เพิ่มยอดไลค์ / ติดตาม", hint: "SMM" },
  { id: "game", label: "เติมเกม", hint: "GAME" },
  { id: "code", label: "โค้ดของขวัญ", hint: "CODE" },
];

export const products: Product[] = [
  {
    id: "gem-flash",
    name: "Void Gems 100 (Flash)",
    subtitle: "แพ็กเกม · ส่งโค้ดเติมอัตโนมัติ",
    category: "game",
    price: 49,
    compareAt: 69,
    stock: 42,
    image: "/images/cat-game.jpg",
    delivery: "code",
    featured: true,
    flash: true,
  },
  {
    id: "void-500",
    name: "Void Gems 500",
    subtitle: "แพ็กยอดนิยม · ส่งใน 30 วินาที",
    category: "game",
    price: 199,
    compareAt: 229,
    stock: 420,
    image: "/images/cat-game.jpg",
    delivery: "topup",
    featured: true,
  },
  {
    id: "pixel-60",
    name: "PixelPass 60 วัน",
    subtitle: "บัตรสมาชิกเกมครีเอเตอร์ (โค้ด)",
    category: "game",
    price: 129,
    stock: 22,
    image: "/images/cat-game.jpg",
    delivery: "code",
  },
  {
    id: "arena-100",
    name: "Telegram Boost 1,000",
    subtitle: "เติมยอดเข้าช่อง · ไม่ใช่บัญชีส่วนตัว",
    category: "smm",
    price: 49,
    stock: 999,
    image: "/images/cat-game.jpg",
    delivery: "smm",
    featured: true,
  },
  {
    id: "otp-house",
    name: "เบอร์รับ OTP ชั่วคราว",
    subtitle: "รับ OTP อัตโนมัติ ไม่ต้องรอแอดมิน",
    category: "otp",
    price: 15,
    stock: 200,
    image: "/images/cat-otp.jpg",
    delivery: "otp",
  },
  {
    id: "smm-follow",
    name: "ติดตาม 1,000",
    subtitle: "เชื่อม API ผู้ให้บริการ · ค่อย ๆ เข้า",
    category: "smm",
    price: 49,
    stock: 9999,
    image: "/images/hero-bg.jpg",
    delivery: "smm",
  },
  {
    id: "smm-like",
    name: "ไลก์โพสต์ 500",
    subtitle: "ปั๊มไลก์แบบค่อยเป็นค่อยไป",
    category: "smm",
    price: 29,
    stock: 9999,
    image: "/images/hero-bg.jpg",
    delivery: "smm",
  },
  {
    id: "gift-50",
    name: "คูปองร้าน ฿50",
    subtitle: "โค้ดของขวัญสำหรับลูกค้าประจำ",
    category: "code",
    price: 50,
    stock: 100,
    image: "/images/cat-box.jpg",
    delivery: "code",
    featured: true,
  },
  {
    id: "svc-boost",
    name: "แพ็กบูสต์โพสต์ 24 ชม.",
    subtitle: "บริการดิจิทัล · ส่งรายงานเมื่อจบงาน",
    category: "custom",
    price: 99,
    stock: 50,
    image: "/images/cat-otp.jpg",
    delivery: "code",
  },
]


export const wheelPrizes = [
  { id: "w10", label: "฿10", weight: 22, kind: "wallet" as const, value: 10 },
  { id: "w5", label: "฿5", weight: 24, kind: "wallet" as const, value: 5 },
  { id: "w50", label: "฿50", weight: 8, kind: "wallet" as const, value: 50 },
  { id: "w200", label: "฿200", weight: 2, kind: "wallet" as const, value: 200 },
  { id: "wmiss", label: "โชคไม่ดี", weight: 18, kind: "none" as const, value: 0 },
  { id: "wbox", label: "กล่องสุ่ม", weight: 10, kind: "box" as const, value: 1 },
  { id: "wsh", label: "Gems Flash", weight: 6, kind: "product" as const, value: 0, productId: "gem-flash" },
  { id: "wthanks", label: "ขอบคุณ", weight: 10, kind: "none" as const, value: 0 },
];

export const boxTiers = [
  {
    id: "common",
    label: "ทั่วไป",
    chance: 70,
    items: [
      { name: "คูปอง ฿10", kind: "wallet" as const, value: 10 },
      { name: "คูปอง ฿5", kind: "wallet" as const, value: 5 },
    ],
  },
  {
    id: "rare",
    label: "หายาก",
    chance: 25,
    items: [
      { name: "PixelPass 60 วัน", kind: "product" as const, productId: "pixel-60" },
      { name: "เครดิต ฿50", kind: "wallet" as const, value: 50 },
    ],
  },
  {
    id: "legend",
    label: "ตำนาน",
    chance: 5,
    items: [
      { name: "Void Gems 500", kind: "product" as const, productId: "void-500" },
      { name: "เครดิต ฿200", kind: "wallet" as const, value: 200 },
    ],
  },
];

export const giftCodes: Record<string, { credit: number; once: boolean }> = {
  VELT50: { credit: 50, once: true },
  WELCOME: { credit: 100, once: true },
  FLASH20: { credit: 20, once: false },
};

export const fakeBuyers = [
  "udairo",
  "chanyo",
  "mint08",
  "beamzz",
  "kaengx",
  "praew1",
  "tondev",
  "focus9",
  "juneee",
  "maxpay",
  "ployyy",
  "nice01",
];

export const comparisonRows = [
  { feature: "ตรวจสลิป 2 ค่าย สลับได้", cheap: "ค่ายเดียว", diy: "ต้องจ้างเขียน", velt: "Thunder / Slip2Go" },
  { feature: "กันสลิปซ้ำ 3 ชั้น", cheap: "บางระบบ", diy: "แล้วแต่ทีม", velt: "ซ้ำ · ผู้รับ · ยอดเงิน" },
  { feature: "สินค้า Custom ไม่จำกัด", cheap: "จำกัดชนิด", diy: "ได้", velt: "ไม่จำกัด" },
  { feature: "OTP / SMM / เติมเกม", cheap: "แยกซื้อปลั๊กอิน", diy: "ค่อย ๆ ต่อ", velt: "อยู่ในระบบ" },
  { feature: "กงล้อ + กล่องสุ่ม + Flash Sale", cheap: "ไม่มี", diy: "ทำเอง", velt: "ตั้งเวลาและโอกาสได้" },
  { feature: "OAuth 3 ค่าย + เชื่อมบัญชี", cheap: "1 ค่าย", diy: "แล้วแต่", velt: "Discord Google Facebook" },
  { feature: "ธีมมืด/สว่าง + สีหลัก", cheap: "สีสำเร็จรูป", diy: "จ้างดีไซน์", velt: "ปรับได้ทุกจุด" },
  { feature: "อัปเดตฟรีตลอดอายุเช่า", cheap: "คิดเพิ่ม", diy: "ไม่มี", velt: "ดึงจาก GitHub ครั้งละปุ่ม" },
  { feature: "PWA + มือถือโหลดเร็ว", cheap: "ไม่รองรับ", diy: "แล้วแต่", velt: "ติดตั้งเป็นแอปได้" },
  { feature: "Webhook Discord เรียลไทม์", cheap: "ไม่มี", diy: "ต่อเอง", velt: "ทุกออเดอร์" },
];

export const faqs = [
  {
    q: "ต้องเขียนโค้ดเป็นไหม?",
    a: "ไม่ต้อง เปิดร้านได้หลังผูกโดเมนและตั้งค่าสี โลโก้ บัญชีรับเงินในแอดมิน เติมสต๊อก ตั้งราคา แล้วเปิดขายได้เลย มีคลิปแนะนำทุกเมนู",
  },
  {
    q: "ทดลองใช้ก่อนได้ไหม?",
    a: "ได้ กดทดลองร้านด้านบนเพื่อซื้อ เติมเงิน หมุนกงล้อ และเปิดกล่องในโหมดเดโม ข้อมูลเก็บในเครื่องคุณ ไม่คิดเงินจริง",
  },
  {
    q: "V1 กับ V2 ต่างกันตรงไหน?",
    a: "V2 ครอบคลุมร้านค้า เติมเงิน สินค้าดิจิทัลและธีมพื้นฐาน V1 เพิ่ม OTP, SMM, OAuth สามค่าย, กงล้อ, กล่องสุ่ม, Flash Sale, Webhook Discord และได้รับอัปเดตก่อนทุกครั้ง",
  },
  {
    q: "ตรวจสลิปใช้ค่ายไหน? สลับได้ไหม?",
    a: "รองรับ Thunder API และ Slip2Go สลับได้ในแอดมินโดยไม่ต้องแตะโค้ด ระบบกันสลิปซ้ำ ตรวจบัญชีผู้รับ และตรวจยอดเงินอัตโนมัติ",
  },
  {
    q: "ถ้ามีคนใช้สลิปปลอมหรือสลิปซ้ำ?",
    a: "สลิปที่เคยเข้าแล้วถูกบล็อกทันที ยอดไม่ตรงหรือบัญชีผู้รับไม่ตรงจะไม่เติมเครดิต มีล็อกทุกขั้นตอนให้ไล่ย้อนได้",
  },
  {
    q: "โดเมนและโฮสต์รวมไหม?",
    a: "รวมโฮสต์และ SSL ตลอดอายุเช่า โดเมนของคุณชี้มาที่ร้านได้เลย ถ้ายังไม่มีโดเมน ทีมงานจัดให้ในราคาส่งต่อ",
  },
  {
    q: "อัปเดตแล้วไฟล์เก่าหรือรูปที่อัปโหลดหายไหม?",
    a: "ไม่ทับ .env และโฟลเดอร์อัปโหลด กดอัปเดตครั้งเดียว ดึงเวอร์ชันล่าสุดจาก GitHub และเก็บประวัติทุกครั้ง",
  },
  {
    q: "ย้ายสต๊อกจากร้านเดิมมาได้ไหม?",
    a: "ได้ ส่งไฟล์ CSV หรือให้ทีมย้ายสต๊อกโค้ด/บริการดิจิทัลให้ รองรับทั้งสต๊อกแบบรายการและแบบพูล",
  },
  {
    q: "จ่ายยังไง ยกเลิกได้เมื่อไหร่?",
    a: "โอนหรือพร้อมเพย์รายเดือน/รายปี ยกเลิกได้ทุกเมื่อ ร้านยังออนไลน์ถึงจบรอบที่จ่ายแล้ว ไม่มีสัญญาผูกมัดระยะยาว",
  },
  {
    q: "ซัพพอร์ตตอบกี่โมง?",
    a: "ไลน์ทีมงานตอบทุกวัน 09:00–24:00 เคสระบบขัดข้องมีเวรเฝ้า 24 ชั่วโมงสำหรับแพ็กเกจ V1",
  },
];

export function deliverPayload(product: Product): string {
  const tag = product.id.toUpperCase().replace("-", "");
  if (product.delivery === "account") {
    // Kept for schema compatibility — shop policy does not sell login accounts.
    return `อ้างอิงบริการ: ${tag}-${Date.now().toString(36).toUpperCase()}\nติดต่อแอดมินเพื่อส่งมอบ (ไม่ส่งรหัสล็อกอินอัตโนมัติ)`;
  }
  if (product.delivery === "code") {
    return `โค้ด: VELT-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }
  if (product.delivery === "otp") {
    return `OTP: ${(100000 + Math.floor(Math.random() * 900000)).toString()}\nใช้ภายใน 5 นาที`;
  }
  if (product.delivery === "smm") {
    return `งานเข้าคิวแล้ว รหัสงาน ${tag}-${Date.now().toString(36).toUpperCase()}\nจะทยอยเข้าภายใน 24 ชม.`;
  }
  return `เติมสำเร็จ UID ที่ผูกไว้ · เลขอ้างอิง ${tag}-${Date.now().toString(36).toUpperCase()}`;
}

export function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}
