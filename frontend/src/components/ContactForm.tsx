import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { F } from "../lib/constants";

export default function ContactForm() {
  const { t } = useTranslation();
  const { th } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setName(""); setEmail(""); setMessage("");
    } catch {
      setStatus("error");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: `1.5px solid ${th.border}`, background: th.bg,
    fontFamily: F, fontSize: 16, color: th.text,
    outline: "none", boxSizing: "border-box",
  };

  if (status === "sent") return (
    <div style={{ textAlign: "center", padding: "16px 0", color: th.accentDark, fontFamily: F }}>
      {t("contact.sent")}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input required placeholder={t("contact.namePlaceholder")} value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
      <input required type="email" placeholder={t("contact.emailPlaceholder")} value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
      <textarea required placeholder={t("contact.messagePlaceholder")} value={message} onChange={e => setMessage(e.target.value)}
        rows={4} style={{ ...inputStyle, resize: "vertical" }} />
      {status === "error" && <p style={{ fontFamily: F, fontSize: 13, color: "#EF4444", margin: 0 }}>{t("contact.error")}</p>}
      <button type="submit" disabled={status === "sending"} style={{
        padding: "12px", borderRadius: 12, border: "none", cursor: status === "sending" ? "wait" : "pointer",
        background: th.gradient, color: "#FFF", fontSize: 15, fontWeight: 600, fontFamily: F,
        opacity: status === "sending" ? 0.7 : 1,
      }}>
        {status === "sending" ? t("contact.sending") : t("contact.send")}
      </button>
    </form>
  );
}
