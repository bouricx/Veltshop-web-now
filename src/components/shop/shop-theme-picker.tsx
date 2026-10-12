import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
export function ShopThemePicker() {
  const { mode, toggleMode } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={mode === "dark" ? "เปลี่ยนเป็นธีมขาว" : "เปลี่ยนเป็นธีมดำ"}
      aria-pressed={mode === "dark"}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2"
    >
      {mode === "dark" ? (
        <Moon className="size-4" aria-hidden="true" />
      ) : (
        <Sun className="size-4" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{mode === "dark" ? "ธีมดำ" : "ธีมขาว"}</span>
    </button>
  );
}
