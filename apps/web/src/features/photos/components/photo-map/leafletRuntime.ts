import { GeoJsonGeometry, MapThemeMode } from "@/features/photos/types/map";

export interface LeafletWindow extends Window {
  L?: {
    map: (
      element: HTMLElement,
      options?: Record<string, unknown>,
    ) => LeafletMap;
    tileLayer: (url: string, options?: Record<string, unknown>) => LeafletLayer;
    layerGroup: () => LeafletLayerGroup;
    marker: (
      latLng: [number, number],
      options?: Record<string, unknown>,
    ) => LeafletMarkerLayer;
    circleMarker: (
      latLng: [number, number],
      options?: Record<string, unknown>,
    ) => LeafletMarkerLayer;
    polyline: (
      latLngs: [number, number][],
      options?: Record<string, unknown>,
    ) => LeafletPolylineLayer;
    geoJSON: (
      data: GeoJsonGeometry,
      options?: { style?: () => Record<string, unknown> },
    ) => LeafletGeoJsonLayer;
    latLngBounds: (latLngs: [number, number][]) => LeafletBounds;
    markerClusterGroup?: (
      options?: Record<string, unknown>,
    ) => LeafletMarkerClusterGroup;
    heatLayer?: (
      latLngs: Array<[number, number, number?]>,
      options?: Record<string, unknown>,
    ) => LeafletLayer;
  };
  leafletImage?: (
    map: LeafletMap,
    done: (error: unknown, canvas: HTMLCanvasElement) => void,
  ) => void;
}

export interface LeafletMap {
  setView: (center: [number, number], zoom: number) => void;
  fitBounds: (bounds: LeafletBounds, options?: Record<string, unknown>) => void;
  setMaxBounds: (bounds: LeafletBounds) => void;
  remove: () => void;
  on: (event: string, handler: () => void) => LeafletMap;
  invalidateSize: () => void;
  attributionControl?: {
    setPrefix: (prefix: string | false) => void;
  };
}

export interface LeafletLayer {
  addTo: (target: LeafletMap | LeafletLayerGroup) => LeafletLayer;
  remove?: () => void;
  setUrl?: (url: string) => void;
}

export interface LeafletLayerGroup {
  addTo: (map: LeafletMap) => LeafletLayerGroup;
  clearLayers: () => void;
  addLayer?: (layer: LeafletLayer) => void;
  remove?: () => void;
}

export interface LeafletGeoJsonLayer {
  addTo: (layerGroup: LeafletLayerGroup) => LeafletGeoJsonLayer;
  bindTooltip: (text: string) => LeafletGeoJsonLayer;
  on: (event: string, handler: () => void) => LeafletGeoJsonLayer;
  getBounds: () => LeafletBounds;
}

export interface LeafletMarkerLayer extends LeafletLayer {
  bindTooltip?: (text: string) => LeafletMarkerLayer;
  on?: (event: string, handler: () => void) => LeafletMarkerLayer;
}

export interface LeafletPolylineLayer extends LeafletLayer {}

export interface LeafletMarkerClusterGroup extends LeafletLayerGroup {
  addLayer: (layer: LeafletLayer) => void;
}

export interface LeafletBounds {
  extend: (bounds: LeafletBounds) => void;
}

export const ASIA_BOUNDS: [number, number][] = [
  [-10, 25],
  [82, 170],
];

export const DEFAULT_MAP_CENTER: [number, number] = [
  33.669496972795535, 111.95068359375001,
];
export const DEFAULT_MAP_ZOOM = 5;

const LEAFLET_CSS_ID = "leaflet-css-cdn";
const LEAFLET_JS_ID = "leaflet-js-cdn";
const LEAFLET_IMAGE_JS_ID = "leaflet-image-js-cdn";
const LEAFLET_CLUSTER_CSS_ID = "leaflet-cluster-css-cdn";
const LEAFLET_CLUSTER_DEFAULT_CSS_ID = "leaflet-cluster-default-css-cdn";
const LEAFLET_CLUSTER_JS_ID = "leaflet-cluster-js-cdn";
const LEAFLET_HEAT_JS_ID = "leaflet-heat-js-cdn";

export const MAP_THEME_PRESETS: Record<
  MapThemeMode,
  {
    baseTileUrl: string;
    overlayTileUrl: string;
    baseAttribution: string;
    overlayAttribution: string;
  }
> = {
  dark: {
    baseTileUrl:
      "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    overlayTileUrl:
      "https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.png",
    baseAttribution: "",
    overlayAttribution: "",
  },
  light: {
    baseTileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    overlayTileUrl:
      "https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.png",
    baseAttribution: "",
    overlayAttribution: "",
  },
};

export const ensureLeafletAssets = async (): Promise<void> => {
  if (typeof document === "undefined") return;
  const windowWithLeaflet = window as LeafletWindow;
  if (windowWithLeaflet.L) return;

  if (!document.getElementById(LEAFLET_CSS_ID)) {
    const link = document.createElement("link");
    link.id = LEAFLET_CSS_ID;
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
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
    script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Leaflet"));
    document.body.appendChild(script);
  });
};

export const ensureLeafletClusterAsset = async (): Promise<void> => {
  if (typeof document === "undefined") return;
  const windowWithLeaflet = window as LeafletWindow;
  if (windowWithLeaflet.L?.markerClusterGroup) return;

  if (!document.getElementById(LEAFLET_CLUSTER_CSS_ID)) {
    const link = document.createElement("link");
    link.id = LEAFLET_CLUSTER_CSS_ID;
    link.rel = "stylesheet";
    link.href =
      "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
    document.head.appendChild(link);
  }
  if (!document.getElementById(LEAFLET_CLUSTER_DEFAULT_CSS_ID)) {
    const link = document.createElement("link");
    link.id = LEAFLET_CLUSTER_DEFAULT_CSS_ID;
    link.rel = "stylesheet";
    link.href =
      "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
    document.head.appendChild(link);
  }

  if (document.getElementById(LEAFLET_CLUSTER_JS_ID)) {
    await new Promise<void>((resolve) => {
      const check = (): void => {
        if ((window as LeafletWindow).L?.markerClusterGroup) {
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
    script.id = LEAFLET_CLUSTER_JS_ID;
    script.src =
      "https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load leaflet.markercluster"));
    document.body.appendChild(script);
  });
};

export const ensureLeafletHeatAsset = async (): Promise<void> => {
  if (typeof document === "undefined") return;
  const windowWithLeaflet = window as LeafletWindow;
  if (windowWithLeaflet.L?.heatLayer) return;

  if (document.getElementById(LEAFLET_HEAT_JS_ID)) {
    await new Promise<void>((resolve) => {
      const check = (): void => {
        if ((window as LeafletWindow).L?.heatLayer) {
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
    script.id = LEAFLET_HEAT_JS_ID;
    script.src =
      "https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load leaflet.heat"));
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
    script.src =
      "https://cdn.jsdelivr.net/npm/leaflet-image@0.4.0/leaflet-image.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load leaflet-image"));
    document.body.appendChild(script);
  });
};
