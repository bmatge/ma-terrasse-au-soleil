/**
 * Attempts geolocation with high accuracy first (GPS), then falls back
 * to low accuracy (Wi-Fi/cell) if the first attempt fails or times out.
 * This fixes Android Chrome where enableHighAccuracy + short timeout
 * often causes silent failures (GPS takes too long indoors).
 */
export function getPositionWithFallback(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeolocationPositionError());
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      () => {
        // High accuracy failed (timeout or GPS unavailable) — retry without GPS
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
        );
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}
