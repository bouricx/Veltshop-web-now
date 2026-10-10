import { useEffect, useState } from "react";
import { publicContent, memberContent } from "@/lib/shop/operations";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
export function StoreContent() {
  const { user } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const [content, setContent] = useState<Awaited<ReturnType<typeof publicContent>>>([]),
    [index, setIndex] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () =>
      void (signedIn ? memberContent() : publicContent()).then((c) => {
        if (active) setContent(c);
      });
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [signedIn, user?.id]);
  const banners = content.filter((c) => c.kind === "banner");
  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), 6000);
    return () => clearInterval(timer);
  }, [banners.length]);
  const banner = banners[index % banners.length];
  return (
    <div className="mb-5 space-y-3">
      {banner ? (
        <section
          aria-roledescription="carousel"
          aria-label="โปรโมชั่น"
          className="relative overflow-hidden rounded-2xl bg-surface"
        >
          {banner.link ? (
            <a href={banner.link}>
              {banner.image ? (
                <img
                  src={banner.image}
                  alt={banner.title}
                  className="aspect-[16/5] w-full object-cover"
                />
              ) : (
                <p className="p-6 font-medium">{banner.title}</p>
              )}
            </a>
          ) : banner.image ? (
            <img
              src={banner.image}
              alt={banner.title}
              className="aspect-[16/5] w-full object-cover"
            />
          ) : (
            <p className="p-6 font-medium">{banner.title}</p>
          )}
          <div className="flex items-center justify-between p-2">
            <Button
              size="sm"
              variant="secondary"
              aria-label="โปรโมชั่นก่อนหน้า"
              onClick={() => setIndex((i) => (i + banners.length - 1) % banners.length)}
            >
              ←
            </Button>
            <p className="text-xs">{banner.title}</p>
            <Button
              size="sm"
              variant="secondary"
              aria-label="โปรโมชั่นถัดไป"
              onClick={() => setIndex((i) => (i + 1) % banners.length)}
            >
              →
            </Button>
          </div>
        </section>
      ) : null}
      {content
        .filter((c) => c.kind === "announcement")
        .map((c) => (
          <section key={c.id} className="rounded-xl border border-border bg-surface p-4">
            <h2 className="font-medium">{c.title}</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{c.body}</p>
          </section>
        ))}
    </div>
  );
}
