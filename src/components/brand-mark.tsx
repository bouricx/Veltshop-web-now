import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function BrandMark({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("inline-flex items-center", className)} aria-label="VeltShop.com">
      <img
        src="/brand/logo-primary.png"
        alt="VeltShop.com"
        className="h-8 w-auto sm:h-10"
      />
    </Link>
  );
}
