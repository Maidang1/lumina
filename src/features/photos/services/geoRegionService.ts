import { GeoJsonGeometry, RegionBoundaryResult, RegionInfo } from "@/features/photos/types/map";

const GEOCODE_CACHE_KEY = "lumina.map.region.geocode.v3";
const BOUNDARY_CACHE_KEY = "lumina.map.region.boundary.v3";
const REQUEST_INTERVAL_MS = 850;

type NominatimAddress = Record<string, string | undefined>;

interface NominatimReverseResponse {
  address?: NominatimAddress;
}

interface NominatimSearchResponse {
  geojson?: GeoJsonGeometry;
  class?: string;
  type?: string;
  addresstype?: string;
  importance?: number;
  display_name?: string;
}

let geocodeMemoryCache: Record<string, RegionInfo> | null = null;
let boundaryMemoryCache: Record<string, RegionBoundaryResult | null> | null = null;
let requestChain: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

const trimValue = (value: string | undefined): string => (value ?? "").trim();

const hasSuffix = (value: string, suffixes: string[]): boolean =>
  suffixes.some((suffix) => value.endsWith(suffix));

const withChineseSuffix = (value: string, suffixes: string[]): string => {
  const normalized = trimValue(value);
  if (!normalized) return normalized;
  if (hasSuffix(normalized, suffixes)) {
    return normalized;
  }
  return `${normalized}${suffixes[0]}`;
};

const normalizeProvince = (value: string): string =>
  withChineseSuffix(value, ["省", "市", "自治区", "特别行政区"]);

const normalizeCity = (value: string): string =>
  withChineseSuffix(value, ["市", "州", "地区", "盟"]);

const normalizeDistrict = (value: string): string =>
  withChineseSuffix(value, ["区", "县", "市", "旗", "自治县"]);

const isStreetLevelName = (value: string): boolean =>
  /(街道|镇|乡|村|社区|苏木)$/.test(trimValue(value));

const isDistrictLikeName = (value: string): boolean =>
  /(区|县|旗|镇|乡|街道|村|社区|苏木)$/.test(trimValue(value));

const isCityLikeName = (value: string): boolean =>
  /(市|州|地区|盟|自治州)$/.test(trimValue(value));

const toCoordinateKey = (lat: number, lng: number): string => `${lat.toFixed(4)},${lng.toFixed(4)}`;

const parseJsonCache = <T>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJsonCache = (key: string, value: unknown): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
};

const getGeocodeCache = (): Record<string, RegionInfo> => {
  if (geocodeMemoryCache) return geocodeMemoryCache;
  geocodeMemoryCache = parseJsonCache<Record<string, RegionInfo>>(GEOCODE_CACHE_KEY) ?? {};
  return geocodeMemoryCache;
};

const getBoundaryCache = (): Record<string, RegionBoundaryResult | null> => {
  if (boundaryMemoryCache) return boundaryMemoryCache;
  boundaryMemoryCache = parseJsonCache<Record<string, RegionBoundaryResult | null>>(BOUNDARY_CACHE_KEY) ?? {};
  return boundaryMemoryCache;
};

const queueRequest = async <T>(task: () => Promise<T>): Promise<T> => {
  const run = async (): Promise<T> => {
    const now = Date.now();
    const wait = Math.max(0, REQUEST_INTERVAL_MS - (now - lastRequestAt));
    if (wait > 0) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, wait));
    }
    lastRequestAt = Date.now();
    return task();
  };

  const next = requestChain.then(run, run);
  requestChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
};

const formatDisplayName = (province: string, city: string, district: string): string => {
  const parts = [province, city, district].filter(Boolean);
  return parts.join("·") || "未知地区";
};

const normalizeMunicipalityCity = (province: string): string => {
  if (/^(北京市|上海市|天津市|重庆市)$/.test(province)) {
    return province;
  }
  return "";
};

const selectCityName = (address: NominatimAddress, province: string): string => {
  const candidates = [
    trimValue(address.city),
    trimValue(address.municipality),
    trimValue(address.prefecture),
    trimValue(address.state_district),
    trimValue(address.region),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (isDistrictLikeName(candidate)) continue;
    if (isCityLikeName(candidate) || candidate.endsWith("地区")) {
      return candidate;
    }
  }

  const municipalityCity = normalizeMunicipalityCity(province);
  if (municipalityCity) {
    return municipalityCity;
  }

  return "";
};

