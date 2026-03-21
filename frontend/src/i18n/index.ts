import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import fr from "./locales/fr.json";

export const LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
] as const;

const SUPPORTED: Set<string> = new Set(LANGUAGES.map((l) => l.code));

// Tiny language detector — replaces i18next-browser-languagedetector (~8 KiB)
function detectLanguage(): string {
  const stored = localStorage.getItem("i18nextLng");
  if (stored) {
    const code = stored.split("-")[0];
    if (SUPPORTED.has(code)) return code;
  }
  for (const lang of navigator.languages ?? [navigator.language]) {
    const code = lang.split("-")[0];
    if (SUPPORTED.has(code)) return code;
  }
  return "fr";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LOCALE_LOADERS: Record<string, () => Promise<{ default: any }>> = {
  en: () => import("./locales/en.json"),
  es: () => import("./locales/es.json"),
  de: () => import("./locales/de.json"),
  ja: () => import("./locales/ja.json"),
  zh: () => import("./locales/zh.json"),
};

async function loadLanguage(lng: string) {
  if (lng === "fr" || i18n.hasResourceBundle(lng, "translation")) return;
  const loader = LOCALE_LOADERS[lng];
  if (loader) {
    const mod = await loader();
    i18n.addResourceBundle(lng, "translation", mod.default, true, true);
  }
}

const detected = detectLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
    },
    lng: detected,
    supportedLngs: [...SUPPORTED],
    load: "languageOnly",
    fallbackLng: "fr",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

// Load detected language if not French
if (detected !== "fr") {
  loadLanguage(detected);
}

// Load language on change + persist
i18n.on("languageChanged", (lng: string) => {
  const code = lng.split("-")[0];
  localStorage.setItem("i18nextLng", code);
  loadLanguage(code);
});

export default i18n;
