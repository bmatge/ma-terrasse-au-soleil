import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "pwa-install-dismissed";
const DELAY_DAYS = 7;

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isIOSSafari(): boolean {
  return isIOS() && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function wasDismissedRecently(): boolean {
  const dismissed = localStorage.getItem(STORAGE_KEY);
  if (!dismissed) return false;
  const daysSince = (Date.now() - parseInt(dismissed, 10)) / 86_400_000;
  return daysSince <= DELAY_DAYS;
}

export type InstallPlatform = "android" | "ios" | null;

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<InstallPlatform>(null);
  const [canShow, setCanShow] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    // Android / desktop Chrome — native prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
      setCanShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari — manual instructions
    if (isIOSSafari()) {
      setPlatform("ios");
      setCanShow(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setCanShow(false);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setCanShow(false);
    setDeferredPrompt(null);
  }, []);

  return { canShow, platform, triggerInstall, dismiss };
}
