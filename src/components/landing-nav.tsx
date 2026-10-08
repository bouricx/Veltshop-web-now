import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/rent#features", label: "คุณสมบัติ" },
  { href: "/rent#pricing", label: "ราคา" },
  { href: "/rent#compare", label: "เปรียบเทียบ" },
  { href: "/rent#faq", label: "FAQ" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandMark />
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-fg">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
            <Link to="/shop">ทดลองร้าน</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <a href="/rent#book">จองแพ็กเกจ</a>
          </Button>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-md md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="เมนู"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <div className={cn("border-t border-border md:hidden", open ? "block" : "hidden")}>
        <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-3 text-sm text-muted hover:bg-surface hover:text-fg"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/shop"
            className="rounded-md px-3 py-3 text-sm hover:bg-surface"
            onClick={() => setOpen(false)}
          >
            ทดลองร้าน
          </Link>
          <a href="/#book" className="rounded-md px-3 py-3 text-sm hover:bg-surface" onClick={() => setOpen(false)}>
            จองแพ็กเกจ
          </a>
        </nav>
      </div>
    </header>
  );
}
