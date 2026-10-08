import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Clock,
  CreditCard,
  Gauge,
  Gift,
  Globe,
  KeyRound,
  Layers,
  Lock,
  Palette,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
  Webhook,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { LandingNav } from "@/components/landing-nav";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { comparisonRows, faqs } from "@/lib/shop/catalog";
import { cn, formatBaht } from "@/lib/utils";

const featureBlocks = [
  {
    icon: Wallet,
    title: "เติมเงินอัตโนมัติ 24 ชม.",
    body: "ตรวจสลิป Thunder หรือ Slip2Go สลับในแอดมิน กันสลิปซ้ำ ตรวจบัญชีผู้รับ ตรวจยอด — ปลอดภัยสามชั้น",
  },
  {
    icon: QrCode,
    title: "พร้อมเพย์ / True Wallet",
    body: "QR แสดงเลขบัญชีอัตโนมัติ อั่งเปาเติมผ่านเบอร์ พร้อมตั้งค่าธรรมเนียมได้",
  },
  {
    icon: Layers,
    title: "ขายได้หลายประเภท",
    body: "ไอดีดิจิทัล สินค้ากำหนดเอง OTP/SMS แผง SMM เติมเกม และโค้ดของขวัญ ในคลังเดียว",
  },
  {
    icon: Clock,
    title: "Flash Sale แบบเรียลไทม์",
    body: "ตั้งเวลาเริ่ม-สิ้นสุด จำกัดจำนวน นับถอยหลังบนหน้าแรกกระตุ้นการตัดสินใจ",
  },
  {
    icon: Gift,
    title: "กงล้อและกล่องสุ่ม",
    body: "ตั้งโอกาสรางวัลได้ เปิดกล่องลุ้นของหายาก ใช้ดึงลูกค้ากลับมาโดยไม่ต้องเสียมาร์จิ้นมาก",
  },
  {
    icon: KeyRound,
    title: "สมาชิก + OAuth",
    body: "ล็อกอิน Discord Google Facebook เชื่อมหลายบัญชี โปรไฟล์ ประวัติซื้อ เคลม และกู้รหัสผ่าน",
  },
  {
    icon: Palette,
    title: "ปรับธีมได้ทุกจุด",
    body: "สีหลัก สีรอง โลโก้ แบนเนอร์ คารูเซล เมนู FAQ SEO — สลับมืด/สว่างได้จากฝั่งลูกค้า",
  },
  {
    icon: Gauge,
    title: "แดชบอร์ดมืออาชีพ",
    body: "ยอดวันนี้ รายเดือน สินค้าขายดี จัดการสมาชิก API Key และส่ง Webhook เข้า Discord",
  },
  {
    icon: ShieldCheck,
    title: "ปลอดภัยตั้งแต่ฐาน",
    body: "Prepared statement กัน SQL injection, CSRF, session, atomic transaction กันซื้อชนกัน",
  },
];

const v2 = [
  "ร้านค้า + สต๊อกอัตโนมัติ",
  "เติมเงินสลิป / พร้อมเพย์",
  "สินค้าดิจิทัลและกำหนดเอง",
  "ธีมมืด-สว่าง + สีหลัก",
  "ประวัติซื้อและเคลม",
  "อัปเดตสาย V2",
  "โฮสต์ + SSL รวม",
];

