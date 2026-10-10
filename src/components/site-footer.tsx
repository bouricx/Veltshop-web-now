import { useSiteConfiguration } from "@/lib/shop/site-state";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/brand-mark";

export function SiteFooter() {
  const { value: site } = useSiteConfiguration();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:justify-between">
        <div className="max-w-xs space-y-3">
          <BrandMark />
          <p className="text-sm text-muted">
            ระบบเช่าร้านค้าดิจิทัลสำหรับเติมเกม OTP และ SMM อัปเดตฟรีตลอดอายุเช่า
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
          <div className="space-y-2">
            <p className="font-medium text-fg">ผลิตภัณฑ์</p>
            <Link to="/" hash="features" className="block text-muted hover:text-fg">
              คุณสมบัติ
            </Link>
            <Link to="/" hash="pricing" className="block text-muted hover:text-fg">
              ราคา
            </Link>
            <Link to="/shop" className="block text-muted hover:text-fg">
              ทดลองร้าน
            </Link>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-fg">ร้านเดโม</p>
            <Link to="/shop/topup" className="block text-muted hover:text-fg">
              เติมเงิน
            </Link>
            <Link to="/shop/wheel" className="block text-muted hover:text-fg">
              กงล้อนำโชค
            </Link>
            <Link to="/admin" className="block text-muted hover:text-fg">
              แอดมิน
            </Link>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-fg">ติดต่อ</p>
            <a
              href={site.discord}
              target="_blank"
              rel="noreferrer"
              className="block text-muted hover:text-fg"
            >
              Discord
            </a>
            <a
              href={site.facebook}
              target="_blank"
              rel="noreferrer"
              className="block text-muted hover:text-fg"
            >
              Facebook
            </a>

            <p className="text-muted">ทุกวัน 09:00–24:00</p>
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-subtle sm:px-6">
          © {new Date().getFullYear()} VeltShop.com · เดโมไม่มีการชำระเงินจริง
        </p>
      </div>
    </footer>
  );
}
