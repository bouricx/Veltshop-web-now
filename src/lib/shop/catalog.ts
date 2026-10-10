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
  delivery:
    | "account"
    | "code"
    | "otp"
    | "smm"
    | "topup"
    | "email-password"
    | "license"
    | "text"
    | "file"
    | "link";
  warrantyDays?: number;
  cardColor?: string;
  borderColor?: string;
  accentColor?: string;
  badgeColor?: string;
  description?: string;
  icon?: string;
  badge?: string;
  sortOrder?: number;
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

// Storefront copy describes implemented behavior and distinguishes provider setup.
export const comparisonRows = [
  {
    feature: "กระเป๋าเครดิต",
    cheap: "ขึ้นอยู่กับบริการ",
    diy: "ต้องพัฒนา",
    velt: "มีประวัติรายการและยอดคงเหลือ",
  },
  {
    feature: "สินค้าดิจิทัล",
    cheap: "ขึ้นอยู่กับบริการ",
    diy: "ต้องพัฒนา",
    velt: "ส่งจากสต็อกและเปิดดูในประวัติ",
  },
  {
    feature: "หลังบ้าน",
    cheap: "ขึ้นอยู่กับบริการ",
    diy: "ต้องพัฒนา",
    velt: "สินค้า ออเดอร์ เคลม และบันทึกการแก้ไข",
  },
];
export const faqs = [
  {
    q: "ซื้อสินค้าอย่างไร?",
    a: "สมัครสมาชิก เติมเครดิต เลือกสินค้า และยืนยันคำสั่งซื้อ ตรวจสอบวิธีจัดส่งและเงื่อนไขก่อนชำระเงิน",
  },
  {
    q: "ดูสินค้าที่ซื้อแล้วได้ที่ไหน?",
    a: "เปิดประวัติการซื้อจากบัญชีของคุณ สินค้าที่จัดส่งแล้วจะมีรายละเอียดหรือปุ่มดาวน์โหลดตามประเภทสินค้า",
  },
  {
    q: "ติดต่อทีมงานได้อย่างไร?",
    a: "ติดต่อผ่าน Discord หรือ Facebook ของ Veltshop ที่ระบุด้านล่างเว็บไซต์",
  },
];
