import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../i18n";

const UNDO_LABELS: Record<string, string> = {
  fr: "Annuler",
  en: "Undo",
  es: "Deshacer",
  de: "Rückgängig",
  ja: "元に戻す",
  zh: "撤销",
};

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [previousLang, setPreviousLang] = useState<string | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    return () => { if (undoTimer.current) clearTimeout(undoTimer.current); };
  }, []);

  const handleChange = useCallback(async (code: string) => {
    const prev = i18n.language;
    setOpen(false);
    setSwitching(true);
    await i18n.changeLanguage(code);
    setSwitching(false);
    setPreviousLang(prev);
    setShowUndo(true);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setShowUndo(false), 5000);
  }, [i18n]);

  const handleUndo = useCallback(async () => {
    if (!previousLang) return;
    setSwitching(true);
    await i18n.changeLanguage(previousLang);
    setSwitching(false);
    setShowUndo(false);
    setPreviousLang(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, [i18n, previousLang]);

  const current = LANGUAGES.find((l) => i18n.language.startsWith(l.code)) || LANGUAGES[0];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => !switching && setOpen(!open)}
        disabled={switching}
        style={{
          background: "none",
          border: "1px solid #D6D3D1",
          cursor: switching ? "wait" : "pointer",
          fontSize: 13,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: 8,
          lineHeight: 1.4,
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          color: "#44403C",
          letterSpacing: "0.5px",
          opacity: switching ? 0.5 : 1,
          transition: "opacity 0.2s",
        }}
        aria-label="Language"
        title={current.label}
      >
        {switching ? "..." : current.code.toUpperCase()}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            zIndex: 100,
            background: "#FFF",
            borderRadius: 12,
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
            border: "1px solid #E7E0D5",
            marginTop: 4,
            minWidth: 150,
            overflow: "hidden",
          }}
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleChange(lang.code)}
              disabled={i18n.language.startsWith(lang.code)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 16px",
                border: "none",
                background: i18n.language.startsWith(lang.code) ? "#FEF3C7" : "transparent",
                cursor: i18n.language.startsWith(lang.code) ? "default" : "pointer",
                fontSize: 14,
                fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                color: "#1C1917",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#78716C", minWidth: 24 }}>{lang.code.toUpperCase()}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}

      {showUndo && previousLang && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            zIndex: 100,
            marginTop: 4,
            background: "#1C1917",
            color: "#FFF",
            borderRadius: 10,
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            whiteSpace: "nowrap",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <span style={{ opacity: 0.8 }}>
            {LANGUAGES.find((l) => i18n.language.startsWith(l.code))?.label}
          </span>
          <button
            onClick={handleUndo}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "#FDE68A",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 6,
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            }}
          >
            {UNDO_LABELS[i18n.language] ?? "Undo"}
          </button>
        </div>
      )}
    </div>
  );
}
