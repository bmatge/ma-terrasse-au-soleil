import { useTheme } from "../contexts/ThemeContext";
import { BackIcon } from "./Icons";
import ModeToggle from "./ModeToggle";
import LanguageSelector from "./LanguageSelector";
import { F } from "../lib/constants";

interface NavProps {
  back?: boolean;
  title: string;
  onBack?: () => void;
}

export default function Nav({ back, title, onBack }: NavProps) {
  const { mode, th } = useTheme();

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", position: "sticky", top: 0, zIndex: 10, background: th.bg, borderBottom: `1px solid ${th.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {back && <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: th.accent }}><BackIcon /></button>}
        <span style={{ fontSize: 22, lineHeight: 1 }}>{mode === "sun" ? "\u2600\uFE0F" : "\u2601\uFE0F"}</span>
        {title && <span style={{ fontFamily: F, fontWeight: 600, fontSize: 16, color: th.text }}>{title}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <ModeToggle />
        <LanguageSelector />
      </div>
    </div>
  );
}
