import { mapService } from "./mapService";
import type { GeoCoordinate } from "../types";

export interface NearbyPharmacy {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  phone?: string;
  openingHours?: string;
  source: "overpass" | "nominatim";
}

interface OverpassElement {
  type?: "node" | "way" | "relation";
  id?: number;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string | undefined>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface NominatimResult {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  namedetails?: {
    name?: string;
  };
  address?: {
    amenity?: string;
    road?: string;
    house_number?: string;
    neighbourhood?: string;
    suburb?: string;
    city_district?: string;
    town?: string;
    city?: string;
    province?: string;
  };
  extratags?: {
    phone?: string;
    "contact:phone"?: string;
    opening_hours?: string;
  };
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const SEARCH_RADIUS_METERS = 5000;
const MAX_RESULTS = 20;

function haversineDistanceKm(
  a: GeoCoordinate,
  b: GeoCoordinate
): number {
  const earthRadiusKm = 6371;

  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;

  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);

  const h =
    sinLat * sinLat +
    Math.cos(lat1) *
      Math.cos(lat2) *
      sinLng *
      sinLng;

  return (
    earthRadiusKm *
    2 *
    Math.atan2(
      Math.sqrt(h),
      Math.sqrt(1 - h)
    )
  );
}

function getBoundingBox(
  location: GeoCoordinate,
  radiusMeters: number
) {
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeDelta =
    radiusMeters /
    (111_320 * Math.max(0.2, Math.cos((location.lat * Math.PI) / 180)));

  return {
    south: location.lat - latitudeDelta,
    west: location.lng - longitudeDelta,
    north: location.lat + latitudeDelta,
    east: location.lng + longitudeDelta,
  };
}

function cleanText(value?: string): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildAddressFromTags(
  tags: Record<string, string | undefined>
): string {
  const street = cleanText(tags["addr:street"]);
  const number = cleanText(tags["addr:housenumber"]);

  const firstLine =
    [street, number].filter(Boolean).join(" ") ||
    cleanText(tags["addr:place"]);

  const locality = [
    cleanText(tags["addr:neighbourhood"]),
    cleanText(tags["addr:suburb"]),
    cleanText(tags["addr:district"]),
    cleanText(tags["addr:city"]),
  ].filter(Boolean);

  const result = [
    firstLine,
    ...locality,
  ].filter(Boolean);

  return result.join(", ");
}

function buildPharmacyFromOverpass(
  element: OverpassElement,
  userLocation: GeoCoordinate
): NearbyPharmacy | null {
  const tags = element.tags || {};

  const latitude =
    typeof element.lat === "number"
      ? element.lat
      : typeof element.center?.lat === "number"
        ? element.center.lat
        : NaN;

  const longitude =
    typeof element.lon === "number"
      ? element.lon
      : typeof element.center?.lon === "number"
        ? element.center.lon
        : NaN;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const distanceKm = haversineDistanceKm(
    userLocation,
    {
      lat: latitude,
      lng: longitude,
    }
  );

  if (distanceKm > SEARCH_RADIUS_METERS / 1000) {
    return null;
  }

  const name =
    cleanText(tags.name) ||
    cleanText(tags["name:tr"]) ||
    "Eczane";

  const address =
    buildAddressFromTags(tags) ||
    "Adres bilgisi bulunmuyor";

  const phone =
    cleanText(tags.phone) ||
    cleanText(tags["contact:phone"]) ||
    undefined;

  const openingHours =
    cleanText(tags.opening_hours) ||
    undefined;

  const id =
    `${element.type || "osm"}:${element.id || `${latitude}:${longitude}`}`;

  return {
    id,
    name,
    address,
    latitude,
    longitude,
    distanceKm,
    phone,
    openingHours,
    source: "overpass",
  };
}

async function searchOverpass(
  userLocation: GeoCoordinate
): Promise<NearbyPharmacy[]> {
  const box = getBoundingBox(
    userLocation,
    SEARCH_RADIUS_METERS
  );

  const query = `
[out:json][timeout:15];
(
  nwr["amenity"="pharmacy"](
    ${box.south},
    ${box.west},
    ${box.north},
    ${box.east}
  );
);
out center tags;
`.trim();

  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(
        `${endpoint}?data=${encodeURIComponent(query)}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        lastError = new Error(
          `Overpass HTTP ${response.status}`
        );
        continue;
      }

      const data =
        (await response.json()) as OverpassResponse;

      return (data.elements || [])
        .map((element) =>
          buildPharmacyFromOverpass(
            element,
            userLocation
          )
        )
        .filter(
          (
            item
          ): item is NearbyPharmacy =>
            Boolean(item)
        )
        .sort(
          (a, b) =>
            a.distanceKm - b.distanceKm
        )
        .slice(0, MAX_RESULTS);
    } catch (error) {
      lastError = error;
    }
  }

  throw (
    lastError instanceof Error
      ? lastError
      : new Error(
          "Yakındaki eczaneler alınamadı."
        )
  );
}

async function searchNominatimFallback(
  userLocation: GeoCoordinate
): Promise<NearbyPharmacy[]> {
  const box = getBoundingBox(
    userLocation,
    SEARCH_RADIUS_METERS
  );

  const params = new URLSearchParams();

  params.set("q", "[pharmacy]");
  params.set("format", "jsonv2");
  params.set("addressdetails", "1");
  params.set("extratags", "1");
  params.set("namedetails", "1");
  params.set("limit", "20");
  params.set("countrycodes", "tr");
  params.set(
    "viewbox",
    [
      box.west,
      box.north,
      box.east,
      box.south,
    ].join(",")
  );
  params.set("bounded", "1");
  params.set("layer", "poi");

  const searchUrl =
    mapService.getConfig().searchUrl;

  const response = await fetch(
    `${searchUrl}?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Nominatim HTTP ${response.status}`
    );
  }

  const data =
    (await response.json()) as NominatimResult[];

  return data
    .map((item) => {
      const latitude = Number(item.lat);
      const longitude = Number(item.lon);

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        return null;
      }

      const distanceKm =
        haversineDistanceKm(
          userLocation,
          {
            lat: latitude,
            lng: longitude,
          }
        );

      if (
        distanceKm >
        SEARCH_RADIUS_METERS / 1000
      ) {
        return null;
      }

      const address = item.address || {};

      const name =
        cleanText(item.namedetails?.name) ||
        cleanText(address.amenity) ||
        cleanText(
          item.display_name
            ?.split(",")[0]
        ) ||
        "Eczane";

      const phone =
        cleanText(
          item.extratags?.phone
        ) ||
        cleanText(
          item.extratags?.["contact:phone"]
        ) ||
        undefined;

      const openingHours =
        cleanText(
          item.extratags?.opening_hours
        ) ||
        undefined;

      return {
        id:
          item.place_id !== undefined
            ? `nominatim:${item.place_id}`
            : `nominatim:${item.osm_type || "osm"}:${item.osm_id || `${latitude}:${longitude}`}`,
        name,
        address:
          cleanText(item.display_name) ||
          "Adres bilgisi bulunmuyor",
        latitude,
        longitude,
        distanceKm,
        phone,
        openingHours,
        source: "nominatim" as const,
      };
    })
    .filter(
      (
        item
      ): item is NearbyPharmacy =>
        Boolean(item)
    )
    .sort(
      (a, b) =>
        a.distanceKm - b.distanceKm
    )
    .slice(0, MAX_RESULTS);
}

class PharmacyService {
  async findNearbyPharmacies(
    userLocation: GeoCoordinate
  ): Promise<NearbyPharmacy[]> {
    try {
      const results =
        await searchOverpass(
          userLocation
        );

      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      console.warn(
        "Overpass eczane araması başarısız, Nominatim fallback deneniyor:",
        error
      );
    }

    return searchNominatimFallback(
      userLocation
    );
  }
}

export const pharmacyService =
  new PharmacyService();

export type { GeoCoordinate };
