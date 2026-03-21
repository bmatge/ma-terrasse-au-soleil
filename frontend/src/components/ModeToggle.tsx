import { useTranslation } from "react-i18next";
import { useTheme, themes } from "../contexts/ThemeContext";
import { SunIcon, ShadeIcon } from "./Icons";
import { F } from "../lib/constants";

export default function ModeToggle() {
  const { t } = useTranslation();
  const { mode, setMode, th } = useTheme();

  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 18px", borderRadius: 100, border: "none", fontSize: 13,
    fontWeight: active ? 600 : 400, fontFamily: F, cursor: "pointer",
    background: active ? th.accent : th.border, color: active ? "#FFF" : th.textSoft,
    transition: "all 0.2s", whiteSpace: "nowrap",
  });

  return (
    <div style={{ display: "flex", gap: 3, background: th.border, borderRadius: 100, padding: 3 }}>
      <button onClick={() => setMode("sun")} style={{ ...pillStyle(mode === "sun"), display: "flex", alignItems: "center", gap: 6, background: mode === "sun" ? themes.sun.gradient : "transparent" }}>
        <SunIcon size={14} color={mode === "sun" ? "#FFF" : themes.sun.textMuted} /> {t("mode.sun")}
      </button>
      <button onClick={() => setMode("shade")} style={{ ...pillStyle(mode === "shade"), display: "flex", alignItems: "center", gap: 6, background: mode === "shade" ? themes.shade.gradient : "transparent" }}>
        <ShadeIcon size={14} color={mode === "shade" ? "#FFF" : themes.shade.textMuted} /> {t("mode.shade")}
      </button>
    </div>
  );
}
