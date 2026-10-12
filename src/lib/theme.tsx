import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
export type Mode = "dark" | "light";
type ThemeCtx = { mode: Mode; setMode: (mode: Mode) => void; toggleMode: () => void };
const ThemeContext = createContext<ThemeCtx | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("light");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      setMode(
        JSON.parse(localStorage.getItem("velt-theme") || "{}").mode === "dark" ? "dark" : "light",
      );
      localStorage.removeItem("veltshop-theme");
    } catch {
      /* Storage is optional. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    try {
      localStorage.setItem("velt-theme", JSON.stringify({ mode }));
    } catch {
      /* Keep in-memory preference. */
    }
  }, [mode, ready]);
  const value = useMemo(
    () => ({ mode, setMode, toggleMode: () => setMode((m) => (m === "dark" ? "light" : "dark")) }),
    [mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("ThemeProvider is required");
  return value;
}
