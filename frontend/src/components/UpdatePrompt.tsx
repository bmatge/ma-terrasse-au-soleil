import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { usePWAUpdate } from "../hooks/usePWAUpdate";

export default function UpdatePrompt() {
  const { needRefresh, offlineReady, updateSW, dismiss } = usePWAUpdate();
  const { t } = useTranslation();

  // Auto-dismiss "offline ready" after 3s
  useEffect(() => {
    if (offlineReady) {
      const t = setTimeout(dismiss, 3000);
      return () => clearTimeout(t);
    }
  }, [offlineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "#1C1917",
        color: "#fff",
        borderRadius: 12,
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,.25)",
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontSize: 14,
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <span>{needRefresh ? t("pwa.newVersion") : t("pwa.offlineReady")}</span>
      {needRefresh && (
        <button
          onClick={updateSW}
          style={{
            background: "#f59e0b",
            color: "#1C1917",
            border: "none",
            borderRadius: 8,
            padding: "6px 14px",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          {t("pwa.update")}
        </button>
      )}
      <button
        onClick={dismiss}
        style={{
          background: "transparent",
          border: "none",
          color: "#aaa",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          padding: 0,
        }}
        aria-label={t("pwa.close")}
      >
        ×
      </button>
    </div>
  );
}
