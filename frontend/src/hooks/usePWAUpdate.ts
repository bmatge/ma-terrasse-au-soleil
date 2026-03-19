import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

export function usePWAUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const updateFn = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    updateFn.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        setOfflineReady(true);
      },
    });
  }, []);

  function updateSW() {
    updateFn.current?.(true);
  }

  function dismiss() {
    setNeedRefresh(false);
    setOfflineReady(false);
  }

  return { needRefresh, offlineReady, updateSW, dismiss };
}
