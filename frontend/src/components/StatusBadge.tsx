import { useTranslation } from "react-i18next";
import { F, STATUS_CONFIG } from "../lib/constants";

export default function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ombre;
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 100, fontFamily: F,
      color: cfg.color, background: cfg.icon === "sun" ? "#FEF3C7" : "#F3F4F6",
    }}>
      {t(cfg.labelKey)}
    </span>
  );
}
