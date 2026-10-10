import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";

export type ShopTheme = "ink" | "ocean" | "violet" | "forest";

const themes: { id: ShopTheme; name: string; color: string }[] = [
  { id: "ink", name: "ดำขาว", color: "#111111" },
  { id: "ocean", name: "น้ำเงิน", color: "#1d4ed8" },
  { id: "violet", name: "ม่วง", color: "#6d28d9" },
  { id: "forest", name: "เขียว", color: "#047857" },
];

export function ShopThemePicker({
  value,
  onChange,
}: {
  value: ShopTheme;
  onChange: (theme: ShopTheme) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = themes.find((theme) => theme.id === value) ?? themes[0];

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="relative" data-shop-theme-picker ref={rootRef}>
      <button
        type="button"
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        aria-label={`เลือกสีธีม ปัจจุบัน ${selected.name}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <Palette className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">สีธีม</span>
        <span
          className="size-3 rounded-full ring-1 ring-black/15"
          style={{ background: selected.color }}
        />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="เลือกสีธีมร้าน"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-border bg-surface p-3 shadow-xl"
        >
          <p className="px-1 text-sm font-semibold">สีเน้นของร้าน</p>
          <p className="px-1 pt-1 text-xs text-muted">พื้นหลังยังคงโทนขาวดำ</p>
          <div className="mt-2 grid gap-1">
            {themes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className="flex min-h-10 items-center gap-3 rounded-xl px-2 text-sm text-fg hover:bg-surface-2"
                aria-pressed={theme.id === value}
                onClick={() => {
                  onChange(theme.id);
                  setOpen(false);
                }}
              >
                <span
                  className="size-4 rounded-full ring-1 ring-black/15"
                  style={{ background: theme.color }}
                />
                <span className="flex-1 text-left">{theme.name}</span>
                {theme.id === value ? <Check className="size-4" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
