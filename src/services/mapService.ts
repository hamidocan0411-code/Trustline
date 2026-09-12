import type { GeoCoordinate } from "../types";

export type { GeoCoordinate } from "../types";

export interface AddressSuggestion {
  displayName: string;
  lat?: number;
  lng?: number;
  name?: string;
  source?: string;
}

export interface MapServiceConfig {
  defaultCenter: [number, number];
  defaultZoom: number;
  tileUrl: string;
  searchUrl: string;
  routeUrl: string;
}

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

  async searchAddressSuggestions(
    query: string
  ): Promise<AddressSuggestion[]> {
    const cleanQuery = query.trim();

    const localResults =
      this.getAddressSuggestions(cleanQuery);

    if (cleanQuery.length < 3) {
      return localResults;
    }

    try {
      const params = new URLSearchParams();

      params.set("q", cleanQuery);
      params.set("format", "json");
      params.set("addressdetails", "1");
      params.set("limit", "5");
      params.set("countrycodes", "tr");

      const response = await fetch(
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
        return localResults;
      }

      const data =
        (await response.json()) as Array<{
          display_name?: string;
          lat?: string;
          lon?: string;
        }>;

      const remoteResults =
        data
          .map((item) => ({
            displayName:
              item.display_name ||
              cleanQuery,
            lat: Number(item.lat),
            lng: Number(item.lon),
            source: "nominatim",
          }))
          .filter(
            (item) =>
              Number.isFinite(item.lat) &&
              Number.isFinite(item.lng)
          );

      return [
        ...remoteResults,
        ...localResults.filter(
          (local) =>
            !remoteResults.some(
              (remote) =>
                remote.displayName
                  .toLocaleLowerCase(
                    "tr-TR"
                  )
                  .includes(
                    local.displayName
                      .toLocaleLowerCase(
                        "tr-TR"
                      )
                  )
            )
        ),
      ].slice(0, 8);
    } catch (error) {
      console.warn(
        "Adres önerileri alınamadı:",
        error
      );

      return localResults;
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
