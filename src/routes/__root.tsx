import { SiteRuntime } from "@/lib/shop/site-state";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "VeltShop.com — ร้านแอปและบริการดิจิทัล" },
      {
        name: "description",
        content: "VeltShop.com ร้านแอป บริการดิจิทัล เติมเกม OTP และ SMM ตรวจสลิปอัตโนมัติ",
      },
      { name: "theme-color", content: "#f6f6f4" },
      { name: "color-scheme", content: "light" },
      {
        name: "keywords",
        content: "เช่าร้านค้า, เติมเกม, ตรวจสลิป, True Wallet, พร้อมเพย์, OTP, SMM",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: Root,
});

function Root() {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      data-shop="shop"
      data-theme="light"
      data-accent="ice"
      style={{ colorScheme: "light" }}
    >
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg antialiased">
        <PreviewHostBridge />
        <SiteRuntime />
        <AuthProvider>
          <ThemeProvider>
            <Outlet />
            <Toaster
              position="top-center"
              toastOptions={{
                className: "font-sans",
                style: {
                  background: "var(--surface)",
                  color: "var(--fg)",
                  border: "1px solid var(--border)",
                },
              }}
            />
          </ThemeProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
