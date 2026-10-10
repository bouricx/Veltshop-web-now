import { useEffect } from "react";
import { create } from "zustand";
import { getSiteConfiguration } from "./operations";
import { defaultConfiguration, type SiteConfiguration } from "./settings-schema";
export const useSiteConfiguration = create<{ value: SiteConfiguration; loaded: boolean }>(() => ({
  value: defaultConfiguration,
  loaded: false,
}));
export function SiteRuntime() {
  useEffect(() => {
    let active = true;
    const load = () =>
      void getSiteConfiguration()
        .then((value) => {
          if (!active) return;
          useSiteConfiguration.setState({ value, loaded: true });
          if (!location.pathname.startsWith("/shop/product/"))
            document.title = value.name + " — " + value.description;
          document.documentElement.style.setProperty("--accent", value.primary);
          document.documentElement.style.setProperty("--secondary", value.secondary);
          const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (icon) icon.href = value.favicon;
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  return null;
}
