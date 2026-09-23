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
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
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
  private readonly districtRelationCache =
    new Map<
      string,
      {
        osmId: number;
        areaId: number;
        lat?: number;
        lng?: number;
      } | null
    >();
  private overpassQueue: Promise<void> = Promise.resolve();

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
    /*
     * Public Overpass sunucularının istemci başına eşzamanlı
     * istek slotları sınırlıdır. Aynı sayfada pickup/delivery
     * autocomplete isteklerinin üst üste binmesini engelliyoruz.
     */
    let releaseQueue!: () => void;
    const previous =
      this.overpassQueue;

    this.overpassQueue =
      new Promise<void>((resolve) => {
        releaseQueue = resolve;
      });

    await previous;

    let lastError: unknown = null;

    try {
      for (
        let endpointIndex = 0;
        endpointIndex < OVERPASS_URLS.length;
        endpointIndex += 1
      ) {
        const endpoint =
          OVERPASS_URLS[endpointIndex];

        const controller =
          new AbortController();

        const timeoutId =
          window.setTimeout(
            () => controller.abort(),
            timeoutMs
          );

        try {
          const response =
            await fetch(
              endpoint,
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/x-www-form-urlencoded;charset=UTF-8",
                  Accept:
                    "application/json",
                },
                body:
                  "data=" +
                  encodeURIComponent(
                    query
                  ),
                signal:
                  controller.signal,
              }
            );

          if (response.ok) {
            return await response.json();
          }

          lastError =
            new Error(
              "Overpass HTTP " +
                response.status
            );

          /*
           * 429/5xx geçici olabilir. Aynı anda başka
           * endpoint'e yük bindirmemek için kısa bekle.
           */
          if (
            response.status === 429 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504
          ) {
            const delayMs =
              response.status === 429
                ? 1200
                : 500 +
                  endpointIndex * 400;

            await new Promise<void>(
              (resolve) =>
                window.setTimeout(
                  resolve,
                  delayMs
                )
            );
          }
        } catch (error) {
          lastError = error;

          /*
           * Abort/network hatasında sıradaki global
           * endpoint'i dene; son endpoint de başarısızsa
           * aşağıdaki hata döndürülür.
           */
        } finally {
          window.clearTimeout(
            timeoutId
          );
        }
      }
    } finally {
      releaseQueue();
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

  private async findTurkeyAreaId(): Promise<number | null> {
    const cached =
      this.readPersistentAddressCache(
        "turkey:area"
      );

    const cachedId =
      Number(
        cached?.[0]?.areaId
      );

    if (
      Number.isFinite(cachedId) &&
      cachedId > 3600000000
    ) {
      return cachedId;
    }

    try {
      const params =
        new URLSearchParams();

      params.set(
        "q",
        "Türkiye"
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

      if (response.ok) {
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
                  ) === "turkiye" &&
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

        if (
          Number.isFinite(
            osmId
          )
        ) {
          const areaId =
            3600000000 +
            osmId;

          this.writePersistentAddressCache(
            "turkey:area",
            [
              {
                displayName:
                  "Türkiye",
                name:
                  "Türkiye",
                osmType:
                  "relation",
                osmId,
                areaId,
                kind:
                  "city",
              },
            ]
          );

          return areaId;
        }
      }
    } catch (error) {
      console.warn(
        "Türkiye OSM alanı alınamadı:",
        error
      );
    }

    return null;
  }

  private async getTurkeyProvinceSuggestions(
    queryText?: string
  ): Promise<AddressSuggestion[]> {
    const cacheKey =
      "turkey:provinces";

    const cached =
      this.districtNeighborhoodCache.get(
        cacheKey
      ) ||
      this.readPersistentAddressCache(
        cacheKey
      );

    let provinces =
      cached || [];

    if (
      provinces.length ===
      0
    ) {
      const turkeyAreaId =
        await this.findTurkeyAreaId();

      if (!turkeyAreaId) {
        return [];
      }

      const query =
        "[out:json][timeout:20];" +
        "area(" +
        turkeyAreaId +
        ")->.turkeyArea;" +
        'rel["boundary"="administrative"]["admin_level"="4"]["name"](area.turkeyArea);' +
        "out tags center;";

      try {
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

        for (
          const item of
            elements
        ) {
          const name =
            String(
              item?.tags?.name ||
                ""
            ).trim();

          const osmId =
            Number(
              item?.id
            );

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

          unique.set(
            normalizeTurkish(
              name
            ),
            {
              displayName:
                name +
                ", Türkiye",
              formattedAddress:
                name +
                ", Türkiye",
              lat,
              lng,
              name,
              source:
                "openstreetmap-overpass",
              placeId:
                "R" + osmId,
              osmType:
                "relation",
              osmId,
              areaId:
                3600000000 +
                osmId,
              kind:
                "city",
              parentCity:
                name,
              types: [
                "administrative",
                "province",
              ],
            }
          );
        }

        provinces =
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
          provinces.length >
          0
        ) {
          this.districtNeighborhoodCache.set(
            cacheKey,
            provinces
          );
          this.writePersistentAddressCache(
            cacheKey,
            provinces
          );
        }
      } catch (error) {
        console.warn(
          "Türkiye il havuzu alınamadı:",
          error
        );
        return [];
      }
    } else {
      this.districtNeighborhoodCache.set(
        cacheKey,
        provinces
      );
    }

    const cleanQuery =
      String(
        queryText || ""
      ).trim();

    return cleanQuery
      ? this.filterSuggestions(
          provinces,
          cleanQuery
        )
      : provinces;
  }

  private async findDistrictRelation(
    district: string,
    province: string
  ): Promise<{
    osmId: number;
    areaId: number;
    lat?: number;
    lng?: number;
  } | null> {
    const districtName =
      String(
        district || ""
      ).trim();

    const provinceName =
      String(
        province || ""
      ).trim();

    if (
      !districtName ||
      !provinceName
    ) {
      return null;
    }

    const query =
      districtName +
      ", " +
      provinceName +
      ", Türkiye";

    try {
      const params =
        new URLSearchParams();

      params.set(
        "q",
        query
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
        "addressdetails",
        "1"
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
        return null;
      }

      const data =
        await response.json();

      const results =
        Array.isArray(data)
          ? data
          : [];

      const normalizedDistrict =
        normalizeTurkish(
          districtName
        );

      const relation =
        results.find(
          (item: any) => {
            const itemName =
              normalizeTurkish(
                String(
                  item?.name ||
                    ""
                )
              );

            const osmType =
              String(
                item?.osm_type ||
                  ""
              ).toLowerCase();

            const type =
              normalizeTurkish(
                String(
                  item?.type ||
                    ""
                )
              );

            const addresstype =
              normalizeTurkish(
                String(
                  item?.addresstype ||
                    ""
                )
              );

            return (
              itemName ===
                normalizedDistrict &&
              osmType ===
                "relation" &&
              (
                type ===
                  "administrative" ||
                type ===
                  "district" ||
                type ===
                  "county" ||
                addresstype ===
                  "administrative" ||
                addresstype ===
                  "district" ||
                addresstype ===
                  "county"
              )
            );
          }
        );

      const osmId =
        Number(
          relation?.osm_id
        );

      if (
        !Number.isFinite(
          osmId
        )
      ) {
        return null;
      }

      return {
        osmId,
        areaId:
          3600000000 +
          osmId,
        lat:
          Number(
            relation?.lat
          ) || undefined,
        lng:
          Number(
            relation?.lon
          ) || undefined,
      };
    } catch {
      return null;
    }
  }

  private async findIstanbulDistrictRelation(
    district: string
  ): Promise<{
    osmId: number;
    areaId: number;
    lat?: number;
    lng?: number;
  } | null> {
    const name =
      String(district || "").trim();

    if (!name) {
      return null;
    }

    const cacheKey =
      normalizeTurkish(name);

    if (
      this.districtRelationCache.has(
        cacheKey
      )
    ) {
      return (
        this.districtRelationCache.get(
          cacheKey
        ) || null
      );
    }

    /*
     * İlçe relation'ını önce Nominatim'den çözüyoruz.
     * Bu normal akışta Overpass'a gitmemelidir.
     *
     * İstanbul viewbox + bounded=1 kullanıldığı için aynı
     * isimli başka şehir/ilçe sonuçlarının karışması engellenir.
     */
    try {
      const params =
        new URLSearchParams();

      params.set(
        "q",
        name
      );
      params.set(
        "format",
        "jsonv2"
      );
      params.set(
        "limit",
        "20"
      );
      params.set(
        "addressdetails",
        "1"
      );
      params.set(
        "countrycodes",
        "tr"
      );
      params.set(
        "viewbox",
        "28.40,41.35,29.55,40.80"
      );
      params.set(
        "bounded",
        "1"
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

      if (response.ok) {
        const data =
          await response.json();

        const results =
          Array.isArray(data)
            ? data
            : [];

        const normalizedName =
          normalizeTurkish(name);

        const relation =
          results.find(
            (item: any) => {
              const itemName =
                normalizeTurkish(
                  String(
                    item?.name ||
                      ""
                  )
                );

              const osmType =
                String(
                  item?.osm_type ||
                    ""
                ).toLowerCase();

              const type =
                normalizeTurkish(
                  String(
                    item?.type ||
                      ""
                  )
                );

              const addresstype =
                normalizeTurkish(
                  String(
                    item?.addresstype ||
                      ""
                  )
                );

              const lat =
                Number(
                  item?.lat
                );

              const lon =
                Number(
                  item?.lon
                );

              /*
               * Nominatim sürümleri "administrative",
               * "district" veya "county" döndürebilir.
               * İlçe relation'ını anlamak için addresstype'i
               * de kabul ediyoruz.
               */
              const administrative =
                type ===
                  "administrative" ||
                type ===
                  "district" ||
                type ===
                  "county" ||
                addresstype ===
                  "administrative" ||
                addresstype ===
                  "district" ||
                addresstype ===
                  "county";

              const insideIstanbul =
                Number.isFinite(
                  lat
                ) &&
                Number.isFinite(
                  lon
                ) &&
                lat >= 40.80 &&
                lat <= 41.35 &&
                lon >= 28.40 &&
                lon <= 29.55;

              return (
                itemName ===
                  normalizedName &&
                osmType ===
                  "relation" &&
                administrative &&
                insideIstanbul
              );
            }
          );

        const osmId =
          Number(
            relation?.osm_id
          );

        if (
          Number.isFinite(
            osmId
          )
        ) {
          const resolved = {
            osmId,
            areaId:
              3600000000 +
              osmId,
            lat:
              Number(
                relation?.lat
              ) || undefined,
            lng:
              Number(
                relation?.lon
              ) || undefined,
          };

          this.districtRelationCache.set(
            cacheKey,
            resolved
          );

          return resolved;
        }
      }
    } catch (error) {
      console.warn(
        "Nominatim ilçe relation çözümü başarısız:",
        error
      );
    }

    /*
     * Nominatim'de bulunamayan ilçe relation'ı için burada
     * Overpass fallback'i çalıştırmıyoruz. Çünkü bu method,
     * autocomplete sırasında kullanıcı yazarken çağrılıyor
     * ve public Overpass 504/429 olduğunda tüm UX'i kilitleyebilir.
     *
     * Seçili bir ilçe AddressSuggestion olarak geliyorsa
     * areaId zaten doğrudan suggestion üzerinden kullanılır.
     */
    this.districtRelationCache.set(
      cacheKey,
      null
    );

    return null;
  }

  private async findIstanbulAreaId(): Promise<number | null> {
    if (
      this.istanbulAreaIdPromise
    ) {
      return this.istanbulAreaIdPromise;
    }

    this.istanbulAreaIdPromise =
      (async () => {
        /*
         * 1) Nominatim GeocodeJSON: gerçek İstanbul relation.
         */
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
            throw new Error(
              "Nominatim GeocodeJSON HTTP " +
                response.status
            );
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

          if (
            Number.isFinite(
              osmId
            )
          ) {
            return (
              3600000000 +
              osmId
            );
          }
        } catch {
          // Continue with jsonv2 and Overpass fallbacks.
        }

        /*
         * 2) Nominatim jsonv2 fallback.
         */
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

          if (
            response.ok
          ) {
            const data =
              await response.json();

            const result =
              Array.isArray(data)
                ? data.find(
                    (item: any) => {
                      const name =
                        normalizeTurkish(
                          String(
                            item?.name ||
                              ""
                          )
                        );
                      const type =
                        normalizeTurkish(
                          String(
                            item?.type ||
                              ""
                          )
                        );
                      const osmType =
                        String(
                          item?.osm_type ||
                            ""
                        ).toLowerCase();

                      return (
                        name ===
                          "istanbul" &&
                        (
                          type ===
                            "administrative" ||
                          type ===
                            "city"
                        ) &&
                        osmType ===
                          "relation"
                      );
                    }
                  )
                : null;

            const osmId =
              Number(
                result?.osm_id
              );

            if (
              Number.isFinite(
                osmId
              )
            ) {
              return (
                3600000000 +
                osmId
              );
            }
          }
        } catch {
          // Continue with Overpass fallback.
        }

        /*
         * 3) Small Overpass relation lookup as final resolver.
         * This query resolves one city relation; it does not enumerate addresses.
         */
        try {
          const query =
            "[out:json][timeout:15];" +
            'rel["boundary"="administrative"]["admin_level"="4"]["name"="İstanbul"]' +
            "(" +
            ISTANBUL_BBOX +
            ");" +
            "out ids;";

          const data =
            await this.fetchOverpass(
              query,
              8000
            );

          const relation =
            (
              Array.isArray(
                data?.elements
              )
                ? data.elements
                : []
            ).find(
              (item: any) =>
                item?.type ===
                  "relation" &&
                Number.isFinite(
                  Number(
                    item?.id
                  )
                )
            );

          const osmId =
            Number(
              relation?.id
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
      ) ||
      this.readPersistentAddressCache(
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
            this.writePersistentAddressCache(
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

  private async queryIstanbulDistrictSuggestions(
    queryText: string
  ): Promise<AddressSuggestion[]> {
    const cleanQuery =
      this.normalizeQueryForHierarchy(
        queryText
      );

    if (!cleanQuery) {
      return this.getIstanbulDistrictSuggestions();
    }

    const cachedAll =
      this.districtNeighborhoodCache.get(
        "istanbul:districts"
      ) ||
      this.readPersistentAddressCache(
        "istanbul:districts"
      );

    if (cachedAll) {
      return this.filterSuggestions(
        cachedAll,
        cleanQuery
      );
    }

    const istanbulAreaId =
      await this.findIstanbulAreaId();

    if (!istanbulAreaId) {
      return [];
    }

    const fragment =
      cleanQuery
        .split(" ")
        .filter(Boolean)
        .join("\\s+");

    const query =
      "[out:json][timeout:15];" +
      "area(" +
      istanbulAreaId +
      ")->.istanbulArea;" +
      "rel[\"boundary\"=\"administrative\"][\"admin_level\"=\"6\"][\"name\"~\"^" +
      fragment +
      ",i](area.istanbulArea);" +
      "out tags center;";

    try {
      const data =
        await this.fetchOverpass(
          query,
          9000
        );

      const unique =
        new Map<string, AddressSuggestion>();

      const elements =
        Array.isArray(data?.elements)
          ? data.elements
          : [];

      for (const item of elements) {
        const name =
          String(
            item?.tags?.name ||
              ""
          ).trim();
        const osmId = Number(item?.id);
        const lat = Number(item?.center?.lat);
        const lng = Number(item?.center?.lon);

        if (
          !name ||
          !Number.isFinite(osmId) ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          continue;
        }

        unique.set(
          normalizeTurkish(name),
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
              "R" + osmId,
            osmType:
              "relation",
            osmId,
            areaId:
              3600000000 + osmId,
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

      return this.filterSuggestions(
        Array.from(unique.values()),
        cleanQuery
      );
    } catch (error) {
      console.warn(
        "Kısmi İstanbul ilçe sorgusu başarısız:",
        error
      );
      return [];
    }
  }

  async getDistrictSuggestions(
    province?:
      | AddressSuggestion
      | string,
    queryText?: string
  ): Promise<AddressSuggestion[]> {
    const provinceName =
      typeof province === "string"
        ? province.trim()
        : String(
            province?.name || ""
          ).trim();

    /*
     * Backward-compatible behavior:
     * no province means "show/search Turkish provinces" is
     * handled by the caller; a plain string is treated as a
     * province name, not an Istanbul-specific district query.
     */
    if (!provinceName) {
      return [];
    }

    try {
      const cacheKey =
        "districts:" +
        normalizeTurkish(
          provinceName
        );

      const cached =
        this.districtNeighborhoodCache.get(
          cacheKey
        ) ||
        this.readPersistentAddressCache(
          cacheKey
        );

      let districts =
        cached || [];

      if (
        districts.length ===
        0
      ) {
        const relation =
          typeof province !==
              "string" &&
          province?.areaId &&
          province?.osmType ===
            "relation"
            ? {
                osmId:
                  province.osmId ||
                  0,
                areaId:
                  province.areaId,
              }
            : await this.resolveProvinceRelation(
                provinceName
              );

        if (!relation) {
          return [];
        }

        const query =
          "[out:json][timeout:20];" +
          "area(" +
          relation.areaId +
          ")->.provinceArea;" +
          'rel["boundary"="administrative"]["admin_level"="6"]["name"](area.provinceArea);' +
          "out tags center;";

        const data =
          await this.fetchOverpass(
            query,
            9000
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

        for (
          const item of
            elements
        ) {
          const name =
            String(
              item?.tags?.name ||
                ""
            ).trim();

          const osmId =
            Number(
              item?.id
            );

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

          unique.set(
            normalizeTurkish(
              name
            ),
            {
              displayName:
                name +
                ", " +
                provinceName +
                ", Türkiye",
              formattedAddress:
                name +
                ", " +
                provinceName +
                ", Türkiye",
              lat,
              lng,
              name,
              source:
                "openstreetmap-overpass",
              placeId:
                "R" + osmId,
              osmType:
                "relation",
              osmId,
              areaId:
                3600000000 +
                osmId,
              kind:
                "district",
              parentCity:
                provinceName,
              types: [
                "administrative",
                "district",
              ],
            }
          );
        }

        districts =
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
          districts.length >
          0
        ) {
          this.districtNeighborhoodCache.set(
            cacheKey,
            districts
          );
          this.writePersistentAddressCache(
            cacheKey,
            districts
          );
        }
      } else {
        this.districtNeighborhoodCache.set(
          cacheKey,
          districts
        );
      }

      const cleanQuery =
        String(
          queryText || ""
        ).trim();

      return cleanQuery
        ? this.filterSuggestions(
            districts,
            cleanQuery
          )
        : districts;
    } catch (error) {
      console.warn(
        "İlçe listesi alınamadı:",
        provinceName,
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
    district:
      | string
      | AddressSuggestion
  ): Promise<AddressSuggestion[]> {
    const districtName =
      typeof district ===
        "string"
        ? district.trim()
        : String(
            district.name || ""
          ).trim();

    if (!districtName) {
      return [];
    }

    const cacheKey =
      "neighborhoods:" +
      normalizeTurkish(
        districtName
      );

    const cached =
      this.districtNeighborhoodCache.get(
        cacheKey
      ) ||
      this.readPersistentAddressCache(
        cacheKey
      );

    if (
      cached
    ) {
      this.districtNeighborhoodCache.set(
        cacheKey,
        cached
      );
      return cached;
    }

    const districtSuggestion =
      typeof district ===
        "string"
        ? null
        : district;

    const provinceName =
      String(
        districtSuggestion?.parentCity ||
          ""
      ).trim();

    const districtRelation =
      districtSuggestion?.areaId &&
      districtSuggestion.osmType ===
        "relation"
        ? {
            osmId:
              districtSuggestion.osmId ||
              0,
            areaId:
              districtSuggestion.areaId,
          }
        : provinceName
          ? await this.findDistrictRelation(
              districtName,
              provinceName
            )
          : null;

    if (
      !districtRelation
    ) {
      return [];
    }

    const query =
      "[out:json][timeout:25];" +
      "area(" +
      districtRelation.areaId +
      ")->.districtArea;" +
      "(" +
      'rel["boundary"="administrative"]["admin_level"="8"]["name"](area.districtArea);' +
      'nwr["place"~"^(neighbourhood|quarter|suburb)$"]["name"](area.districtArea);' +
      ");" +
      "out tags center;";

    let data: any;

    try {
      data =
        await this.fetchOverpass(
          query,
          12000
        );
    } catch (error) {
      console.warn(
        "Mahalle Overpass sorgusu başarısız:",
        error
      );

      return [];
    }

    const elements =
      Array.isArray(
        data?.elements
      )
        ? data.elements
        : [];

    const priority = {
      relation: 3,
      way: 2,
      node: 1,
    } as const;

    const unique =
      new Map<
        string,
        {
          suggestion: AddressSuggestion;
          priority: number;
        }
      >();

    for (
      const item of
        elements
    ) {
      const name =
        String(
          item?.tags?.name ||
            ""
        ).trim();

      const osmType =
        String(
          item?.type ||
            ""
        ) as
          | "node"
          | "way"
          | "relation";

      const osmId =
        Number(
          item?.id
        );

      const lat =
        Number(
          item?.center?.lat ??
            item?.lat
        );

      const lng =
        Number(
          item?.center?.lon ??
            item?.lon
        );

      if (
        !name ||
        !(
          osmType ===
            "node" ||
          osmType ===
            "way" ||
          osmType ===
            "relation"
        ) ||
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

      const suggestion:
        AddressSuggestion = {
        displayName:
          name +
          " Mahallesi, " +
          districtName +
          ", İstanbul",
        formattedAddress:
          name +
          " Mahallesi, " +
          districtName +
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
          osmType ===
          "relation"
            ? 3600000000 +
              osmId
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
            item?.tags
              ?.place ||
              "administrative"
          ),
        ],
      };

      const old =
        unique.get(
          key
        );

      const itemPriority =
        priority[
          osmType
        ];

      if (
        !old ||
        itemPriority >
          old.priority
      ) {
        unique.set(
          key,
          {
            suggestion,
            priority:
              itemPriority,
          }
        );
      }
    }

    const results =
      Array.from(
        unique.values()
      )
        .map(
          (entry) =>
            entry.suggestion
        )
        .sort(
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
      ) ||
      this.readPersistentAddressCache(
        cacheKey
      );

    if (cached) {
      this.neighborhoodStreetCache.set(
        cacheKey,
        cached
      );
    }

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
            districtName,
            neighborhood.parentCity ||
              ""
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
        "[out:json][timeout:12];" +
        "area(" +
        areaId +
        ")->.searchArea;" +
        'way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road)$"]["name"](area.searchArea);' +
        "out tags center;";

      let data: any;

      try {
        data =
          await this.fetchOverpass(
            query,
            7000
          );
      } catch (error) {
        console.warn(
          "Mahalle sokakları şu anda alınamadı:",
          error
        );
        return [];
      }

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
              ", " +
              (neighborhood.parentCity ||
                "") ,
            formattedAddress:
              name +
              ", " +
              neighborhoodName +
              " Mahallesi, " +
              districtName +
              ", " +
              (neighborhood.parentCity ||
                ""),
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
              neighborhood.parentCity ||
              "",
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
        areaId:
          osmType === "relation" &&
          Number.isFinite(osmId)
            ? 3600000000 + osmId
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
    const normalizedQuery =
      cleanQuery.trim();

    if (
      normalizedQuery.length < 3
    ) {
      return [];
    }

    const params =
      new URLSearchParams();

    /*
     * Photon /api q parametresi doğrudan arama terimini
     * alır. Türkiye filtresi için q'ya ", Türkiye"
     * eklemek yerine resmi countrycode filtresini kullan.
     */
    params.set(
      "q",
      normalizedQuery
    );
    params.set(
      "limit",
      "12"
    );
    params.set(
      "countrycode",
      "TR"
    );

    const normalized =
      normalizeTurkish(
        normalizedQuery
      );

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
            "Accept-Language":
              "tr-TR,tr;q=0.9",
          },
        }
      );

    if (!response.ok) {
      /*
       * Photon yalnızca son fallback'tir. 4xx/5xx
       * durumda autocomplete akışını kırma.
       */
      console.warn(
        "Photon fallback HTTP " +
          response.status
      );
      return [];
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

    const hierarchyTokens =
      this.normalizeQueryForHierarchy(
        cleanQuery
      )
        .split(" ")
        .filter(Boolean);

    const oneWordQuery =
      hierarchyTokens.length === 1;

    /*
     * 1. Seçili mahalle: yalnız bu mahallenin gerçek sokakları.
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
            context.district ||
              context.neighborhood
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
     * 2. Seçili ilçe: yalnız o ilçenin gerçek mahalleleri.
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
          context.district
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
              districtName,
              ""
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
     * 3. Seçili il/province: yalnız o ilin gerçek ilçeleri.
     */
    if (
      context?.city &&
      !context?.district?.name
    ) {
      const districts =
        await this.getDistrictSuggestions(
          context.city,
          cleanQuery
        );

      if (
        districts.length > 0
      ) {
        return districts.slice(
          0,
          50
        );
      }
    }

    /*
     * 4. Genel sorguda Nominatim yardımcı kaynaktır.
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
     * 5. Türkiye'nin gerçek il havuzu.
     * İlk yüklemede 81 il cache'lenir; sonrasında local cache kullanılır.
     */
    const provinces =
      await this.getTurkeyProvinceSuggestions();

    const exactProvince =
      provinces.find(
        (province) =>
          normalizeTurkish(
            String(
              province.name || ""
            )
          ) ===
          normalized
      );

    if (
      exactProvince
    ) {
      const districts =
        await this.getDistrictSuggestions(
          exactProvince
        );

      if (
        districts.length > 0
      ) {
        return districts;
      }
    }

    /*
     * 6. Tek kelimelik il sorgusunda gerçek il eşleşmelerini göster.
     */
    if (
      oneWordQuery
    ) {
      const provinceMatches =
        this.filterSuggestions(
          provinces,
          cleanQuery
        );

      if (
        provinceMatches.length > 0
      ) {
        return provinceMatches.slice(
          0,
          20
        );
      }
    }

    /*
     * 7. Nominatim'in gerçek ilçe sonucunu canonical OSM
     * district relation'ına bağla ve mahalleleri getir.
     */
    const nominatimDistricts =
      nominatimResults.filter(
        (result) =>
          result.kind ===
          "district"
      );

    const exactNominatimDistrict =
      nominatimDistricts.find(
        (item) =>
          normalizeTurkish(
            String(
              item.name || ""
            )
          ) ===
          normalized
      );

    if (
      exactNominatimDistrict?.parentCity
    ) {
      const districts =
        await this.getDistrictSuggestions(
          exactNominatimDistrict.parentCity,
          exactNominatimDistrict.name
        );

      const exact =
        districts.find(
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
            exact
          );

        if (
          neighborhoods.length > 0
        ) {
          return neighborhoods;
        }
      }

      if (
        districts.length > 0
      ) {
        return districts.slice(
          0,
          20
        );
      }
    }

    /*
     * 8. "İstanbul Avcılar Cihangir" gibi birleşik sorgularda
     * Nominatim'in parent hiyerarşisini kullan.
     */
    const parentDistrictName =
      nominatimResults.find(
        (item) =>
          item.parentDistrict
      )?.parentDistrict;

    const parentProvinceName =
      nominatimResults.find(
        (item) =>
          item.parentCity
      )?.parentCity;

    if (
      parentDistrictName &&
      parentProvinceName
    ) {
      const districtCandidates =
        await this.getDistrictSuggestions(
          parentProvinceName,
          parentDistrictName
        );

      const districtMatch =
        districtCandidates.find(
          (item) =>
            normalizeTurkish(
              String(
                item.name || ""
              )
            ) ===
            normalizeTurkish(
              parentDistrictName
            )
        );

      if (
        districtMatch
      ) {
        const hierarchyResults =
          await this.searchGenericAddressHierarchy(
            cleanQuery,
            districtMatch
          );

        if (
          hierarchyResults
        ) {
          return hierarchyResults;
        }
      }
    }

    /*
     * 9. Tek başına gerçek mahalle sonucu.
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
        neighborhoodResults.find(
          (item) =>
            normalizeTurkish(
              String(
                item.name || ""
              )
            ) ===
            normalized
        );

      if (
        exact?.parentDistrict &&
        exact?.parentCity
      ) {
        const districts =
          await this.getDistrictSuggestions(
            exact.parentCity,
            exact.parentDistrict
          );

        const district =
          districts.find(
            (item) =>
              normalizeTurkish(
                String(
                  item.name || ""
                )
              ) ===
              normalizeTurkish(
                exact.parentDistrict ||
                  ""
              )
          );

        if (
          district
        ) {
          const neighborhoods =
            await this.getDistrictNeighborhoods(
              district
            );

          const canonical =
            neighborhoods.find(
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
                district.name || "",
                ""
              );

            if (
              streets.length > 0
            ) {
              return streets;
            }
          }

          return [canonical || exact];
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

  private async searchGenericAddressHierarchy(
    cleanQuery: string,
    districtHint: AddressSuggestion
  ): Promise<AddressSuggestion[] | null> {
    const districtName =
      String(
        districtHint.name || ""
      ).trim();

    if (!districtName) {
      return null;
    }

    const provinceName =
      String(
        districtHint.parentCity || ""
      ).trim();

    if (!provinceName) {
      return null;
    }

    const remainder =
      this.removeHierarchyLabels(
        cleanQuery,
        districtName
      );

    const neighborhoods =
      await this.getDistrictNeighborhoods(
        districtHint
      );

    if (!remainder) {
      return neighborhoods;
    }

    const ranked =
      this.filterSuggestions(
        neighborhoods,
        remainder
      );

    if (
      !ranked.length
    ) {
      return neighborhoods;
    }

    const best =
      ranked[0];

    if (
      normalizeTurkish(
        String(
          best.name || ""
        )
      ) ===
      normalizeTurkish(
        remainder
      )
    ) {
      const streets =
        await this.getNeighborhoodStreets(
          best,
          districtName,
          ""
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
    /*
     * Dropdown'dan gerçek bir OSM relation seçildiğinde
     * ikinci kez ağ çağrısı yapma. Seçim doğrudan devam eder.
     */
    if (
      suggestion.kind === "neighborhood" &&
      suggestion.osmType === "relation" &&
      Number.isFinite(
        Number(suggestion.osmId)
      )
    ) {
      return {
        ...suggestion,
        areaId:
          suggestion.areaId ||
          3600000000 +
            Number(suggestion.osmId),
      };
    }

    return suggestion;
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
