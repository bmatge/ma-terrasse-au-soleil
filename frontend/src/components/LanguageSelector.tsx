import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES } from "../i18n";

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = LANGUAGES.find((l) => i18n.language.startsWith(l.code)) || LANGUAGES[0];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none",
          border: "1px solid #D6D3D1",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: 8,
          lineHeight: 1.4,
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          color: "#44403C",
          letterSpacing: "0.5px",
        }}
        aria-label="Language"
        title={current.label}
      >
        {current.code.toUpperCase()}
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
              onClick={() => {
                i18n.changeLanguage(lang.code);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "10px 16px",
                border: "none",
                background: i18n.language.startsWith(lang.code) ? "#FEF3C7" : "transparent",
                cursor: "pointer",
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
    </div>
  );
}
