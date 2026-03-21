import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import Nav from "../components/Nav";
import BottomNav from "../components/BottomNav";
import ContactForm from "../components/ContactForm";
import { F } from "../lib/constants";

export default function ContactPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { th } = useTheme();

  const wrap: React.CSSProperties = { minHeight: "100vh", background: th.bg, fontFamily: F, maxWidth: 860, margin: "0 auto", paddingBottom: 70 };

  return (
    <div style={wrap}>
      <Nav back title={t("contact.title")} onBack={() => navigate(-1)} />
      <div style={{ padding: "20px 24px 100px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>✉️</div>
          <div style={{ fontFamily: F, fontWeight: 700, fontSize: 18, color: th.text }}>{t("contact.title")}</div>
          <div style={{ fontFamily: F, fontSize: 13, color: th.textMuted, marginTop: 4 }}>
            {t("contact.intro")}
          </div>
        </div>
        <ContactForm />
      </div>
      <BottomNav page="contact" navigate={(p) => navigate(p === "home" ? "/" : `/${p}`)} />
    </div>
  );
}
