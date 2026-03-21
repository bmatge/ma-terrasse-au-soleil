import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import Nav from "../components/Nav";
import BottomNav from "../components/BottomNav";
import ContactForm from "../components/ContactForm";
import { F } from "../lib/constants";

type Tab = "contact" | "about";

function AboutContent() {
  const { t } = useTranslation();
  const { th } = useTheme();

  const section = (title: string, content: React.ReactNode) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: F, fontWeight: 700, fontSize: 15, color: th.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: F, fontSize: 14, color: th.textSoft, lineHeight: 1.6 }}>{content}</div>
    </div>
  );

  return (
    <>
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
    </>
  );
}

function ContactContent() {
  const { t } = useTranslation();
  const { th } = useTheme();

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>✉️</div>
        <div style={{ fontFamily: F, fontWeight: 700, fontSize: 18, color: th.text }}>{t("contact.title")}</div>
        <div style={{ fontFamily: F, fontSize: 13, color: th.textMuted, marginTop: 4 }}>
          {t("contact.intro")}
        </div>
      </div>
      <ContactForm />
    </>
  );
}

export default function ContactPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { th } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "about" ? "about" : "contact";
  const [tab, setTab] = useState<Tab>(initialTab);

  const switchTab = (newTab: Tab) => {
    setTab(newTab);
    setSearchParams(newTab === "about" ? { tab: "about" } : {}, { replace: true });
  };

  const wrap: React.CSSProperties = { minHeight: "100vh", background: th.bg, fontFamily: F, maxWidth: 860, margin: "0 auto", paddingBottom: 70 };

  const tabs: { key: Tab; label: string }[] = [
    { key: "contact", label: t("contact.title") },
    { key: "about", label: t("about.title") },
  ];

  return (
    <div style={wrap}>
      <Nav back title={tab === "contact" ? t("contact.title") : t("about.title")} onBack={() => navigate(-1)} />

      <div style={{ display: "flex", borderBottom: `1px solid ${th.border}`, padding: "0 24px" }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            style={{
              flex: 1, padding: "12px 0", fontFamily: F, fontSize: 14, fontWeight: tab === key ? 700 : 400,
              color: tab === key ? th.accent : th.textMuted,
              background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === key ? `2px solid ${th.accent}` : "2px solid transparent",
              transition: "color 0.2s, border-color 0.2s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px 24px 100px" }}>
        {tab === "contact" ? <ContactContent /> : <AboutContent />}
      </div>
      <BottomNav page="contact" navigate={(p) => navigate(p === "home" ? "/" : `/${p}`)} />
    </div>
  );
}
