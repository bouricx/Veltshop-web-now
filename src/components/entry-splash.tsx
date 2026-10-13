import { useEffect, useState, type CSSProperties } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useSiteConfiguration } from "@/lib/shop/site-state";

// Original single-line lettering, drawn as paths so no font download is needed.
const letters = [
  "M4 8 24 64 44 8",
  "M42 8H6V64H42M6 35H35",
  "M6 8V64H43",
  "M3 8H47M25 8V64",
  "M42 14C35 4 7 4 7 22C7 40 43 29 43 49C43 69 14 70 5 58",
  "M5 8V64M45 8V64M5 35H45",
  "M25 7C11 7 5 16 5 36S11 65 25 65S45 56 45 36S39 7 25 7Z",
  "M6 64V8H26C48 8 48 37 26 37H6",
];

/** An entry animation only: never controls auth, data readiness or navigation. */
export function EntrySplash() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [entryPath] = useState(pathname);
  const [phase, setPhase] = useState<"loading" | "leaving" | "done">("loading");
  const enabled =
    entryPath === "/" ||
    entryPath === "/shop" ||
    entryPath === "/shop/" ||
    entryPath === "/shop/catalog" ||
    entryPath.startsWith("/shop/product/");

  useEffect(() => {
    if (!enabled) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    let finishing = false;
    let leaveTimer: ReturnType<typeof setTimeout> | undefined;
    let removeTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (finishing) return;
      finishing = true;
      // Give the wordmark one short drawing pass; never wait on images or login.
      const remaining = Math.max(0, (reducedMotion ? 0 : 1100) - (performance.now() - started));
      leaveTimer = setTimeout(() => {
        setPhase("leaving");
        removeTimer = setTimeout(() => setPhase("done"), reducedMotion ? 0 : 240);
      }, remaining);
    };
    const dismiss = () => {
      finishing = true;
      clearTimeout(leaveTimer);
      clearTimeout(removeTimer);
      setPhase("done");
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab" || event.key === "Escape") dismiss();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) dismiss();
    };
    const unsubscribe = useSiteConfiguration.subscribe((state) => {
      if (state.loaded) finish();
    });
    if (useSiteConfiguration.getState().loaded || reducedMotion) finish();
    // A failed settings request must never leave a cover over the shop.
    const deadline = setTimeout(finish, 2800);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("click", dismiss, { once: true });
    return () => {
      unsubscribe();
      clearTimeout(deadline);
      clearTimeout(leaveTimer);
      clearTimeout(removeTimer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("click", dismiss);
    };
  }, [enabled]);

  if (!enabled || pathname !== entryPath || phase === "done") return null;

  return (
    <>
      <div
        className="entry-splash"
        data-entry-splash
        data-phase={phase}
        role="status"
        aria-live="polite"
      >
        <div className="entry-splash-content">
          <svg className="entry-splash-wordmark" viewBox="0 0 484 76" aria-hidden="true">
            {letters.map((d, index) => (
              <path
                key={index}
                d={d}
                transform={`translate(${index * 62} 0)`}
                pathLength={100}
                style={{ "--letter": index } as CSSProperties}
              />
            ))}
          </svg>
          <span className="entry-splash-caption">กำลังเปิดหน้าร้าน</span>
          <span className="sr-only">Veltshop</span>
        </div>
      </div>
      <noscript>
        <style>{`.entry-splash{display:none!important}`}</style>
      </noscript>
    </>
  );
}
