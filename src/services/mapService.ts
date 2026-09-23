import type { GeoCoordinate } from "../types";

export type { GeoCoordinate } from "../types";

export interface AddressSuggestion {
  displayName: string;
  lat?: number;
  lng?: number;
  name?: string;
  source?: string;
  placeId?: string;
  formattedAddress?: string;
  osmType?: "node" | "way" | "relation";
  osmId?: number;
  areaId?: number;
  kind?: "city" | "district" | "neighborhood" | "street" | "address";
  parentCity?: string;
  parentDistrict?: string;
  parentNeighborhood?: string;
  street?: string;
  streetNumber?: string;
  types?: string[];
}

export interface AddressSearchContext {
  city?: AddressSuggestion | null;
  district?: AddressSuggestion | null;
  neighborhood?: AddressSuggestion | null;
  street?: AddressSuggestion | null;
}

export interface MapServiceConfig {
  defaultCenter: [number, number];
  defaultZoom: number;
  tileUrl: string;
  searchUrl: string;
  routeUrl: string;
}

const OVERPASS_URLS = [
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const ISTANBUL_BBOX = "40.80,28.40,41.35,29.55";



const MAP_CONFIG: MapServiceConfig = {
  defaultCenter: [39.0, 35.0],
  defaultZoom: 6,
  tileUrl:
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  searchUrl:
    "https://nominatim.openstreetmap.org/search",
  routeUrl:
    "https://router.project-osrm.org/route/v1/driving",
};


function normalizeTurkish(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isValidCoordinate(
  coordinate?: GeoCoordinate | null
): coordinate is GeoCoordinate {
  return Boolean(
    coordinate &&
      typeof coordinate.lat === "number" &&
      typeof coordinate.lng === "number" &&
      Number.isFinite(coordinate.lat) &&
      Number.isFinite(coordinate.lng)
  );
}

function haversineDistance(
  a: GeoCoordinate,
  b: GeoCoordinate
): number {
  const earthRadiusKm = 6371;

  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const deltaLat =
    ((b.lat - a.lat) * Math.PI) / 180;

  const deltaLng =
    ((b.lng - a.lng) * Math.PI) / 180;

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

class MapService {
  private lastAddressSearchAt = 0;
  private readonly addressSuggestionCache = new Map<string, AddressSuggestion[]>();
  private readonly districtNeighborhoodCache = new Map<string, AddressSuggestion[]>();
  private readonly neighborhoodStreetCache = new Map<string, AddressSuggestion[]>();
  private districtLoadPromise: Promise<AddressSuggestion[]> | null = null;
  private istanbulAreaIdPromise: Promise<number | null> | null = null;

  private readPersistentAddressCache(
    key: string
  ): AddressSuggestion[] | null {
    try {
      const raw =
        window.localStorage.getItem(
          "trustline-address-cache:" + key
        );

      if (!raw) return null;

      const parsed =
        JSON.parse(raw) as {
          savedAt?: number;
          data?: AddressSuggestion[];
        };

      if (
        !parsed ||
        !Array.isArray(parsed.data) ||
        typeof parsed.savedAt !== "number"
      ) {
        return null;
      }

      const maxAge =
        24 * 60 * 60 * 1000;

      if (
        Date.now() -
          parsed.savedAt >
        maxAge
      ) {
        window.localStorage.removeItem(
          "trustline-address-cache:" + key
        );
        return null;
      }

      return parsed.data;
    } catch {
      return null;
    }
  }

  private writePersistentAddressCache(
    key: string,
    data: AddressSuggestion[]
  ): void {
    try {
      window.localStorage.setItem(
        "trustline-address-cache:" + key,
        JSON.stringify({
          savedAt: Date.now(),
          data,
        })
      );
    } catch {
      // localStorage is only an optimization; never block address lookup.
    }
  }

  private async fetchOverpass(
    query: string,
    timeoutMs = 12000
  ): Promise<any> {
    let lastError: unknown = null;

    for (const endpoint of OVERPASS_URLS) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        timeoutMs
      );

      try {
        const response = await fetch(
          endpoint,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded;charset=UTF-8",
              Accept: "application/json",
            },
            body:
              "data=" +
              encodeURIComponent(query),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          lastError = new Error(
            "Overpass HTTP " +
              response.status
          );
          continue;
        }

        return await response.json();
      } catch (error) {
        lastError = error;
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(
          "Overpass servisine ulaşılamadı."
        );
  }

  private normalizeQueryForHierarchy(value: string): string {
    return normalizeTurkish(value)
      .replace(/[,./\\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private findDistrictInQuery(
    query: string,
    districts: AddressSuggestion[]
  ): AddressSuggestion | null {
    const normalized =
      this.normalizeQueryForHierarchy(
        query
      );

    const candidates =
      [...districts].sort(
        (a, b) =>
          normalizeTurkish(
            String(b.name || "")
          ).length -
          normalizeTurkish(
            String(a.name || "")
          ).length
      );

    for (const district of candidates) {
      const name =
        normalizeTurkish(
          String(
            district.name || ""
          )
        );

      if (!name) continue;

      const matcher =
        new RegExp(
          "(^|\\s)" +
            name +
            "(?=$|\\s)",
          "i"
        );

      if (matcher.test(normalized)) {
        return district;
      }
    }

    return null;
  }

  private removeHierarchyLabels(
    query: string,
    district: string
  ): string {
    const districtNormalized =
      normalizeTurkish(district);

    let remaining =
      this.normalizeQueryForHierarchy(query);

    const districtPattern = new RegExp(
      "(^|\\s)" +
        districtNormalized +
        "(?=$|\\s)",
      "gi"
    );

    remaining = remaining
      .replace(
        /(^|\\s)istanbul(?=$|\\s)/gi,
        " "
      )
      .replace(
        /(^|\\s)turkiye(?=$|\\s)/gi,
        " "
      )
      .replace(
        districtPattern,
        " "
      )
      .replace(
        /(^|\\s)(mahallesi|mahalle|mah|mh)(?=$|\\s)/gi,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();

    return remaining;
  }

  private async findIstanbulDistrictRelation(
    district: string
  ): Promise<{ osmId: number; areaId: number; lat?: number; lng?: number } | null> {
    const name = String(district || "").trim();
    if (!name) return null;

    const escapedName =
      name.replace(/["\\]/g, "\\$&");

    const query =
      "[out:json][timeout:15];" +
      'rel["boundary"="administrative"]["admin_level"="6"]["name"="' +
      escapedName +
      '"](40.80,28.40,41.35,29.55);' +
      "out tags center;";

    const data = await this.fetchOverpass(query, 9000);
    const elements = Array.isArray(data?.elements)
      ? data.elements
      : [];

    const relation =
      elements.find(
        (item: any) =>
          String(item?.type) === "relation" &&
          Number.isFinite(Number(item?.id))
      ) || null;

    if (!relation) return null;

    const osmId = Number(relation.id);

    return {
      osmId,
      areaId: 3600000000 + osmId,
      lat: Number(relation?.center?.lat) || undefined,
      lng: Number(relation?.center?.lon) || undefined,
    };
  }

  private async findIstanbulAreaId(): Promise<number | null> {
    if (
      this.istanbulAreaIdPromise
    ) {
      return this.istanbulAreaIdPromise;
    }

    this.istanbulAreaIdPromise =
      (async () => {
        try {
          const params =
            new URLSearchParams();

          params.set(
            "q",
            "İstanbul, Türkiye"
          );
          params.set(
            "format",
            "geocodejson"
          );
          params.set(
            "limit",
            "10"
          );
          params.set(
            "countrycodes",
            "tr"
          );
          params.set(
            "accept-language",
            "tr"
          );

          const response =
            await fetch(
              MAP_CONFIG.searchUrl +
                "?" +
                params.toString(),
              {
                headers: {
                  Accept:
                    "application/json",
                },
              }
            );

          if (
            !response.ok
          ) {
            return null;
          }

          const data =
            await response.json();

          const features =
            Array.isArray(
              data?.features
            )
              ? data.features
              : [];

          const exact =
            features.find(
              (feature: any) => {
                const geocoding =
                  feature?.properties
                    ?.geocoding ||
                  {};

                const name =
                  normalizeTurkish(
                    String(
                      geocoding?.name ||
                        ""
                    )
                  );

                const type =
                  normalizeTurkish(
                    String(
                      geocoding?.type ||
                        ""
                    )
                  );

                const osmType =
                  String(
                    geocoding?.osm_type ||
                      ""
                  ).toLowerCase();

                return (
                  name ===
                    "istanbul" &&
                  (
                    type ===
                      "city" ||
                    type ===
                      "state"
                  ) &&
                  osmType ===
                    "relation"
                );
              }
            );

          const osmId =
            Number(
              exact?.properties
                ?.geocoding
                ?.osm_id
            );

          return Number.isFinite(
            osmId
          )
            ? 3600000000 +
                osmId
            : null;
        } catch {
          try {
            const params =
              new URLSearchParams();

            params.set(
              "q",
              "İstanbul, Türkiye"
            );
            params.set(
              "format",
              "jsonv2"
            );
            params.set(
              "limit",
              "10"
            );
            params.set(
              "countrycodes",
              "tr"
            );

            const response =
              await fetch(
                MAP_CONFIG.searchUrl +
                  "?" +
                  params.toString(),
                {
                  headers: {
                    Accept:
                      "application/json",
                  },
                }
              );

            if (!response.ok) {
              return null;
            }

            const data =
              await response.json();

            const result =
              Array.isArray(data)
                ? data.find(
                    (item: any) =>
                      normalizeTurkish(
                        String(
                          item?.name ||
                            ""
                        )
                      ) ===
                        "istanbul" &&
                      (
                        normalizeTurkish(
                          String(
                            item?.type ||
                              ""
                          )
                        ) ===
                          "administrative" ||
                        normalizeTurkish(
                          String(
                            item?.type ||
                              ""
                          )
                        ) ===
                          "city"
                      ) &&
                      String(
                        item?.osm_type ||
                          ""
                      ).toLowerCase() ===
                        "relation"
                  )
                : null;

            const osmId =
              Number(
                result?.osm_id
              );

            return Number.isFinite(
              osmId
            )
              ? 3600000000 +
                  osmId
              : null;
          } catch {
            return null;
          }
        }
      })().finally(
        () => {
          this.istanbulAreaIdPromise =
            null;
        }
      );

    return this.istanbulAreaIdPromise;
  }

  private async getIstanbulDistrictSuggestions(
    queryText?: string
  ): Promise<AddressSuggestion[]> {
    const cacheKey =
      "istanbul:districts";

    const cached =
      this.districtNeighborhoodCache.get(
        cacheKey
      );

    let results: AddressSuggestion[];

    if (cached) {
      results = cached;
    } else {
      if (!this.districtLoadPromise) {
        this.districtLoadPromise =
          (async () => {
            const istanbulAreaId =
              await this.findIstanbulAreaId();

            if (!istanbulAreaId) {
              throw new Error(
                "İstanbul OSM alanı bulunamadı."
              );
            }

            const query =
              "[out:json][timeout:20];" +
              "area(" +
              istanbulAreaId +
              ")->.istanbulArea;" +
              'rel["boundary"="administrative"]["admin_level"="6"]["name"](area.istanbulArea);' +
              "out tags center;";

            const data =
              await this.fetchOverpass(
                query,
                10000
              );

            const elements =
              Array.isArray(
                data?.elements
              )
                ? data.elements
                : [];

            const unique =
              new Map<
                string,
                AddressSuggestion
              >();

            for (const item of elements) {
              const name =
                String(
                  item?.tags?.name ||
                    ""
                ).trim();

              const osmId =
                Number(item?.id);

              const lat =
                Number(
                  item?.center?.lat
                );

              const lng =
                Number(
                  item?.center?.lon
                );

              if (
                !name ||
                !Number.isFinite(
                  osmId
                ) ||
                !Number.isFinite(
                  lat
                ) ||
                !Number.isFinite(
                  lng
                )
              ) {
                continue;
              }

              const key =
                normalizeTurkish(
                  name
                );

              if (
                unique.has(
                  key
                )
              ) {
                continue;
              }

              unique.set(
                key,
                {
                  displayName:
                    name +
                    ", İstanbul, Türkiye",
                  formattedAddress:
                    name +
                    ", İstanbul, Türkiye",
                  lat,
                  lng,
                  name,
                  source:
                    "openstreetmap-overpass",
                  placeId:
                    "R" +
                    osmId,
                  osmType:
                    "relation",
                  osmId,
                  areaId:
                    3600000000 +
                    osmId,
                  kind:
                    "district",
                  parentCity:
                    "İstanbul",
                  types: [
                    "administrative",
                    "district",
                  ],
                }
              );
            }

            const loaded =
              Array.from(
                unique.values()
              ).sort(
                (a, b) =>
                  String(
                    a.name || ""
                  ).localeCompare(
                    String(
                      b.name || ""
                    ),
                    "tr"
                  )
              );

            if (
              loaded.length ===
              0
            ) {
              throw new Error(
                "İstanbul ilçe verisi boş döndü."
              );
            }

            this.districtNeighborhoodCache.set(
              cacheKey,
              loaded
            );

            return loaded;
          })().finally(() => {
            this.districtLoadPromise =
              null;
          });
      }

      results =
        await this.districtLoadPromise;
    }

    const cleanQuery =
      String(
        queryText || ""
      ).trim();

    return cleanQuery
      ? this.filterSuggestions(
          results,
          cleanQuery
        )
      : results;
  }

  async getDistrictSuggestions(
    queryText?: string
  ): Promise<AddressSuggestion[]> {
    try {
      return await this.getIstanbulDistrictSuggestions(
        queryText
      );
    } catch (error) {
      console.warn(
        "İstanbul ilçe listesi alınamadı:",
        error
      );
      return [];
    }
  }

  async getNeighborhoodSuggestionsForDistrict(
    district: AddressSuggestion,
    queryText?: string
  ): Promise<AddressSuggestion[]> {
    const districtName =
      String(district.name || "").trim();

    if (!districtName) return [];

    const neighborhoods =
      await this.getDistrictNeighborhoods(
        district
      );

    const cleanQuery =
      String(queryText || "").trim();

    if (!cleanQuery) {
      return neighborhoods;
    }

    return this.filterSuggestions(
      neighborhoods,
      cleanQuery
    );
  }

  private async getDistrictNeighborhoods(
    district: string
  ): Promise<AddressSuggestion[]> {
    const cacheKey =
      "neighborhoods:" +
      normalizeTurkish(district);

    const cached =
      this.districtNeighborhoodCache.get(
        cacheKey
      );

    if (cached) return cached;

    const districtRelation =
      await this.findIstanbulDistrictRelation(
        district
      );

    if (!districtRelation) {
      return [];
    }

    const query =
      "[out:json][timeout:20];" +
      "area(" +
      districtRelation.areaId +
      ")->.districtArea;" +
      "(" +
      'rel["boundary"="administrative"]["admin_level"="8"]["name"](area.districtArea);' +
      'rel["place"~"^(neighbourhood|quarter|suburb)$"]["name"](area.districtArea);' +
      'node["place"~"^(neighbourhood|quarter|suburb)$"]["name"](area.districtArea);' +
      'way["place"~"^(neighbourhood|quarter|suburb)$"]["name"](area.districtArea);' +
      ");" +
      "out tags center;";

    const data =
      await this.fetchOverpass(
        query,
        10000
      );

    const elements =
      Array.isArray(data?.elements)
        ? data.elements
        : [];

    const priority = {
      relation: 3,
      way: 2,
      node: 1,
    } as const;

    const unique =
      new Map<string, {
        suggestion: AddressSuggestion;
        priority: number;
      }>();

    for (const item of elements) {
      const name = String(
        item?.tags?.name || ""
      ).trim();

      const osmType =
        String(item?.type || "") as
          | "node"
          | "way"
          | "relation";

      if (
        !name ||
        !Object.prototype.hasOwnProperty.call(
          priority,
          osmType
        )
      ) {
        continue;
      }

      const osmId = Number(item?.id);
      if (!Number.isFinite(osmId)) continue;

      const lat = Number(
        item?.center?.lat ?? item?.lat
      );
      const lng = Number(
        item?.center?.lon ?? item?.lon
      );

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        continue;
      }

      const key =
        normalizeTurkish(name);

      const suggestion: AddressSuggestion = {
        displayName:
          name +
          " Mahallesi, " +
          district +
          ", İstanbul",
        formattedAddress:
          name +
          " Mahallesi, " +
          district +
          ", İstanbul",
        lat,
        lng,
        name,
        source:
          "openstreetmap-overpass",
        placeId:
          osmType.toUpperCase()[0] +
          osmId,
        osmType,
        osmId,
        areaId:
          osmType === "relation"
            ? 3600000000 + osmId
            : undefined,
        kind:
          "neighborhood",
        parentCity:
          "İstanbul",
        parentDistrict:
          districtName,
        types: [
          "neighborhood",
          String(
            item?.tags?.place ||
              "administrative"
          ),
        ],
      };

      const old = unique.get(key);
      const currentPriority =
        priority[osmType];

      if (
        !old ||
        currentPriority > old.priority
      ) {
        unique.set(key, {
          suggestion,
          priority:
            currentPriority,
        });
      }
    }

    const results =
      Array.from(unique.values())
        .map((entry) => entry.suggestion)
        .sort((a, b) =>
          String(a.name || "").localeCompare(
            String(b.name || ""),
            "tr"
          )
        );

    this.districtNeighborhoodCache.set(
      cacheKey,
      results
    );
    this.writePersistentAddressCache(
      cacheKey,
      results
    );

    return results;
  }

  private async findNeighborhoodBoundary(
    neighborhoodName: string,
    district: string
  ): Promise<{
    osmId: number;
    areaId: number;
    lat?: number;
    lng?: number;
  } | null> {
    const districtRelation =
      await this.findIstanbulDistrictRelation(
        district
      );

    if (!districtRelation) return null;

    const escapedName =
      String(neighborhoodName || "")
        .trim()
        .replace(/["\\]/g, "\\$&");

    const query =
      "[out:json][timeout:15];" +
      "area(" +
      districtRelation.areaId +
      ")->.districtArea;" +
      'rel["boundary"="administrative"]["admin_level"="8"]["name"="' +
      escapedName +
      '"](area.districtArea);' +
      "out tags center;";

    const data =
      await this.fetchOverpass(
        query,
        9000
      );

    const elements =
      Array.isArray(data?.elements)
        ? data.elements
        : [];

    const relation =
      elements.find(
        (item: any) =>
          String(item?.type) === "relation" &&
          Number.isFinite(Number(item?.id))
      );

    if (!relation) return null;

    const osmId = Number(relation.id);

    return {
      osmId,
      areaId:
        3600000000 + osmId,
      lat:
        Number(relation?.center?.lat) ||
        undefined,
      lng:
        Number(relation?.center?.lon) ||
        undefined,
    };
  }

  private async getNeighborhoodStreets(
    neighborhood: AddressSuggestion,
    district: string,
    queryText?: string
  ): Promise<AddressSuggestion[]> {
    const districtName =
      String(district || "").trim();

    const neighborhoodName =
      String(
        neighborhood.name || ""
      ).trim();

    if (
      !districtName ||
      !neighborhoodName
    ) {
      return [];
    }

    const cacheKey =
      "streets:" +
      normalizeTurkish(districtName) +
      ":" +
      normalizeTurkish(neighborhoodName);

    let cached =
      this.neighborhoodStreetCache.get(
        cacheKey
      );

    if (!cached) {
      let areaId =
        neighborhood.areaId;

      let osmType =
        neighborhood.osmType;

      if (
        !areaId ||
        (osmType !== "relation" &&
          osmType !== "way")
      ) {
        const boundary =
          await this.findNeighborhoodBoundary(
            neighborhoodName,
            districtName
          );

        if (boundary) {
          areaId =
            boundary.areaId;
          osmType =
            "relation";
        }
      }

      if (!areaId || osmType !== "relation") {
        /*
         * Sınırı doğrulanamayan mahallede yanlış sokakları
         * “mahalleye ait” diye göstermemek için sonuç üretme.
         */
        return [];
      }

      const query =
        "[out:json][timeout:25];" +
        "area(" +
        areaId +
        ")->.searchArea;" +
        'way["highway"]["name"](area.searchArea);' +
        "out tags center;";

      const data =
        await this.fetchOverpass(
          query,
          12000
        );

      const elements =
        Array.isArray(data?.elements)
          ? data.elements
          : [];

      const excluded =
        new Set([
          "footway",
          "path",
          "cycleway",
          "steps",
          "track",
          "construction",
          "proposed",
          "raceway",
          "bridleway",
        ]);

      const unique =
        new Map<string, AddressSuggestion>();

      for (const item of elements) {
        const name = String(
          item?.tags?.name || ""
        ).trim();

        const highway = String(
          item?.tags?.highway || ""
        ).trim();

        if (
          !name ||
          excluded.has(highway)
        ) {
          continue;
        }

        const lat = Number(
          item?.center?.lat
        );
        const lng = Number(
          item?.center?.lon
        );

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          continue;
        }

        const key =
          normalizeTurkish(name);

        if (unique.has(key)) continue;

        const osmId = Number(item?.id);
        if (!Number.isFinite(osmId)) continue;

        unique.set(
          key,
          {
            displayName:
              name +
              ", " +
              neighborhoodName +
              " Mahallesi, " +
              districtName +
              ", İstanbul",
            formattedAddress:
              name +
              ", " +
              neighborhoodName +
              " Mahallesi, " +
              districtName +
              ", İstanbul",
            lat,
            lng,
            name,
            source:
              "openstreetmap-overpass",
            placeId:
              "W" + osmId,
            osmType: "way",
            osmId,
            kind: "street",
            parentCity:
              "İstanbul",
            parentDistrict:
              districtName,
            parentNeighborhood:
              neighborhoodName,
            street: name,
            streetNumber: "",
            types: [
              "street",
              highway || "road",
            ],
          }
        );
      }

      cached =
        Array.from(unique.values()).sort(
          (a, b) =>
            String(a.name || "").localeCompare(
              String(b.name || ""),
              "tr"
            )
        );

      this.neighborhoodStreetCache.set(
        cacheKey,
        cached
      );
    }

    const cleanQuery =
      String(queryText || "").trim();

    if (!cleanQuery) return cached;

    return this.filterSuggestions(
      cached,
      cleanQuery
    );
  }

  async getStreetSuggestionsForNeighborhood(
    neighborhood: AddressSuggestion,
    district?: AddressSuggestion | string | null,
    queryText?: string
  ): Promise<AddressSuggestion[]> {
    const districtName =
      typeof district === "string"
        ? district
        : String(
            district?.name ||
              neighborhood.parentDistrict ||
              ""
          ).trim();

    return this.getNeighborhoodStreets(
      neighborhood,
      districtName,
      queryText
    );
  }

  async getAddressSuggestionsForStreet(
    street: AddressSuggestion,
    neighborhood: AddressSuggestion,
    district?: AddressSuggestion | string | null,
    queryText?: string
  ): Promise<AddressSuggestion[]> {
    const districtName =
      typeof district === "string"
        ? district
        : String(
            district?.name ||
              neighborhood.parentDistrict ||
              street.parentDistrict ||
              ""
          ).trim();

    const neighborhoodName =
      String(
        neighborhood.name ||
          street.parentNeighborhood ||
          ""
      ).trim();

    if (
      !districtName ||
      !neighborhoodName ||
      !street.street
    ) {
      return [];
    }

    const boundary =
      neighborhood.areaId &&
      neighborhood.osmType === "relation"
        ? {
            areaId:
              neighborhood.areaId,
          }
        : await this.findNeighborhoodBoundary(
            neighborhoodName,
            districtName
          );

    if (!boundary) return [];

    const escapedStreet =
      String(street.street)
        .trim()
        .replace(/["\\]/g, "\\$&");

    const cacheKey =
      "addresses:" +
      normalizeTurkish(
        districtName
      ) +
      ":" +
      normalizeTurkish(
        neighborhoodName
      ) +
      ":" +
      normalizeTurkish(
        street.street
      );

    const cached =
      this.neighborhoodStreetCache.get(
        cacheKey
      ) ||
      this.readPersistentAddressCache(
        cacheKey
      );

    if (
      cached
    ) {
      return queryText?.trim()
        ? this.filterSuggestions(
            cached,
            queryText
          )
        : cached;
    }

    const query =
      "[out:json][timeout:25];" +
      "area(" +
      boundary.areaId +
      ")->.searchArea;" +
      'nwr["addr:housenumber"]["addr:street"="' +
      escapedStreet +
      '"](area.searchArea);' +
      "out tags center;";

    try {
      const data =
        await this.fetchOverpass(
          query,
          12000
        );

      const elements =
        Array.isArray(data?.elements)
          ? data.elements
          : [];

      const unique =
        new Map<string, AddressSuggestion>();

      for (const item of elements) {
        const houseNumber =
          String(
            item?.tags?.["addr:housenumber"] ||
              ""
          ).trim();

        if (!houseNumber) continue;

        const lat = Number(
          item?.center?.lat ??
            item?.lat
        );
        const lng = Number(
          item?.center?.lon ??
            item?.lon
        );

        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          continue;
        }

        const osmId =
          Number(item?.id);

        const osmTypeRaw =
          String(
            item?.type || ""
          );

        const osmType =
          osmTypeRaw === "node" ||
          osmTypeRaw === "way" ||
          osmTypeRaw === "relation"
            ? (
                osmTypeRaw as
                  | "node"
                  | "way"
                  | "relation"
              )
            : undefined;

        const displayName =
          street.street +
          " No: " +
          houseNumber +
          ", " +
          neighborhoodName +
          " Mahallesi, " +
          districtName +
          ", İstanbul";

        const suggestion:
          AddressSuggestion = {
          displayName,
          formattedAddress:
            displayName,
          lat,
          lng,
          name:
            street.street,
          source:
            "openstreetmap-overpass",
          placeId:
            Number.isFinite(osmId) &&
            osmType
              ? osmType.toUpperCase()[0] +
                osmId
              : undefined,
          osmType,
          osmId:
            Number.isFinite(osmId)
              ? osmId
              : undefined,
          kind:
            "address",
          parentCity:
            "İstanbul",
          parentDistrict:
            districtName,
          parentNeighborhood:
            neighborhoodName,
          street:
            street.street,
          streetNumber:
            houseNumber,
          types: [
            "address",
            "building",
            "housenumber",
          ],
        };

        const key =
          [
            normalizeTurkish(
              street.street
            ),
            houseNumber,
          ].join("|");

        if (!unique.has(key)) {
          unique.set(
            key,
            suggestion
          );
        }
      }

      const results =
        Array.from(
          unique.values()
        ).sort((a, b) =>
          String(
            a.streetNumber || ""
          ).localeCompare(
            String(
              b.streetNumber || ""
            ),
            "tr",
            {
              numeric: true,
            }
          )
        );

      const cleanQuery =
        String(queryText || "").trim();

      return cleanQuery
        ? this.filterSuggestions(
            results,
            cleanQuery
          )
        : results;
    } catch (error) {
      console.warn(
        "Gerçek bina numaraları alınamadı:",
        error
      );
      return [];
    }
  }

  private rankNeighborhood(
    neighborhood: AddressSuggestion,
    query: string
  ): number {
    const name =
      normalizeTurkish(
        String(
          neighborhood.name || ""
        )
      );

    const normalizedQuery =
      normalizeTurkish(query);

    if (!normalizedQuery) return 0;

    if (name === normalizedQuery) return 1000;
    if (name.startsWith(normalizedQuery)) return 700;
    if (name.includes(normalizedQuery)) return 500;

    return 0;
  }

  private filterSuggestions(
    suggestions: AddressSuggestion[],
    query: string
  ): AddressSuggestion[] {
    const normalized =
      normalizeTurkish(
        this.normalizeQueryForHierarchy(
          query
        )
      );

    if (!normalized) {
      return suggestions;
    }

    return suggestions
      .map((item) => {
        const name =
          normalizeTurkish(
            String(item.name || "")
          );
        let score = 0;

        if (name === normalized) {
          score = 1000;
        } else if (
          name.startsWith(normalized)
        ) {
          score = 700;
        } else if (
          name.includes(normalized)
        ) {
          score = 500;
        }

        return {
          item,
          score,
        };
      })
      .filter(
        (entry) => entry.score > 0
      )
      .sort(
        (a, b) => b.score - a.score
      )
      .map(
        (entry) => entry.item
      );
  }

  private async resolveDistrictForQuery(
    query: string,
    knownDistricts?: AddressSuggestion[]
  ): Promise<AddressSuggestion | null> {
    const districts =
      knownDistricts ||
      (await this.getIstanbulDistrictSuggestions());

    return this.findDistrictInQuery(
      query,
      districts
    );
  }

  private async searchIstanbulAddressHierarchy(
    cleanQuery: string,
    districtHint?: AddressSuggestion | null
  ): Promise<AddressSuggestion[] | null> {
    const district =
      districtHint;

    if (!district?.name) {
      return null;
    }

    const districtName =
      String(
        district.name
      ).trim();

    const remainder =
      this.removeHierarchyLabels(
        cleanQuery,
        districtName
      );

    const neighborhoods =
      await this.getDistrictNeighborhoods(
        districtName
      );

    if (!remainder) {
      return neighborhoods;
    }

    const normalizedRemainder =
      normalizeTurkish(
        remainder
      );

    const ranked =
      this.filterSuggestions(
        neighborhoods,
        normalizedRemainder
      );

    if (!ranked.length) {
      return neighborhoods;
    }

    const best =
      ranked[0];

    const bestName =
      normalizeTurkish(
        String(
          best.name || ""
        )
      );

    if (
      normalizedRemainder ===
      bestName
    ) {
      const streets =
        await this.getNeighborhoodStreets(
          best,
          districtName
        );

      return streets.length
        ? streets
        : [best];
    }

    return ranked.slice(
      0,
      50
    );
  }

  private async searchNominatimSuggestions(
    cleanQuery: string
  ): Promise<AddressSuggestion[]> {
    const params = new URLSearchParams();

    params.set(
      "q",
      cleanQuery + ", Türkiye"
    );
    params.set(
      "format",
      "geocodejson"
    );
    params.set(
      "addressdetails",
      "1"
    );
    params.set(
      "limit",
      "12"
    );
    params.set(
      "countrycodes",
      "tr"
    );
    params.set(
      "accept-language",
      "tr"
    );

    const response =
      await fetch(
        MAP_CONFIG.searchUrl +
          "?" +
          params.toString(),
        {
          headers: {
            Accept:
              "application/json",
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        "Nominatim HTTP " +
          response.status
      );
    }

    const data =
      await response.json();

    const features =
      Array.isArray(data?.features)
        ? data.features
        : [];

    const unique =
      new Map<string, AddressSuggestion>();

    for (const feature of features) {
      const properties =
        feature?.properties || {};
      const geocoding =
        properties?.geocoding || {};
      const geometry =
        feature?.geometry || {};

      const coordinates =
        Array.isArray(
          geometry?.coordinates
        )
          ? geometry.coordinates
          : [];

      const lng =
        Number(coordinates[0]);
      const lat =
        Number(coordinates[1]);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < 35 ||
        lat > 43 ||
        lng < 25 ||
        lng > 45
      ) {
        continue;
      }

      const type =
        normalizeTurkish(
          String(
            geocoding?.type ||
              ""
          )
        );

      const osmKey =
        normalizeTurkish(
          String(
            geocoding?.osm_key ||
              ""
          )
        );

      const osmValue =
        normalizeTurkish(
          String(
            geocoding?.osm_value ||
              ""
          )
        );

      const name =
        String(
          geocoding?.name ||
            ""
        ).trim();

      const label =
        String(
          geocoding?.label ||
            feature?.properties
              ?.display_name ||
            ""
        ).trim();

      const street =
        String(
          geocoding?.street ||
            ""
        ).trim();

      const houseNumber =
        String(
          geocoding?.housenumber ||
            ""
        ).trim();

      const district =
        String(
          geocoding?.district ||
            geocoding?.county ||
            ""
        ).trim();

      const province =
        String(
          geocoding?.city ||
            geocoding?.state ||
            ""
        ).trim();

      const neighborhood =
        String(
          geocoding?.locality ||
            geocoding?.neighbourhood ||
            geocoding?.suburb ||
            geocoding?.quarter ||
            ""
        ).trim();

      let kind:
        AddressSuggestion["kind"];

      if (
        type === "house" ||
        Boolean(
          houseNumber &&
            street
        )
      ) {
        kind = "address";
      } else if (
        type === "street" ||
        osmKey === "highway" ||
        Boolean(street)
      ) {
        kind = "street";
      } else if (
        type === "locality" ||
        type === "neighbourhood" ||
        type === "quarter" ||
        type === "suburb" ||
        osmValue === "neighbourhood" ||
        osmValue === "quarter" ||
        osmValue === "suburb"
      ) {
        kind = "neighborhood";
      } else if (
        type === "district" ||
        type === "county"
      ) {
        kind = "district";
      } else if (
        type === "city" ||
        type === "state"
      ) {
        kind = "city";
      }

      /*
       * GeocodeJSON district/county ayrımını doğrudan semt/mahalle
       * olarak yanlış yorumlamamak için, yalnız OSM place değerleri
       * gerçek mahalle sayılır.
       */
      if (
        kind === "neighborhood" &&
        !(
          type === "locality" ||
          type === "neighbourhood" ||
          type === "quarter" ||
          type === "suburb" ||
          osmValue === "neighbourhood" ||
          osmValue === "quarter" ||
          osmValue === "suburb"
        )
      ) {
        kind =
          district
            ? "district"
            : "city";
      }

      const osmId =
        Number(
          feature?.properties
            ?.geocoding
            ?.osm_id
        ) ||
        Number(
          feature?.properties
            ?.osm_id
        );

      const osmTypeRaw =
        String(
          feature?.properties
            ?.geocoding
            ?.osm_type ||
            feature?.properties
              ?.osm_type ||
            ""
        ).toLowerCase();

      const osmType =
        osmTypeRaw === "node" ||
        osmTypeRaw === "way" ||
        osmTypeRaw === "relation"
          ? (
              osmTypeRaw as
                | "node"
                | "way"
                | "relation"
            )
          : undefined;

      const displayName =
        label ||
        [
          name,
          houseNumber
            ? "No:" +
              houseNumber
            : "",
          street,
          neighborhood,
          district,
          province,
        ]
          .filter(Boolean)
          .join(", ");

      const suggestion:
        AddressSuggestion = {
        displayName,
        formattedAddress:
          displayName,
        lat,
        lng,
        name:
          name ||
          neighborhood ||
          street ||
          cleanQuery,
        source:
          "openstreetmap-nominatim",
        placeId:
          Number.isFinite(
            osmId
          ) && osmType
            ? osmType.toUpperCase()[0] +
              osmId
            : undefined,
        osmType,
        osmId:
          Number.isFinite(osmId)
            ? osmId
            : undefined,
        kind,
        parentCity:
          province ||
          undefined,
        parentDistrict:
          district ||
          undefined,
        parentNeighborhood:
          neighborhood ||
          undefined,
        street:
          street ||
          undefined,
        streetNumber:
          houseNumber,
        types: [
          type,
          osmKey,
          osmValue,
        ].filter(Boolean),
      };

      const key =
        suggestion.placeId ||
        normalizeTurkish(
          [
            kind || "",
            suggestion.name || "",
            district,
            province,
            lat.toFixed(5),
            lng.toFixed(5),
          ].join("|")
        );

      if (!unique.has(key)) {
        unique.set(
          key,
          suggestion
        );
      }
    }

    return Array.from(
      unique.values()
    ).slice(0, 12);
  }

  private async searchPhotonSuggestions(
    cleanQuery: string
  ): Promise<AddressSuggestion[]> {
    const params =
      new URLSearchParams();

    params.set(
      "q",
      cleanQuery + ", Türkiye"
    );
    params.set(
      "limit",
      "12"
    );
    params.set(
      "lang",
      "tr"
    );

    const normalized =
      normalizeTurkish(cleanQuery);

    if (
      normalized.includes("istanbul")
    ) {
      params.set(
        "bbox",
        "28.40,40.80,29.55,41.35"
      );
    }

    const response =
      await fetch(
        "https://photon.komoot.io/api/?" +
          params.toString(),
        {
          headers: {
            Accept:
              "application/json",
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        "Photon HTTP " +
          response.status
      );
    }

    const data =
      await response.json();

    const features =
      Array.isArray(data?.features)
        ? data.features
        : [];

    const unique =
      new Map<string, AddressSuggestion>();

    for (const feature of features) {
      const coordinates =
        feature?.geometry
          ?.coordinates;

      if (
        !Array.isArray(coordinates) ||
        coordinates.length < 2
      ) {
        continue;
      }

      const lng =
        Number(coordinates[0]);
      const lat =
        Number(coordinates[1]);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        continue;
      }

      const properties =
        feature?.properties || {};

      const name =
        String(
          properties?.name || ""
        ).trim();

      const street =
        String(
          properties?.street ||
            properties?.name ||
            ""
        ).trim();

      const houseNumber =
        String(
          properties?.housenumber ||
            ""
        ).trim();

      const city =
        String(
          properties?.city ||
            properties?.county ||
            properties?.state ||
            ""
        ).trim();

      const displayParts = [
        houseNumber
          ? "No:" + houseNumber
          : "",
        street,
        properties?.district,
        city,
        properties?.postcode,
      ].filter(Boolean);

      const displayName =
        displayParts.length > 0
          ? displayParts.join(", ")
          : String(
              name ||
                cleanQuery
            );

      const osmId =
        Number(
          properties?.osm_id
        );

      const osmTypeRaw =
        String(
          properties?.osm_type ||
            ""
        ).toLowerCase();

      const osmType =
        osmTypeRaw === "node" ||
        osmTypeRaw === "way" ||
        osmTypeRaw === "relation"
          ? osmTypeRaw
          : undefined;

      const suggestion: AddressSuggestion = {
        displayName,
        formattedAddress:
          displayName,
        lat,
        lng,
        name:
          name ||
          street ||
          displayName,
        source:
          "openstreetmap-photon",
        placeId:
          Number.isFinite(osmId) &&
          osmType
            ? osmType.toUpperCase()[0] +
              osmId
            : undefined,
        osmType,
        osmId:
          Number.isFinite(osmId)
            ? osmId
            : undefined,
        kind:
          street && houseNumber
            ? "address"
            : "street",
        street,
        streetNumber:
          houseNumber,
        types: [
          String(
            properties?.osm_key ||
              ""
          ),
          String(
            properties?.osm_value ||
              ""
          ),
        ].filter(Boolean),
      };

      const key =
        suggestion.placeId ||
        lat + "," + lng;

      if (!unique.has(key)) {
        unique.set(
          key,
          suggestion
        );
      }
    }

    return Array.from(
      unique.values()
    ).slice(0, 12);
  }

  private async searchAddressSuggestionsInternal(
    cleanQuery: string,
    context?: AddressSearchContext
  ): Promise<AddressSuggestion[]> {
    const normalized =
      normalizeTurkish(
        this.normalizeQueryForHierarchy(
          cleanQuery
        )
      );

    /*
     * 1. Seçili mahalle varsa:
     *    başka mahalle yazılırsa mahalle seçimi gösterilir;
     *    aynı mahallede sokak aranıyorsa yalnız bu mahallenin
     *    sokaklarını filtrele.
     */
    if (
      context?.neighborhood
    ) {
      const districtName =
        String(
          context.neighborhood
            .parentDistrict ||
            context.district?.name ||
            ""
        ).trim();

      if (districtName) {
        const neighborhoods =
          await this.getDistrictNeighborhoods(
            districtName
          );

        const candidateQuery =
          this.removeHierarchyLabels(
            cleanQuery,
            districtName
          );

        const matches =
          this.filterSuggestions(
            neighborhoods,
            candidateQuery
          );

        const currentName =
          normalizeTurkish(
            String(
              context.neighborhood
                .name || ""
            )
          );

        const differentNeighborhood =
          matches.filter(
            (item) =>
              normalizeTurkish(
                String(
                  item.name || ""
                )
              ) !==
              currentName
          );

        if (
          differentNeighborhood.length >
          0
        ) {
          return differentNeighborhood.slice(
            0,
            50
          );
        }

        const streets =
          await this.getNeighborhoodStreets(
            context.neighborhood,
            districtName,
            cleanQuery
          );

        if (
          streets.length > 0
        ) {
          return streets;
        }
      }
    }

    /*
     * 2. Seçili ilçe varsa mahalle havuzu doğrudan o ilçe alanından gelir.
     */
    if (
      context?.district?.name
    ) {
      const districtName =
        String(
          context.district.name
        ).trim();

      const candidateQuery =
        this.removeHierarchyLabels(
          cleanQuery,
          districtName
        );

      const neighborhoods =
        await this.getDistrictNeighborhoods(
          districtName
        );

      const matches =
        this.filterSuggestions(
          neighborhoods,
          candidateQuery
        );

      if (
        matches.length > 0
      ) {
        const exact =
          matches.find(
            (item) =>
              normalizeTurkish(
                String(
                  item.name || ""
                )
              ) ===
              normalizeTurkish(
                candidateQuery
              )
          );

        if (exact) {
          const streets =
            await this.getNeighborhoodStreets(
              exact,
              districtName
            );

          return streets.length
            ? streets
            : [exact];
        }

        return matches.slice(
          0,
          50
        );
      }
    }

    /*
     * 3. Genel sorgu: önce gerçek Nominatim sonucu.
     */
    let nominatimResults:
      AddressSuggestion[] = [];

    try {
      nominatimResults =
        await this.searchNominatimSuggestions(
          cleanQuery
        );
    } catch (error) {
      console.warn(
        "Nominatim araması başarısız:",
        error
      );
    }

    /*
     * 4. İstanbul yazıldığında doğrudan gerçek İstanbul ilçe havuzuna geç.
     * Bu veri hard-code değildir; Overpass'taki güncel admin_level=6
     * ilişkilerinden gelir.
     */
    if (
      normalized ===
      "istanbul"
    ) {
      try {
        const districts =
          await this.getIstanbulDistrictSuggestions();

        if (
          districts.length > 0
        ) {
          return districts;
        }
      } catch (error) {
        console.warn(
          "İstanbul ilçe havuzu alınamadı:",
          error
        );
      }
    }

    /*
     * 5. "avc" gibi kısmi ilçe sorgularında önce Nominatim,
     * sonra gerçek Overpass ilçe havuzu.
     */
    const nominatimDistricts =
      nominatimResults.filter(
        (result) =>
          result.kind ===
          "district"
      );

    const nominatimDistrictMatches =
      this.filterSuggestions(
        nominatimDistricts,
        cleanQuery
      );

    if (
      nominatimDistrictMatches.length >
      0
    ) {
      const exact =
        nominatimDistrictMatches.find(
          (item) =>
            normalizeTurkish(
              String(
                item.name || ""
              )
            ) ===
            normalized
        );

      if (
        exact
      ) {
        const neighborhoods =
          await this.getDistrictNeighborhoods(
            exact.name || ""
          );

        return neighborhoods;
      }

      return nominatimDistrictMatches;
    }

    let districts:
      AddressSuggestion[] = [];

    try {
      districts =
        await this.getIstanbulDistrictSuggestions();
    } catch (error) {
      console.warn(
        "İlçe havuzu alınamadı:",
        error
      );
    }

    const partialDistricts =
      this.filterSuggestions(
        districts,
        cleanQuery
      );

    if (
      partialDistricts.length >
      0 &&
      this.normalizeQueryForHierarchy(
        cleanQuery
      ).split(" ").length ===
        1
    ) {
      const exact =
        partialDistricts.find(
          (item) =>
            normalizeTurkish(
              String(
                item.name || ""
              )
            ) ===
            normalized
        );

      if (
        exact
      ) {
        const neighborhoods =
          await this.getDistrictNeighborhoods(
            exact.name || ""
          );

        return neighborhoods;
      }

      return partialDistricts.slice(
        0,
        20
      );
    }

    /*
     * 6. "Avcılar Cihangir" gibi bileşik yazımı yalnız ilgili
     * ilçe içindeki mahalle havuzuna bağla.
     */
    const districtMatch =
      this.findDistrictInQuery(
        cleanQuery,
        districts
      );

    if (
      districtMatch
    ) {
      const hierarchyResults =
        await this.searchIstanbulAddressHierarchy(
          cleanQuery,
          districtMatch
        );

      if (
        hierarchyResults
      ) {
        return hierarchyResults;
      }
    }

    /*
     * 7. Tek başına gerçek mahalle sonucu:
     * ilçe bağlamı varsa canonical Overpass relation üzerinden
     * sokakları getir; birden fazla gerçek mahalle sonucu varsa
     * hepsini kullanıcıya göster.
     */
    const neighborhoodResults =
      nominatimResults.filter(
        (result) =>
          result.kind ===
          "neighborhood"
      );

    if (
      neighborhoodResults.length >
      0
    ) {
      const exact =
        neighborhoodResults.filter(
          (item) =>
            normalizeTurkish(
              String(
                item.name || ""
              )
            ) ===
            normalized
        );

      if (
        exact.length ===
          1 &&
        exact[0].parentDistrict
      ) {
        const canonicalCandidates =
          await this.getDistrictNeighborhoods(
            exact[0].parentDistrict
          );

        const canonical =
          canonicalCandidates.find(
            (item) =>
              normalizeTurkish(
                String(
                  item.name || ""
                )
              ) ===
              normalized
          );

        if (
          canonical
        ) {
          const streets =
            await this.getNeighborhoodStreets(
              canonical,
              exact[0].parentDistrict
            );

          if (
            streets.length > 0
          ) {
            return streets;
          }
        }
      }

      return neighborhoodResults;
    }

    if (
      nominatimResults.length >
      0
    ) {
      return nominatimResults;
    }

    return this.searchPhotonSuggestions(
      cleanQuery
    );
  }

  private async searchAddressSuggestionsWithCache(
    cleanQuery: string,
    context?: AddressSearchContext
  ): Promise<AddressSuggestion[]> {
    const contextKey =
      [
        context?.district?.name || "",
        context?.neighborhood?.name || "",
        context?.street?.street || "",
      ]
        .map(normalizeTurkish)
        .join("|");

    const cacheKey =
      normalizeTurkish(
        cleanQuery
      ) +
      "::" +
      contextKey;

    const cached =
      this.addressSuggestionCache.get(
        cacheKey
      );

    if (cached) {
      return cached;
    }

    const results =
      await this.searchAddressSuggestionsInternal(
        cleanQuery,
        context
      );

    this.addressSuggestionCache.set(
      cacheKey,
      results
    );

    return results;
  }

  async resolveAddressSuggestion(
    suggestion: AddressSuggestion
  ): Promise<AddressSuggestion> {
    if (
      suggestion.kind !== "neighborhood" ||
      !suggestion.name
    ) {
      return suggestion;
    }

    const parentDistrict =
      String(
        suggestion.parentDistrict || ""
      ).trim();

    if (!parentDistrict) {
      return suggestion;
    }

    try {
      const neighborhoods =
        await this.getDistrictNeighborhoods(
          parentDistrict
        );

      const normalizedName =
        normalizeTurkish(
          suggestion.name
        );

      const canonical =
        neighborhoods.find(
          (neighborhood) =>
            normalizeTurkish(
              String(
                neighborhood.name || ""
              )
            ) ===
            normalizedName
        );

      return canonical || suggestion;
    } catch (error) {
      console.warn(
        "Mahalle OSM alanı eşleştirilemedi:",
        error
      );
      return suggestion;
    }
  }

  getConfig(): MapServiceConfig {
    return {
      ...MAP_CONFIG,
    };
  }

  async getAddressSuggestions(
    query: string
  ): Promise<AddressSuggestion[]> {
    const cleanQuery = query.trim();

    if (cleanQuery.length < 2) {
      return [];
    }

    try {
      return await this.searchNominatimSuggestions(
        cleanQuery
      );
    } catch {
      return [];
    }
  }

  async searchAddressSuggestions(
    query: string,
    context?: AddressSearchContext
  ): Promise<AddressSuggestion[]> {
    const cleanQuery = query.trim();

    if (cleanQuery.length < 3) {
      return [];
    }

    const now = Date.now();
    const elapsed =
      now - this.lastAddressSearchAt;

    if (elapsed < 1100) {
      await new Promise<void>((resolve) =>
        setTimeout(
          resolve,
          1100 - elapsed
        )
      );
    }

    this.lastAddressSearchAt =
      Date.now();

    try {
      return await this.searchAddressSuggestionsWithCache(
        cleanQuery,
        context
      );
    } catch (error) {
      console.warn(
        "Adres önerileri alınamadı:",
        error
      );

      return [];
    }
  }
  async geocode(
    address: string
  ): Promise<GeoCoordinate | null> {
    return this.geocodeAddress(address);
  }

  async geocodeAddress(
    address: string
  ): Promise<GeoCoordinate | null> {
    const cleanAddress = address.trim();

    if (!cleanAddress) {
      return null;
    }

    /*
     * ----------------------------------------------------------
     * 1. PHOTON
     * ----------------------------------------------------------
     */

    try {
      const photonParams =
        new URLSearchParams();

      photonParams.set(
        "q",
        cleanAddress + ", Türkiye"
      );

      photonParams.set(
        "limit",
        "5"
      );

      const photonResponse =
        await fetch(
          "https://photon.komoot.io/api/?" +
            photonParams.toString(),
          {
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      if (photonResponse.ok) {
        const photonData =
          (await photonResponse.json()) as {
            features?: Array<{
              geometry?: {
                coordinates?: number[];
              };
              properties?: {
                name?: string;
                city?: string;
                county?: string;
                state?: string;
                country?: string;
              };
            }>;
          };

        const features =
          photonData.features || [];

        /*
         * Türkiye dışındaki veya koordinatsız
         * sonuçları mümkün olduğunca ele.
         */
        const validFeature =
          features.find((feature) => {
            const coordinates =
              feature.geometry
                ?.coordinates;

            if (
              !coordinates ||
              coordinates.length < 2
            ) {
              return false;
            }

            const lng =
              Number(coordinates[0]);

            const lat =
              Number(coordinates[1]);

            return (
              Number.isFinite(lat) &&
              Number.isFinite(lng) &&
              lat >= 35 &&
              lat <= 43 &&
              lng >= 25 &&
              lng <= 45
            );
          });

        if (validFeature) {
          const coordinates =
            validFeature.geometry
              ?.coordinates;

          if (coordinates) {
            const lng =
              Number(coordinates[0]);

            const lat =
              Number(coordinates[1]);

            const properties =
              validFeature.properties ||
              {};

            const parts = [
              properties.name,
              properties.county,
              properties.city,
              properties.state,
            ].filter(
              (value) =>
                typeof value ===
                  "string" &&
                value.trim()
            );

            console.log(
              "🟢 Photon adres bulundu:",
              cleanAddress,
              lat,
              lng
            );

            return {
              lat,
              lng,
              name:
                parts.length > 0
                  ? parts.join(", ")
                  : cleanAddress,
            };
          }
        }
      }
    } catch (error) {
      console.warn(
        "⚠️ Photon geocoding başarısız, Nominatim deneniyor:",
        error
      );
    }

    /*
     * ----------------------------------------------------------
     * 2. NOMINATIM YEDEK SERVİS
     * ----------------------------------------------------------
     */

    try {
      const nominatimParams =
        new URLSearchParams();

      nominatimParams.set(
        "q",
        cleanAddress + ", Türkiye"
      );

      nominatimParams.set(
        "format",
        "json"
      );

      nominatimParams.set(
        "addressdetails",
        "1"
      );

      nominatimParams.set(
        "limit",
        "5"
      );

      nominatimParams.set(
        "countrycodes",
        "tr"
      );

      const response =
        await fetch(
          MAP_CONFIG.searchUrl +
            "?" +
            nominatimParams.toString(),
          {
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      if (response.ok) {
        const data =
          (await response.json()) as Array<{
            display_name?: string;
            lat?: string;
            lon?: string;
          }>;

        const validResult =
          data.find((item) => {
            const lat =
              Number(item.lat);

            const lng =
              Number(item.lon);

            return (
              Number.isFinite(lat) &&
              Number.isFinite(lng) &&
              lat >= 35 &&
              lat <= 43 &&
              lng >= 25 &&
              lng <= 45
            );
          });

        if (validResult) {
          const lat =
            Number(validResult.lat);

          const lng =
            Number(validResult.lon);

          console.log(
            "🟢 Nominatim adres bulundu:",
            cleanAddress,
            lat,
            lng
          );

          return {
            lat,
            lng,
            name:
              validResult.display_name ||
              cleanAddress,
          };
        }
      }
    } catch (error) {
      console.warn(
        "⚠️ Nominatim geocoding başarısız:",
        error
      );
    }

    console.warn(
      "❌ Adres hiçbir harita servisinde bulunamadı:",
      cleanAddress
    );

    return null;
  }

  async calculateRoadRoute(
    start: GeoCoordinate,
    end: GeoCoordinate
  ): Promise<{
    distanceKm: number;
    routePoints: [number, number][];
  } | null> {
    if (
      !isValidCoordinate(start) ||
      !isValidCoordinate(end)
    ) {
      return null;
    }

    try {
      const url =
        MAP_CONFIG.routeUrl +
        "/" +
        start.lng +
        "," +
        start.lat +
        ";" +
        end.lng +
        "," +
        end.lat +
        "?overview=full&geometries=geojson";

      const response =
        await fetch(url);

      if (!response.ok) {
        console.warn(
          "OSRM HTTP hatası:",
          response.status
        );

        return null;
      }

      const data =
        (await response.json()) as {
          routes?: Array<{
            distance?: number;
            geometry?: {
              coordinates?: Array<
                [number, number]
              >;
            };
          }>;
        };

      const route =
        data.routes?.[0];

      if (!route) {
        return null;
      }

      const distanceKm =
        Number(route.distance || 0) /
        1000;

      const coordinates =
        route.geometry?.coordinates ||
        [];

      const routePoints =
        coordinates
          .filter(
            (point) =>
              Array.isArray(point) &&
              point.length >= 2 &&
              Number.isFinite(
                Number(point[0])
              ) &&
              Number.isFinite(
                Number(point[1])
              )
          )
          .map(
            (point) =>
              [
                Number(point[1]),
                Number(point[0]),
              ] as [
                number,
                number
              ]
          );

      return {
        distanceKm,
        routePoints,
      };
    } catch (error) {
      console.warn(
        "⚠️ OSRM rota hatası:",
        error
      );

      return null;
    }
  }

  async calculateDistanceFromCoordinates(
    pickupCoords: GeoCoordinate,
    deliveryCoords: GeoCoordinate
  ): Promise<{
    success: boolean;
    isAutoCalculated: boolean;
    distanceKm: number;
    routePoints: [number, number][];
    pickupCoords: GeoCoordinate | null;
    deliveryCoords: GeoCoordinate | null;
    approximateDistanceText: string;
    error?: string;
  }> {
    if (!isValidCoordinate(pickupCoords) || !isValidCoordinate(deliveryCoords)) {
      return {
        success: false,
        isAutoCalculated: false,
        distanceKm: 0,
        routePoints: [],
        pickupCoords: null,
        deliveryCoords: null,
        approximateDistanceText: "",
        error: "Seçilen adres koordinatları geçersiz.",
      };
    }

    const route = await this.calculateRoadRoute(pickupCoords, deliveryCoords);
    const fallbackDistance = haversineDistance(pickupCoords, deliveryCoords);

    let distanceKm = route?.distanceKm && route.distanceKm > 0
      ? route.distanceKm
      : fallbackDistance;

    const routePoints = route?.routePoints?.length
      ? route.routePoints
      : [
          [pickupCoords.lat, pickupCoords.lng],
          [deliveryCoords.lat, deliveryCoords.lng],
        ] as [number, number][];

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      return {
        success: false,
        isAutoCalculated: false,
        distanceKm: 0,
        routePoints,
        pickupCoords,
        deliveryCoords,
        approximateDistanceText: "",
        error: "Seçilen adresler için mesafe hesaplanamadı.",
      };
    }

    distanceKm = Math.round(distanceKm * 10) / 10;

    return {
      success: true,
      isAutoCalculated: true,
      distanceKm,
      routePoints,
      pickupCoords,
      deliveryCoords,
      approximateDistanceText: "Yaklaşık mesafe: " + distanceKm + " km",
    };
  }

  async calculateDistance(
    pickupAddress: string,
    deliveryAddress: string
  ): Promise<{
    success: boolean;
    isAutoCalculated: boolean;
    distanceKm: number;
    routePoints: [number, number][];
    pickupCoords:
      | GeoCoordinate
      | null;
    deliveryCoords:
      | GeoCoordinate
      | null;
    approximateDistanceText: string;
    error?: string;
  }> {
    const emptyResult = {
      success: false,
      isAutoCalculated: false,
      distanceKm: 0,
      routePoints:
        [] as [number, number][],
      pickupCoords:
        null as GeoCoordinate | null,
      deliveryCoords:
        null as GeoCoordinate | null,
      approximateDistanceText: "",
      error:
        "Adresler haritada bulunamadı.",
    };

    const pickup =
      pickupAddress.trim();

    const delivery =
      deliveryAddress.trim();

    if (!pickup || !delivery) {
      return {
        ...emptyResult,
        error:
          "Alış ve teslimat adreslerini girin.",
      };
    }

    console.log(
      "🗺️ Otomatik mesafe hesaplanıyor:",
      {
        pickup,
        delivery,
      }
    );

    const [
      pickupCoords,
      deliveryCoords,
    ] = await Promise.all([
      this.geocodeAddress(pickup),
      this.geocodeAddress(delivery),
    ]);

    /*
     * Alış adresi bulunamadı.
     */
    if (!pickupCoords) {
      console.warn(
        "❌ Alış adresi bulunamadı:",
        pickup
      );

      return {
        ...emptyResult,
        error:
          "Alış adresi haritada bulunamadı. Lütfen il, ilçe ve mahalle bilgilerini daha ayrıntılı yazın.",
      };
    }

    /*
     * Teslimat adresi bulunamadı.
     */
    if (!deliveryCoords) {
      console.warn(
        "❌ Teslimat adresi bulunamadı:",
        delivery
      );

      return {
        ...emptyResult,
        pickupCoords,
        error:
          "Teslimat adresi haritada bulunamadı. Lütfen il, ilçe ve mahalle bilgilerini daha ayrıntılı yazın.",
      };
    }

    /*
     * Önce gerçek yol mesafesini OSRM ile hesaplıyoruz.
     */
    const route =
      await this.calculateRoadRoute(
        pickupCoords,
        deliveryCoords
      );

    /*
     * OSRM çalışmazsa kuş uçuşu mesafeyi
     * yedek olarak kullanıyoruz.
     */
    const fallbackDistance =
      haversineDistance(
        pickupCoords,
        deliveryCoords
      );

    let distanceKm = 0;

    let routePoints:
      [number, number][] = [];

    if (
      route &&
      Number.isFinite(
        route.distanceKm
      ) &&
      route.distanceKm > 0
    ) {
      distanceKm =
        route.distanceKm;

      routePoints =
        route.routePoints || [];

      console.log(
        "🟢 OSRM yol mesafesi:",
        distanceKm,
        "km"
      );
    } else {
      distanceKm =
        fallbackDistance;

      routePoints = [
        [
          pickupCoords.lat,
          pickupCoords.lng,
        ],
        [
          deliveryCoords.lat,
          deliveryCoords.lng,
        ],
      ];

      console.warn(
        "⚠️ OSRM kullanılamadı. Kuş uçuşu mesafe kullanılıyor:",
        distanceKm
      );
    }

    if (
      !Number.isFinite(distanceKm) ||
      distanceKm <= 0
    ) {
      return {
        ...emptyResult,
        pickupCoords,
        deliveryCoords,
        error:
          "Mesafe hesaplanamadı. Lütfen adresleri kontrol edin.",
      };
    }

    const roundedKm =
      Math.round(distanceKm * 10) /
      10;

    return {
      success: true,
      isAutoCalculated: true,
      distanceKm: roundedKm,
      routePoints,
      pickupCoords,
      deliveryCoords,
      approximateDistanceText:
        "Yaklaşık mesafe: " +
        roundedKm +
        " km",
    };
  }
}

export const mapService =
  new MapService();

export default mapService;
