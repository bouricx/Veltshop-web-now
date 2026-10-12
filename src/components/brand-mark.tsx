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
        width={160}
        height={56}
        decoding="async"
        className="brand-logo h-10 w-28 rounded-xl bg-white p-1.5 object-contain sm:h-12 sm:w-36"
      />
    </Link>
  );
}
