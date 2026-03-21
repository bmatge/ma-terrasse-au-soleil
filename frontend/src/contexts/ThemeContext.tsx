import { createContext, useContext, useState, type ReactNode } from "react";

export type Mode = "sun" | "shade";

export const themes = {
  sun: {
    // contrast ratios on #FFFFFF / #FFFBF2 bg
    bg: "#FFFBF2", bgCard: "#FFFFFF",
    accent: "#B45309",        // amber-700  — 5.1:1 on white
    accentLight: "#FEF3C7",
    accentDark: "#92400E",    // amber-900  — 8.8:1 on white
    text: "#1C1917",          // stone-900  — 18:1
    textSoft: "#57534E",      // stone-600  — 6.5:1
    textMuted: "#78716C",     // stone-500  — 4.8:1
    border: "#E7E0D5",
    badge: "#FDE68A", badgeText: "#78350F",  // 7.1:1
    gradient: "linear-gradient(135deg, #B45309 0%, #92400E 100%)",  // white text 5.1:1
    shadow: "rgba(180,83,9,0.15)",
  },
  shade: {
    // contrast ratios on #FFFFFF / #F0F4F8 bg
    bg: "#F0F4F8", bgCard: "#FFFFFF",
    accent: "#2563EB",        // blue-600   — 5.3:1 on white
    accentLight: "#DBEAFE",
    accentDark: "#1D4ED8",    // blue-700   — 7.0:1 on white
    text: "#1E293B",          // slate-900  — 14:1
    textSoft: "#475569",      // slate-600  — 6.6:1
    textMuted: "#64748B",     // slate-500  — 4.2:1
    border: "#CBD5E1",
    badge: "#BFDBFE", badgeText: "#1E40AF",  // 6.2:1
    gradient: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",  // white text 5.3:1
    shadow: "rgba(29,78,216,0.15)",
  },
};

export type Theme = typeof themes.sun;

interface ThemeContextValue {
  mode: Mode;
  setMode: (m: Mode) => void;
  th: Theme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("sun");
  const th = themes[mode];
  return (
    <ThemeContext.Provider value={{ mode, setMode, th }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
