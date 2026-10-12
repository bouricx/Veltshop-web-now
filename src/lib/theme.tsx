import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Mode = "dark" | "light";
export type Accent = "ice" | "teal" | "slate";

type ThemeCtx = {
  mode: Mode;
  accent: Accent;
  setMode: (m: Mode) => void;
  setAccent: (a: Accent) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);
const KEY = "velt-theme";

function readStored(): { mode: Mode; accent: Accent } {
  if (typeof window === "undefined") return { mode: "light", accent: "ice" };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { mode: "light", accent: "ice" };
    const parsed = JSON.parse(raw) as { mode?: Mode; accent?: Accent };
    return {
      mode: parsed.mode === "dark" ? "dark" : "light",
      accent: parsed.accent === "teal" || parsed.accent === "slate" ? parsed.accent : "ice",
    };
  } catch {
    return { mode: "light", accent: "ice" };
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("light");
  const [accent, setAccentState] = useState<Accent>("ice");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStored();
    setModeState(stored.mode);
    setAccentState(stored.accent);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.dataset.accent = accent;
    root.style.colorScheme = mode;
    try {
      localStorage.setItem(KEY, JSON.stringify({ mode, accent }));
    } catch {
      /* Theme remains usable when storage is blocked. */
    }
  }, [mode, accent, ready]);

  const value = useMemo<ThemeCtx>(
    () => ({
      mode,
      accent,
      setMode: setModeState,
      setAccent: setAccentState,
      toggleMode: () => setModeState((m) => (m === "dark" ? "light" : "dark")),
    }),
    [mode, accent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
