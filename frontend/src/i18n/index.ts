import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import fr from "./locales/fr.json";

export const LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
] as const;

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

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
    },
    supportedLngs: ["fr", "en", "es", "de", "ja", "zh"],
    load: "languageOnly",
    fallbackLng: "fr",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

// Load detected language if not French
const detected = i18n.language?.split("-")[0];
if (detected && detected !== "fr") {
  loadLanguage(detected);
}

// Load language on change
i18n.on("languageChanged", (lng: string) => {
  loadLanguage(lng.split("-")[0]);
});

export default i18n;
