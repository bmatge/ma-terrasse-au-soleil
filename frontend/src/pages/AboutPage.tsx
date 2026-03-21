import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import Nav from "../components/Nav";
import BottomNav from "../components/BottomNav";
import { F } from "../lib/constants";

export default function AboutPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { th } = useTheme();

  const section = (title: string, content: React.ReactNode) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: F, fontWeight: 700, fontSize: 15, color: th.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: F, fontSize: 14, color: th.textSoft, lineHeight: 1.6 }}>{content}</div>
    </div>
  );

  const wrap: React.CSSProperties = { minHeight: "100vh", background: th.bg, fontFamily: F, maxWidth: 860, margin: "0 auto", paddingBottom: 70 };

  return (
    <div style={wrap}>
      <Nav back title={t("about.title")} onBack={() => navigate(-1)} />
      <div style={{ padding: "20px 24px 100px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>☀️</div>
          <div style={{ fontFamily: F, fontWeight: 700, fontSize: 20, color: th.text }}>Au Soleil</div>
          <div style={{ fontFamily: F, fontSize: 13, color: th.textMuted, marginTop: 4 }}>{t("about.description")}</div>
        </div>

        {section(t("about.howTitle"), <>
          {t("about.how1")}<br />
          {t("about.how2")}<br />
          {t("about.how3")}<br />
          {t("about.how4")}
        </>)}

        {section(t("about.dataTitle"), <>
          {t("about.data1")}<br />
          {t("about.data2")}<br />
          {t("about.data3")}<br />
          {t("about.data4")}
        </>)}

        <div style={{ textAlign: "center", fontFamily: F, fontSize: 13, color: th.textMuted, marginTop: 20 }}>
          {t("about.madeWith")}
        </div>

        <div style={{ borderTop: `1px solid ${th.border}`, paddingTop: 20, marginTop: 20, textAlign: "center" }}>
          <a href="https://github.com/bmatge/ma-terrasse-au-soleil" target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: F, fontSize: 13, color: th.accent, textDecoration: "none" }}>
            GitHub →
          </a>
        </div>
      </div>
      <BottomNav page="about" navigate={(p) => navigate(p === "home" ? "/" : `/${p}`)} />
    </div>
  );
}
