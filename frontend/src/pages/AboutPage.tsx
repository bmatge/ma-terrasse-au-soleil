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

        {section(t("about.conceptTitle"), <>
          {t("about.concept")}<br /><br />
          <em>{t("about.conceptPunchline")}</em>
        </>)}

        {section(t("about.howTitle"), <>
          {t("about.how")}<br /><br />
          {t("about.howData")}
        </>)}

        {section(t("about.whyParisTitle"), t("about.whyParis"))}

        {section(t("about.whyMissingTitle"), t("about.whyMissing"))}

        {section(t("about.techTitle"), <>
          {t("about.techBackend")}<br />
          {t("about.techFrontend")}<br />
          {t("about.techInfra")}<br />
          {t("about.techData")}
        </>)}

        <div style={{ textAlign: "center", fontFamily: F, fontSize: 13, color: th.textMuted, marginTop: 20 }}>
          {t("about.madeWith")}
        </div>

        <div style={{ borderTop: `1px solid ${th.border}`, paddingTop: 20, marginTop: 20, textAlign: "center" }}>
          <a href="https://github.com/bmatge/ma-terrasse-au-soleil" target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: F, fontSize: 13, color: th.accent, textDecoration: "none" }}>
            {t("about.sourceCode")}
          </a>
        </div>
      </div>
      <BottomNav page="about" navigate={(p) => navigate(p === "home" ? "/" : `/${p}`)} />
    </div>
  );
}
