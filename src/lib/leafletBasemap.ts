/**
 * Leaflet basemap URL + attribution.
 * CARTO raster tiles now require a free API key (https://carto.com/basemaps/apikey).
 * Prefer VITE_CARTO_API_KEY when set; otherwise use Esri World Dark Gray (no key).
 */

export type BasemapConfig = {
  url: string;
  attribution: string;
  maxZoom: number;
  maxNativeZoom?: number;
  subdomains?: string;
};

export function getLeafletBasemap(): BasemapConfig {
  const cartoKey = (import.meta.env.VITE_CARTO_API_KEY as string | undefined)?.trim();

  if (cartoKey) {
    return {
      url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoKey)}`,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
      subdomains: "abcd",
    };
  }

  // Key-free dark basemap so Vercel / local still render without watermarks.
  // Native tiles to z16; Leaflet overzooms beyond that for pilot close-ups.
  return {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    maxZoom: 20,
    maxNativeZoom: 16,
  };
}

