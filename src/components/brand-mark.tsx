import { useSiteConfiguration } from "@/lib/shop/site-state";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function BrandMark({ className, to = "/" }: { className?: string; to?: string }) {
  const { value } = useSiteConfiguration();
  return (
    <Link to={to} className={cn("inline-flex items-center", className)} aria-label={value.name}>
      <img
        src={value.logo || "/brand/logo-primary.png"}
        alt={value.name}
        className="h-8 w-auto sm:h-10"
      />
    </Link>
  );
}
