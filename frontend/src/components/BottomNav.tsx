import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { F } from "../lib/constants";

type Page = "home" | "search" | "results" | "detail" | "favorites" | "blog" | "contact";

const NAV_ICONS: Record<string, (color: string) => React.ReactNode> = {
  home: (c) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  ),
  search: (c) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  ),
  favorites: (c) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  contact: (c) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="2,4 12,13 22,4" />
    </svg>
  ),
  blog: (c) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <line x1="7" y1="8" x2="17" y2="8" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="7" y1="16" x2="13" y2="16" />
    </svg>
  ),
};

interface BottomNavProps {
  page: Page;
  navigate: (dest: Page) => void;
}

export default function BottomNav({ page, navigate }: BottomNavProps) {
  const { t } = useTranslation();
  const { th } = useTheme();

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: th.bgCard, borderTop: `1px solid ${th.border}`,
      boxShadow: `0 -2px 12px ${th.shadow}`,
      display: "flex", justifyContent: "center",
    }}>
      <div style={{ display: "flex", maxWidth: 860, width: "100%" }}>
        {([
          { key: "home" as Page, label: t("nav.home") },
          { key: "search" as Page, label: t("nav.search") },
          { key: "favorites" as Page, label: t("nav.favorites") },
          { key: "contact" as Page, label: t("nav.contact") },
          { key: "blog" as Page, label: t("nav.blog") },
        ]).map(({ key, label }) => {
          const active = page === key;
          const color = active ? th.accent : th.textMuted;
          return (
            <button
              key={key}
              onClick={() => navigate(key)}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: "8px 0 10px", background: "none", border: "none", cursor: "pointer",
                color, fontFamily: F, fontSize: 10, fontWeight: active ? 600 : 400,
                transition: "color 0.2s, opacity 0.2s",
              }}
            >
              {NAV_ICONS[key]?.(color)}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
