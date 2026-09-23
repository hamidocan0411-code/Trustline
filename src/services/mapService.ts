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
  kind?: "district" | "neighborhood" | "street" | "address";
  street?: string;
  streetNumber?: string;
  types?: string[];
}

export interface MapServiceConfig {
  defaultCenter: [number, number];
  defaultZoom: number;
  tileUrl: string;
  searchUrl: string;
  routeUrl: string;
}

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const ISTANBUL_BBOX = "40.80,28.40,41.35,29.55";

const ISTANBUL_DISTRICTS = [
  "Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler",
  "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü",
  "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy", "Esenler", "Esenyurt",
  "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane",
  "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer",
  "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla", "Ümraniye",
  "Üsküdar", "Zeytinburnu",
];

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

const TURKEY_PROVINCES = [
  "Adana",
  "Adıyaman",
  "Afyonkarahisar",
  "Ağrı",
  "Aksaray",
  "Amasya",
  "Ankara",
  "Antalya",
  "Ardahan",
  "Artvin",
  "Aydın",
  "Balıkesir",
  "Bartın",
  "Batman",
  "Bayburt",
  "Bilecik",
  "Bingöl",
  "Bitlis",
  "Bolu",
  "Burdur",
  "Bursa",
  "Çanakkale",
  "Çankırı",
  "Çorum",
  "Denizli",
  "Diyarbakır",
  "Düzce",
  "Edirne",
  "Elazığ",
  "Erzincan",
  "Erzurum",
  "Eskişehir",
  "Gaziantep",
  "Giresun",
  "Gümüşhane",
  "Hakkari",
  "Hatay",
  "Iğdır",
  "Isparta",
  "İstanbul",
  "İzmir",
  "Kahramanmaraş",
  "Karabük",
  "Karaman",
  "Kars",
  "Kastamonu",
  "Kayseri",
  "Kilis",
  "Kırıkkale",
  "Kırklareli",
  "Kırşehir",
  "Kocaeli",
  "Konya",
  "Kütahya",
  "Malatya",
  "Manisa",
  "Mardin",
  "Mersin",
  "Muğla",
  "Muş",
  "Nevşehir",
  "Niğde",
  "Ordu",
  "Osmaniye",
  "Rize",
  "Sakarya",
  "Samsun",
  "Siirt",
  "Sinop",
  "Sivas",
  "Şanlıurfa",
  "Şırnak",
  "Tekirdağ",
  "Tokat",
  "Trabzon",
  "Tunceli",
  "Uşak",
  "Van",
  "Yalova",
  "Yozgat",
  "Zonguldak",
];

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

  private async fetchOverpass(query: string): Promise<any> {
    let lastError: unknown = null;

    for (const endpoint of OVERPASS_URLS) {
      try {
        const response = await fetch(
          endpoint + "?data=" + encodeURIComponent(query),
          { headers: { Accept: "application/json" } }
        );

        if (!response.ok) {
          lastError = new Error("Overpass HTTP " + response.status);
          continue;
        }

        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Overpass servisine ulaşılamadı.");
  }

  private normalizeQueryForHierarchy(value: string): string {
    return normalizeTurkish(value)
      .replace(/[,./\\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private getIstanbulDistrictFromQuery(query: string): string | null {
    const normalized = this.normalizeQueryForHierarchy(query);

    const candidates = [...ISTANBUL_DISTRICTS].sort(
      (a, b) =>
        normalizeTurkish(b).length -
        normalizeTurkish(a).length
    );

    for (const district of candidates) {
      const districtNormalized = normalizeTurkish(district);
      const matcher = new RegExp(
        "(^|\\s)" +
          districtNormalized +
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
        /(^|\\s)(mahallesi|mahalle|mah)(?=$|\\s)/gi,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();

    return remaining;
  }

  private async findIstanbulDistrictRelation(
    district: string
  ): Promise<{ osmId: number; areaId: number } | null> {
    const query =
      "[out:json][timeout:20];" +
      'relation["boundary"="administrative"]' +
      '["admin_level"~"^(6|7)$"]' +
      '["name"~"^' +
      district +
      '$",i]' +
      "(" +
      ISTANBUL_BBOX +
      ");" +
      "out tags center;";

    const data =
      await this.fetchOverpass(query);

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
    };
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
      "[out:json][timeout:30];" +
      "area(" +
      districtRelation.areaId +
      ")->.districtArea;" +
      "(" +
      'relation["boundary"="administrative"]["admin_level"="10"]["name"](area.districtArea);' +
      'relation["place"~"^(neighbourhood|quarter|suburb)$"]["name"](area.districtArea);' +
      'node["place"~"^(neighbourhood|quarter|suburb)$"]["name"](area.districtArea);' +
      'way["place"~"^(neighbourhood|quarter|suburb)$"]["name"](area.districtArea);' +
      ");" +
      "out tags center;";

    const data =
      await this.fetchOverpass(query);

    const elements = Array.isArray(data?.elements)
      ? data.elements
      : [];

    const unique =
      new Map<string, AddressSuggestion>();

    for (const item of elements) {
      const name = String(
        item?.tags?.name || ""
      ).trim();

      if (!name) continue;

      const osmType = String(
        item?.type || ""
      ) as "node" | "way" | "relation";

      if (
        osmType !== "node" &&
        osmType !== "way" &&
        osmType !== "relation"
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

      const normalizedName =
        normalizeTurkish(name);

      if (unique.has(normalizedName)) {
        continue;
      }

      unique.set(
        normalizedName,
        {
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
          kind: "neighborhood",
          types: [
            "neighborhood",
            String(
              item?.tags?.place ||
                "administrative"
            ),
          ],
        }
      );
    }

    const results =
      Array.from(unique.values()).sort(
        (a, b) =>
          String(a.name || "").localeCompare(
            String(b.name || ""),
            "tr"
          )
      );

    this.districtNeighborhoodCache.set(
      cacheKey,
      results
    );

    return results;
  }

  private async getNeighborhoodStreets(
    neighborhood: AddressSuggestion,
    district: string
  ): Promise<AddressSuggestion[]> {
    const cacheKey =
      "streets:" +
      String(
        neighborhood.placeId || ""
      ) +
      ":" +
      normalizeTurkish(district);

    const cached =
      this.neighborhoodStreetCache.get(
        cacheKey
      );

    if (cached) return cached;

    let query = "";

    if (
      neighborhood.areaId &&
      (neighborhood.osmType === "relation" ||
        neighborhood.osmType === "way")
    ) {
      query =
        "[out:json][timeout:30];" +
        "area(" +
        neighborhood.areaId +
        ")->.searchArea;" +
        'way["highway"]["name"](area.searchArea);' +
        "out tags center;";
    } else if (
      Number.isFinite(neighborhood.lat) &&
      Number.isFinite(neighborhood.lng)
    ) {
      query =
        "[out:json][timeout:30];" +
        "way(around:1800," +
        neighborhood.lat +
        "," +
        neighborhood.lng +
        ')["highway"]["name"];' +
        "out tags center;";
    } else {
      return [];
    }

    const data =
      await this.fetchOverpass(query);

    const elements =
      Array.isArray(data?.elements)
        ? data.elements
        : [];

    const excludedHighwayTypes =
      new Set([
        "footway",
        "path",
        "cycleway",
        "steps",
        "track",
        "construction",
        "proposed",
        "raceway",
      ]);

    const unique =
      new Map<string, AddressSuggestion>();

    for (const item of elements) {
      const name = String(
        item?.tags?.name || ""
      ).trim();

      if (!name) continue;

      const highway = String(
        item?.tags?.highway || ""
      ).trim();

      if (
        excludedHighwayTypes.has(
          highway
        )
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

      const normalizedName =
        normalizeTurkish(name);

      if (unique.has(normalizedName)) {
        continue;
      }

      unique.set(
        normalizedName,
        {
          displayName:
            name +
            ", " +
            neighborhood.name +
            " Mahallesi, " +
            district +
            ", İstanbul",
          formattedAddress:
            name +
            ", " +
            neighborhood.name +
            " Mahallesi, " +
            district +
            ", İstanbul",
          lat,
          lng,
          name,
          source:
            "openstreetmap-overpass",
          placeId:
            "W" +
            String(item?.id || ""),
          osmType: "way",
          osmId: Number(item?.id),
          kind: "street",
          street: name,
          streetNumber: "",
          types: [
            "street",
            highway || "road",
          ],
        }
      );
    }

    const results =
      Array.from(unique.values()).sort(
        (a, b) =>
          String(a.name || "").localeCompare(
            String(b.name || ""),
            "tr"
          )
      );

    this.neighborhoodStreetCache.set(
      cacheKey,
      results
    );

    return results;
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

  private async searchIstanbulAddressHierarchy(
    cleanQuery: string
  ): Promise<AddressSuggestion[] | null> {
    const district =
      this.getIstanbulDistrictFromQuery(
        cleanQuery
      );

    if (!district) return null;

    const remainder =
      this.removeHierarchyLabels(
        cleanQuery,
        district
      );

    let neighborhoods: AddressSuggestion[];

    try {
      neighborhoods =
        await this.getDistrictNeighborhoods(
          district
        );
    } catch (error) {
      console.warn(
        "İstanbul mahalle/sokak verisi alınamadı:",
        error
      );
      return null;
    }

    if (!remainder) {
      return neighborhoods;
    }

    const normalizedRemainder =
      normalizeTurkish(remainder);

    const ranked =
      neighborhoods
        .map((neighborhood) => ({
          neighborhood,
          score:
            this.rankNeighborhood(
              neighborhood,
              normalizedRemainder
            ),
        }))
        .filter(
          (item) => item.score > 0
        )
        .sort(
          (a, b) => b.score - a.score
        );

    if (ranked.length === 0) {
      return neighborhoods;
    }

    const best =
      ranked[0].neighborhood;

    const bestName =
      normalizeTurkish(
        String(best.name || "")
      );

    if (
      normalizedRemainder === bestName ||
      (
        bestName.startsWith(
          normalizedRemainder
        ) &&
        normalizedRemainder.length >= 3
      ) ||
      (
        bestName.includes(
          normalizedRemainder
        ) &&
        normalizedRemainder.length >= 3
      )
    ) {
      const streets =
        await this.getNeighborhoodStreets(
          best,
          district
        );

      if (streets.length > 0) {
        return streets;
      }
    }

    return ranked
      .slice(0, 50)
      .map(
        ({ neighborhood }) =>
          neighborhood
      );
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
    cleanQuery: string
  ): Promise<AddressSuggestion[]> {
    const normalizedQuery =
      normalizeTurkish(
        this.normalizeQueryForHierarchy(
          cleanQuery
        )
      );

    if (normalizedQuery === "istanbul") {
      return ISTANBUL_DISTRICTS.map(
        (district) => ({
          displayName:
            district +
            ", İstanbul, Türkiye",
          formattedAddress:
            district +
            ", İstanbul, Türkiye",
          name: district,
          source:
            "openstreetmap-overpass",
          kind: "district",
          types: [
            "administrative",
            "district",
          ],
        })
      );
    }

    const hierarchyResults =
      await this.searchIstanbulAddressHierarchy(
        cleanQuery
      );

    if (hierarchyResults) {
      return hierarchyResults;
    }

    return this.searchPhotonSuggestions(
      cleanQuery
    );
  }

  private async searchAddressSuggestionsWithCache(
    cleanQuery: string
  ): Promise<AddressSuggestion[]> {
    const cacheKey =
      normalizeTurkish(
        cleanQuery
      );

    const cached =
      this.addressSuggestionCache.get(
        cacheKey
      );

    if (cached) {
      return cached;
    }

    const results =
      await this.searchAddressSuggestionsInternal(
        cleanQuery
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
    return suggestion;
  }

  getConfig(): MapServiceConfig {
    return {
      ...MAP_CONFIG,
    };
  }

  getAddressSuggestions(
    query: string
  ): AddressSuggestion[] {
    const cleanQuery = query.trim();

    if (cleanQuery.length < 2) {
      return [];
    }

    const normalizedQuery =
      normalizeTurkish(cleanQuery);

    return TURKEY_PROVINCES
      .filter((province) =>
        normalizeTurkish(province).includes(
          normalizedQuery
        )
      )
      .slice(0, 8)
      .map((province) => ({
        displayName:
          province + ", Türkiye",
        name: province,
        source: "local",
      }));
  }

  async searchAddressSuggestions(query: string): Promise<AddressSuggestion[]> {
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
        cleanQuery
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