const toRegionInfo = (address: NominatimAddress): RegionInfo => {
  const country = trimValue(address.country) || "中国";
  const provinceRaw = trimValue(address.state) || trimValue(address.province) || trimValue(address.region);
  const province = provinceRaw ? normalizeProvince(provinceRaw) : "未知省份";
  const cityRaw = selectCityName(address, province);
  const districtRaw =
    trimValue(address.district) ||
    trimValue(address.county) ||
    trimValue(address.city_district) ||
    trimValue(address.borough) ||
    (isStreetLevelName(trimValue(address.suburb)) ? "" : trimValue(address.suburb)) ||
    trimValue(address.town);

  const city = cityRaw ? normalizeCity(cityRaw) : "未知城市";
  const district = districtRaw ? normalizeDistrict(districtRaw) : "未知区县";
  const displayName = city && city !== "未知城市" ? `${province}·${city}` : province;
  const cacheKey = `CN|${province}|${city}`;

  return {
    country,
    province,
    city,
    district,
    displayName,
    cacheKey,
  };
};

const fetchJson = async <T>(url: string): Promise<T> =>
  queueRequest(async () => {
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "zh-CN,zh;q=0.95,en;q=0.8",
      },
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return (await response.json()) as T;
  });

export async function reverseGeocodeToRegion(lat: number, lng: number): Promise<RegionInfo> {
  const key = toCoordinateKey(lat, lng);
  const geocodeCache = getGeocodeCache();
  if (geocodeCache[key]) {
    return geocodeCache[key];
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");

  try {
    const payload = await fetchJson<NominatimReverseResponse>(url.toString());
    const info = toRegionInfo(payload.address ?? {});
    geocodeCache[key] = info;
    writeJsonCache(GEOCODE_CACHE_KEY, geocodeCache);
    return info;
  } catch {
    const fallback: RegionInfo = {
      country: "中国",
      province: "未知省份",
      city: "未知城市",
      district: "未知区县",
      displayName: "未知地区",
      cacheKey: "CN|未知省份|未知城市|未知区县",
    };
    geocodeCache[key] = fallback;
    writeJsonCache(GEOCODE_CACHE_KEY, geocodeCache);
    return fallback;
  }
}

const isAreaGeometry = (geojson: GeoJsonGeometry | null | undefined): boolean => {
  if (!geojson) return false;
  if (geojson.type === "Polygon" || geojson.type === "MultiPolygon") return true;
  if (geojson.type === "GeometryCollection" && Array.isArray(geojson.geometries)) {
    return geojson.geometries.some((item) => item.type === "Polygon" || item.type === "MultiPolygon");
  }
  return false;
};

const pickBestBoundaryCandidate = (
  payload: NominatimSearchResponse[],
  targetLevel: "city" | "province"
): GeoJsonGeometry | null => {
  const candidates = payload.filter((item) => isAreaGeometry(item.geojson));
  if (candidates.length === 0) {
    return null;
  }

  const scored = candidates
    .map((item) => {
      let score = 0;
      if (item.class === "boundary" && item.type === "administrative") score += 100;
      if (targetLevel === "city" && (item.addresstype === "city" || item.addresstype === "municipality")) score += 80;
      if (targetLevel === "province" && (item.addresstype === "state" || item.addresstype === "province")) score += 80;
      score += Math.round((item.importance ?? 0) * 10);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.item.geojson ?? null;
};

const searchBoundary = async (
  query: string,
  targetLevel: "city" | "province"
): Promise<GeoJsonGeometry | null> => {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("countrycodes", "cn");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("namedetails", "1");
  if (targetLevel === "city") {
    url.searchParams.set("featuretype", "city");
  } else if (targetLevel === "province") {
    url.searchParams.set("featuretype", "state");
  }

  try {
    const payload = await fetchJson<NominatimSearchResponse[]>(url.toString());
    return pickBestBoundaryCandidate(payload, targetLevel);
  } catch {
    return null;
  }
};

const buildBoundaryQueryCandidates = (region: RegionInfo): Array<{ level: "city" | "province"; query: string }> => {
  const candidates: Array<{ level: "city" | "province"; query: string }> = [];
  const push = (level: "city" | "province", query: string): void => {
    const normalized = query.replace(/\s+/g, " ").trim();
    if (!normalized) return;
    if (candidates.some((item) => item.query === normalized)) return;
    candidates.push({ level, query: normalized });
  };

  if (region.city !== "未知城市") {
    push("city", `${region.city} ${region.province} 中国`);
  }
  push("province", `${region.province} 中国`);

  return candidates;
};

export async function getRegionBoundary(region: RegionInfo): Promise<RegionBoundaryResult | null> {
  const boundaryCache = getBoundaryCache();
  if (region.cacheKey in boundaryCache) {
    return boundaryCache[region.cacheKey];
  }

  const candidates = buildBoundaryQueryCandidates(region);
  for (const candidate of candidates) {
    const geojson = await searchBoundary(candidate.query, candidate.level);
    if (!geojson) continue;
    const result: RegionBoundaryResult = { level: candidate.level, geojson };
    boundaryCache[region.cacheKey] = result;
    writeJsonCache(BOUNDARY_CACHE_KEY, boundaryCache);
    return result;
  }

  boundaryCache[region.cacheKey] = null;
  writeJsonCache(BOUNDARY_CACHE_KEY, boundaryCache);
  return null;
}
