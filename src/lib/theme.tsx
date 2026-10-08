import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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

function shopLocked() {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-shop");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("light");
  const [accent, setAccentState] = useState<Accent>("ice");

  useEffect(() => {
    const stored = readStored();
    setModeState(stored.mode);
    setAccentState(stored.accent);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const locked = shopLocked();
    root.dataset.theme = locked ? "light" : mode;
    root.dataset.accent = accent;
    root.style.colorScheme = locked ? "light" : mode;
    localStorage.setItem(KEY, JSON.stringify({ mode, accent }));
  }, [mode, accent]);

  const value = useMemo<ThemeCtx>(
    () => ({
      mode: shopLocked() ? "light" : mode,
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
