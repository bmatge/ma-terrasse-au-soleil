import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getPositionWithFallback } from "../lib/geolocation";

interface GeolocationState {
  lat: number | null;
  lon: number | null;
  loading: boolean;
  error: string | null;
}

export function useGeolocation() {
  const { t } = useTranslation();
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lon: null,
    loading: false,
    error: null,
  });

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: t("geo.notSupportedShort") }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    getPositionWithFallback().then(
      (pos) => {
        setState({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          loading: false,
          error: null,
        });
      },
      (err) => {
        setState((s) => ({
          ...s,
          loading: false,
          error:
            err.code === 1
              ? t("geo.deniedShort")
              : t("geo.unavailableShort"),
        }));
      },
    );
  }, [t]);

  return { ...state, locate };
}
