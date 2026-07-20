/**
 * Helsinki partner API endpoints (optional live refresh).
 * Runtime uses committed snapshots under /data/helsinki/ — see helsinkiLocalSnapshots.ts.
 */

export const HELSINKI_API_CONFIG = {
  telraam: {
    baseUrl: import.meta.env.VITE_HELSINKI_TELRAAM_API_URL ?? "",
    enabled: Boolean(import.meta.env.VITE_HELSINKI_TELRAAM_API_URL),
  },
  hsl: {
    baseUrl: import.meta.env.VITE_HELSINKI_HSL_API_URL ?? "https://api.hsl.fi",
    enabled: Boolean(import.meta.env.VITE_HELSINKI_HSL_API_URL),
  },
  seeSense: {
    baseUrl: import.meta.env.VITE_HELSINKI_SEE_SENSE_API_URL ?? "",
    apiKey: import.meta.env.VITE_HELSINKI_SEE_SENSE_API_KEY ?? "",
    enabled: Boolean(import.meta.env.VITE_HELSINKI_SEE_SENSE_API_URL),
  },
  viaNova: {
    baseUrl: import.meta.env.VITE_HELSINKI_VIANOVA_API_URL ?? "",
    enabled: Boolean(import.meta.env.VITE_HELSINKI_VIANOVA_API_URL),
  },
  parkingSensors: {
    baseUrl: import.meta.env.VITE_HELSINKI_PARKING_SENSOR_API_URL ?? "",
    enabled: Boolean(import.meta.env.VITE_HELSINKI_PARKING_SENSOR_API_URL),
  },
  innotrafik: {
    baseUrl: import.meta.env.VITE_HELSINKI_INNOTRAFIK_API_URL ?? "",
    enabled: Boolean(import.meta.env.VITE_HELSINKI_INNOTRAFIK_API_URL),
  },
} as const;

export function helsinkiLiveApiEnabled(): boolean {
  return Object.values(HELSINKI_API_CONFIG).some((cfg) => cfg.enabled);
}
