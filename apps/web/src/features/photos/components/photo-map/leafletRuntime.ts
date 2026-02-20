import { GeoJsonGeometry } from "@/features/photos/types/map";

export interface LeafletWindow extends Window {
  L?: {
    map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
    tileLayer: (url: string, options?: Record<string, unknown>) => LeafletLayer;
    layerGroup: () => LeafletLayerGroup;
    geoJSON: (
      data: GeoJsonGeometry,
      options?: { style?: () => Record<string, unknown> }
    ) => LeafletGeoJsonLayer;
    latLngBounds: (latLngs: [number, number][]) => LeafletBounds;
  };
  leafletImage?: (
    map: LeafletMap,
    done: (error: unknown, canvas: HTMLCanvasElement) => void
  ) => void;
}

export interface LeafletMap {
  setView: (center: [number, number], zoom: number) => void;
  fitBounds: (bounds: LeafletBounds, options?: Record<string, unknown>) => void;
  setMaxBounds: (bounds: LeafletBounds) => void;
  remove: () => void;
  on: (event: string, handler: () => void) => LeafletMap;
  invalidateSize: () => void;
}

export interface LeafletLayer {
  addTo: (map: LeafletMap) => LeafletLayer;
}

export interface LeafletLayerGroup {
  addTo: (map: LeafletMap) => LeafletLayerGroup;
  clearLayers: () => void;
}

export interface LeafletGeoJsonLayer {
  addTo: (layerGroup: LeafletLayerGroup) => LeafletGeoJsonLayer;
  bindTooltip: (text: string) => LeafletGeoJsonLayer;
  on: (event: string, handler: () => void) => LeafletGeoJsonLayer;
  getBounds: () => LeafletBounds;
}

export interface LeafletBounds {
  extend: (bounds: LeafletBounds) => void;
}

export const ASIA_BOUNDS: [number, number][] = [
  [-10, 25],
  [82, 170],
];

export const DEFAULT_MAP_CENTER: [number, number] = [33.669496972795535, 111.95068359375001];
export const DEFAULT_MAP_ZOOM = 5;

const LEAFLET_CSS_ID = "leaflet-css-cdn";
const LEAFLET_JS_ID = "leaflet-js-cdn";
const LEAFLET_IMAGE_JS_ID = "leaflet-image-js-cdn";

export const MAP_THEME_PRESET = {
  baseTileUrl: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
  overlayTileUrl: "https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.png",
  baseAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
  overlayAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; Stadia Maps &copy; Stamen Design',
};

export const ensureLeafletAssets = async (): Promise<void> => {
  if (typeof document === "undefined") return;
  const windowWithLeaflet = window as LeafletWindow;
  if (windowWithLeaflet.L) return;

  if (!document.getElementById(LEAFLET_CSS_ID)) {
    const link = document.createElement("link");
    link.id = LEAFLET_CSS_ID;
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  if (document.getElementById(LEAFLET_JS_ID)) {
    await new Promise<void>((resolve) => {
      const check = (): void => {
        if ((window as LeafletWindow).L) {
          resolve();
          return;
        }
        window.setTimeout(check, 50);
      };
      check();
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = LEAFLET_JS_ID;
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Leaflet"));
    document.body.appendChild(script);
  });
};

export const ensureLeafletImageAsset = async (): Promise<void> => {
  if (typeof document === "undefined") return;
  const windowWithLeaflet = window as LeafletWindow;
  if (windowWithLeaflet.leafletImage) return;

  if (document.getElementById(LEAFLET_IMAGE_JS_ID)) {
    await new Promise<void>((resolve) => {
      const check = (): void => {
        if ((window as LeafletWindow).leafletImage) {
          resolve();
          return;
        }
        window.setTimeout(check, 50);
      };
      check();
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = LEAFLET_IMAGE_JS_ID;
    script.src = "https://unpkg.com/leaflet-image@0.4.0/leaflet-image.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load leaflet-image"));
    document.body.appendChild(script);
  });
};