const v1 = [
  "ทุกอย่างใน V2",
  "OTP / SMS และ SMM Panel",
  "OAuth สามค่าย + เชื่อมบัญชี",
  "กงล้อ กล่องสุ่ม Flash Sale",
  "Webhook Discord เรียลไทม์",
  "อัปเดตสาย V1 ก่อนใคร",
  "ซัพพอร์ตเวร 24 ชม.",
];

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <LandingNav />
      <Hero />
      <Stats />
      <ProductTypes />
      <FeatureGrid />
      <ThemeLab />
      <Security />
      <Pricing />
      <Compare />
      <Faq />
      <Book />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <img
        src="/images/hero-bg.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--hero-wash),var(--bg))]" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="stagger-in space-y-6">
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
            ระบบเช่าร้านค้า · อัปเดตฟรีตลอดอายุเช่า
          </p>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            เปิดร้านดิจิทัล ที่ทำงานเองทั้งคืน
          </h1>
          <p className="max-w-xl text-base text-muted sm:text-lg">
            ตรวจสลิปอัตโนมัติ เติมเกม OTP และ SMM ในเว็บเดียว ปรับสีได้ทั้งร้าน
            ลูกค้าซื้อได้จากมือถือโดยไม่ต้องรอแอดมิน
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/shop">
                ทดลองร้านจริง
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="/#pricing">ดูแพ็กเกจ V1 / V2</a>
            </Button>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <li className="flex items-center gap-2">
              <Check className="size-4 text-ok" /> กันสลิปซ้ำ 3 ชั้น
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-4 text-ok" /> OAuth 3 ค่าย
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-4 text-ok" /> PWA พร้อมติดตั้ง
            </li>
          </ul>
        </div>
        <div className="relative">
          <img
            src="/images/hero-device.jpg"
            alt="ตัวอย่างหน้าร้านบนแล็ปท็อปในโหมดมืด"
            className="w-full rounded-xl object-cover shadow-border"
          />
          <div className="absolute right-4 bottom-4 left-4 rounded-lg bg-bg/80 p-3 backdrop-blur-sm sm:right-6 sm:bottom-6 sm:left-auto sm:w-56">
            <p className="text-xs text-muted">ยอดเดโมวันนี้</p>
            <p className="tabular text-xl font-medium">{formatBaht(12840)}</p>
            <p className="text-xs text-ok">+24 ออเดอร์ · สลิปผ่านทั้งหมด</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const items = [
    { k: "24 ชม.", v: "เติมเงินอัตโนมัติ" },
    { k: "2 ค่าย", v: "Thunder / Slip2Go" },
    { k: "6 ประเภท", v: "สินค้าในคลังเดียว" },
    { k: "1 ปุ่ม", v: "อัปเดตจาก GitHub" },
  ];
  return (
    <section className="border-y border-border">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-border sm:grid-cols-4">
        {items.map((s) => (
          <div key={s.v} className="bg-bg px-4 py-8 sm:px-6">
            <p className="tabular text-2xl font-medium tracking-tight">{s.k}</p>
            <p className="mt-1 text-sm text-muted">{s.v}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductTypes() {
  const tiles = [
    { img: "/images/cat-stream.jpg", title: "ไอดีดิจิทัล", body: "สตรีมมิ่งและแอป สต๊อกดึงอัตโนมัติ" },
    { img: "/images/cat-game.jpg", title: "เติมเกม / เติมเบอร์", body: "รองรับค่ายยอดนิยม ส่งเข้า UID" },
    { img: "/images/cat-otp.jpg", title: "OTP / Custom", body: "รับรหัสจากแอปดัง สร้างสินค้าเองไม่จำกัด" },
    { img: "/images/cat-box.jpg", title: "กิจกรรมร้าน", body: "กงล้อ กล่องสุ่ม โค้ดของขวัญ Flash Sale" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">คลังสินค้า</p>
      <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight">ขายได้หลายแบบ โดยไม่ต้องต่อปลั๊กอินเพิ่ม</h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <article key={t.title} className="overflow-hidden rounded-xl bg-surface shadow-border">
            <img src={t.img} alt="" className="h-40 w-full object-cover" />
            <div className="space-y-1 p-4">
              <h3 className="font-medium">{t.title}</h3>
              <p className="text-sm text-muted">{t.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">ระบบในตัว</p>
        <h2 className="mt-2 max-w-lg text-3xl font-semibold tracking-tight">ครบวงจรตั้งแต่เงินเข้าถึงของออก</h2>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featureBlocks.map((f) => (
            <article key={f.title} className="rounded-xl bg-surface p-5 shadow-border">
              <f.icon className="size-5 text-muted" />
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 overflow-hidden rounded-xl shadow-border">
          <img
            src="/images/dashboard.jpg"
            alt="แดชบอร์ดสรุปยอดขายบนจอมืด"
            className="h-56 w-full object-cover sm:h-80"
          />
        </div>
      </div>
    </section>
  );
}

function ThemeLab() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">โทนร้าน</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">ขาว–ดำชัด — สไตล์สตรีทแวร์</h2>
          <p className="mt-3 text-muted">
            หน้าร้านล็อกพื้นขาว ตัวอักษรดำ และปุ่มดำตั้งแต่เฟรมแรก ไม่กลับไปโทนครีม–ส้ม และไม่สลับมืดกลางคัน
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm text-accent-fg">ดำหลัก</span>
            <span className="inline-flex min-h-11 items-center rounded-md bg-surface px-4 text-sm text-fg shadow-border">การ์ดขาว</span>
            <span className="inline-flex min-h-11 items-center rounded-md bg-soft px-4 text-sm text-muted">พื้นเทาอ่อน</span>
          </div>
        </div>
        <div className="rounded-3xl bg-surface p-5 shadow-border">
          <p className="text-xs text-muted">พรีวิวปุ่มหลัก</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-bg px-4 py-3">
              <span>Void Gems 100</span>
              <span className="tabular font-medium">฿49</span>
            </div>
            <Button className="w-full rounded-full">ซื้อเลย</Button>
            <Button variant="secondary" className="w-full rounded-full">
              เติมเงิน
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Security() {
  const items = [
    { icon: Lock, title: "Prepared statement", body: "กัน SQL injection ทุกจุดที่รับอินพุต" },
    { icon: ShieldCheck, title: "CSRF + session", body: "คุกกี้เซสชันและการยืนยันฟอร์มครบ" },
    { icon: Sparkles, title: "Atomic buy", body: "ตัดสต๊อกกับตัดเงินในทรานแซกชันเดียว กันซื้อชน" },
    { icon: Webhook, title: "ล็อกแอดมิน", body: "ย้อนดูทุกการแก้ยอด สลับค่ายสลิป และตอบเคลม" },
    { icon: Smartphone, title: "Mobile first", body: "โหลดเร็วบนมือถือ พร้อม PWA ติดตั้งลงจอ" },
    { icon: Globe, title: "อัปเดตไม่ทับของสำคัญ", body: "ดึงจาก GitHub โดยคง .env และรูปอัปโหลด" },
  ];
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">เสถียรตอนคนซื้อพร้อมกัน</h2>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div key={i.title} className="flex gap-3 rounded-xl bg-surface p-4 shadow-border">
              <i.icon className="mt-0.5 size-5 shrink-0 text-muted" />
              <div>
                <p className="font-medium">{i.title}</p>
                <p className="mt-1 text-sm text-muted">{i.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const [yearly, setYearly] = useState(false);
  const v2Price = yearly ? 8900 : 890;
  const v1Price = yearly ? 15900 : 1590;
  return (
    <section id="pricing" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">แพ็กเกจ</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">V2 ทั่วไป · V1 พรีเมียม</h2>
          </div>
          <div className="flex rounded-md bg-surface p-1 shadow-border">
            <button
              type="button"
              className={cn("min-h-10 rounded-sm px-4 text-sm", !yearly && "bg-accent text-accent-fg")}
              onClick={() => setYearly(false)}
            >
              รายเดือน
            </button>
            <button
              type="button"
              className={cn("min-h-10 rounded-sm px-4 text-sm", yearly && "bg-accent text-accent-fg")}
              onClick={() => setYearly(true)}
            >
              รายปี · ฟรี 2 เดือน
            </button>
          </div>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <PriceCard
            name="V2 ทั่วไป"
            price={v2Price}
            yearly={yearly}
            items={v2}
            cta="จอง V2"
            featured={false}
          />
          <PriceCard
            name="V1 พรีเมียม"
            price={v1Price}
            yearly={yearly}
            items={v1}
            cta="จอง V1 · เดือนแรกครึ่งราคา"
            featured
          />
        </div>
        <p className="mt-6 text-sm text-subtle">
          ราคาไม่รวมโดเมนภายนอก · ย้ายร้านเดิมไม่มีค่าติดตั้ง · ยกเลิกได้ทุกเมื่อเมื่อจบรอบ
        </p>
      </div>
    </section>
  );
}

function PriceCard({
  name,
  price,
  yearly,
  items,
  cta,
  featured,
}: {
  name: string;
  price: number;
  yearly: boolean;
  items: string[];
  cta: string;
  featured: boolean;
}) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-xl p-6 shadow-border",
        featured ? "bg-fg text-bg" : "bg-surface text-fg",
      )}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-medium">{name}</h3>
        {featured ? <span className="text-xs opacity-70">แนะนำ</span> : null}
      </div>
      <p className="mt-4 tabular text-4xl font-semibold tracking-tight">{formatBaht(price)}</p>
      <p className={cn("text-sm", featured ? "opacity-70" : "text-muted")}>
        {yearly ? "ต่อปี" : "ต่อเดือน"}
      </p>
      <ul className="mt-6 flex-1 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0" />
            {i}
          </li>
        ))}
      </ul>
      <Button
        asChild
        className={cn("mt-8 w-full", featured && "bg-bg text-fg hover:opacity-90")}
        variant={featured ? "primary" : "secondary"}
      >
        <a href="/#book">{cta}</a>
      </Button>
    </article>
  );
}

function Compare() {
  return (
    <section id="compare" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">เทียบกับทางเลือกที่ร้านส่วนใหญ่ใช้อยู่</h2>
        <div className="mt-8 overflow-x-auto rounded-xl shadow-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">หัวข้อ</th>
                <th className="px-4 py-3 font-medium">สคริปต์ราคาถูก</th>
                <th className="px-4 py-3 font-medium">จ้างทำเอง</th>
                <th className="px-4 py-3 font-medium">VELT</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{row.feature}</td>
                  <td className="px-4 py-3 text-muted">{row.cheap}</td>
                  <td className="px-4 py-3 text-muted">{row.diy}</td>
                  <td className="px-4 py-3">{row.velt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">คำถามจากคนที่จะเช่า</h2>
        <div className="mt-8 divide-y divide-border rounded-xl bg-surface shadow-border">
          {faqs.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="font-medium">{item.q}</span>
                  <span className="text-muted">{isOpen ? "–" : "+"}</span>
                </button>
                <div
                  className={cn(
                    "grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <p className="overflow-hidden px-5 pb-4 text-sm leading-relaxed text-muted">{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Book() {
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const payload = {
      shop: data.get("shop"),
      contact: data.get("contact"),
      pack: data.get("pack"),
      domain: data.get("domain"),
      note: data.get("note"),
      at: Date.now(),
    };
    const prev = JSON.parse(localStorage.getItem("velt-leads") || "[]") as unknown[];
    localStorage.setItem("velt-leads", JSON.stringify([payload, ...prev]));
    setSent(true);
    toast.success("รับคิวแล้ว ทีมงานจะทักไลน์ภายใน 2 ชั่วโมง");
  }

  return (
    <section id="book" className="scroll-mt-20 border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">จองคิวเปิดร้าน</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">ส่งรายละเอียดมา เราจัดร้านให้พร้อมขาย</h2>
          <p className="mt-3 text-muted">
            ไม่มีการชำระเงินบนหน้านี้ ทีมงานส่งลิงก์โอนและผูกโดเมนให้หลังยืนยันคิว ทดลองร้านเดโมได้ก่อนตัดสินใจ
          </p>
          <div className="mt-8 overflow-hidden rounded-xl shadow-border">
            <img src="/images/pay-qr.jpg" alt="ตัวอย่างหน้าจอพร้อมเพย์บนมือถือ" className="h-64 w-full object-cover" />
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-surface p-5 shadow-border sm:p-6">
          {sent ? (
            <div className="space-y-3 py-8 text-center">
              <CreditCard className="mx-auto size-8 text-ok" />
              <p className="text-lg font-medium">รับคิวแล้ว</p>
              <p className="text-sm text-muted">เช็กไลน์ @veltshop ภายใน 2 ชั่วโมงในเวลาทำการ</p>
              <Button type="button" variant="secondary" onClick={() => setSent(false)}>
                ส่งอีกใบ
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="shop">ชื่อร้าน</Label>
                <Input id="shop" name="shop" required placeholder="เช่น ร้านต้นเกม" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact">ไลน์หรือเบอร์โทร</Label>
                <Input id="contact" name="contact" required placeholder="@yourline" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pack">แพ็กเกจ</Label>
                <select
                  id="pack"
                  name="pack"
                  className="h-11 w-full rounded-md bg-bg px-3 text-sm shadow-border outline-none"
                  defaultValue="v1"
                >
                  <option value="v1">V1 พรีเมียม</option>
                  <option value="v2">V2 ทั่วไป</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="domain">โดเมนที่ต้องการ</Label>
                <Input id="domain" name="domain" placeholder="shop.yourdomain.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note">รายละเอียดเพิ่ม</Label>
                <Textarea id="note" name="note" placeholder="ย้ายสต๊อกจากร้านเดิม / ต้องการสีแบรนด์" />
              </div>
              <Button type="submit" className="w-full">
                ส่งคิวเปิดร้าน
              </Button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
