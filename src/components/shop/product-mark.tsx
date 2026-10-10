import { contrastText } from "@/lib/shop/presentation";
import { cn } from "@/lib/utils";

export function ProductMark({
  name,
  color,
  className,
}: {
  name: string;
  color?: string;
  className?: string;
}) {
  const markColor = color || "#18181b";
  const letter = Array.from(name.trim())[0]?.toLocaleUpperCase("th") || "?";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-xl font-bold leading-none shadow-sm",
        className,
      )}
      style={{ backgroundColor: markColor, color: contrastText(markColor) }}
    >
      {letter}
    </span>
  );
}
