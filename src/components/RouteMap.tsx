import React, { useEffect, useRef } from "react";
import L from "leaflet";
import type { GeoCoordinate } from "../services/mapService";
import { Sparkles } from "lucide-react";

interface Props {
  pickupCoords?: GeoCoordinate | null;
  deliveryCoords?: GeoCoordinate | null;
  courierCoords?: GeoCoordinate | null;
  routePoints?: [number, number][];
  distanceKm?: number;
  approximateDistanceText?: string;
  isAutoCalculated?: boolean;
}

const DEFAULT_CENTER: [number, number] = [39.0, 35.0];

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export const RouteMap: React.FC<Props> = ({
  pickupCoords,
  deliveryCoords,
  courierCoords,
  routePoints = [],
  approximateDistanceText,
}) => {
  const mapContainerRef =
    useRef<HTMLDivElement>(null);

  const mapInstanceRef =
    useRef<L.Map | null>(null);

  const layerGroupRef =
    useRef<L.LayerGroup | null>(null);

  /*
   * ============================================================
   * HARİTAYI BAÅLAT
   * ============================================================
   */
  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    if (mapInstanceRef.current) {
      return;
    }

    const map = L.map(
      mapContainerRef.current,
      {
        center: DEFAULT_CENTER,
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
      }
    );

    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    L.control
      .zoom({
        position: "topright",
      })
      .addTo(map);

    const layerGroup =
      L.layerGroup().addTo(map);

    layerGroupRef.current =
      layerGroup;

    mapInstanceRef.current =
      map;

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();

        mapInstanceRef.current =
          null;
      }

      layerGroupRef.current =
        null;
    };
  }, []);

  /*
   * ============================================================
   * MARKER + ROTA GÜNCELLE
   * ============================================================
   */
  useEffect(() => {
    const map =
      mapInstanceRef.current;

    const layerGroup =
      layerGroupRef.current;

    if (!map || !layerGroup) {
      return;
    }

    layerGroup.clearLayers();

    const boundsPoints:
      L.LatLngExpression[] = [];

    /*
     * ==========================================================
     * ALIM NOKTASI
     * ==========================================================
     */
    if (
      pickupCoords &&
      typeof pickupCoords.lat === "number" &&
      typeof pickupCoords.lng === "number"
    ) {
      const pickupName =
        pickupCoords.name ||
        "Alım Noktası";

      const pickupIcon =
        L.divIcon({
          className:
            "custom-map-marker-pickup",

          html:
            '<div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">' +
            '<div style="background:#0B0B0D;border:2px solid #D6A84F;color:#D6A84F;font-size:10px;font-weight:800;padding:3px 7px;border-radius:6px;white-space:nowrap;margin-bottom:4px;box-shadow:0 4px 10px rgba(0,0,0,.5);">' +
            "Alım: " +
            pickupName +
            "</div>" +
            '<div style="width:24px;height:24px;border-radius:50%;background:#D6A84F;border:3px solid #0B0B0D;box-shadow:0 0 12px rgba(214,168,79,.8);display:flex;align-items:center;justify-content:center;">' +
            '<div style="width:8px;height:8px;border-radius:50%;background:#0B0B0D;"></div>' +
            "</div>" +
            "</div>",

          iconSize: [0, 0],
        });

      const marker =
        L.marker(
          [
            pickupCoords.lat,
            pickupCoords.lng,
          ],
          {
            icon: pickupIcon,
          }
        );

      layerGroup.addLayer(
        marker
      );

      boundsPoints.push([
        pickupCoords.lat,
        pickupCoords.lng,
      ]);
    }

    /*
     * ==========================================================
     * TESLİMAT NOKTASI
     * ==========================================================
     */
    if (
      deliveryCoords &&
      typeof deliveryCoords.lat === "number" &&
      typeof deliveryCoords.lng === "number"
    ) {
      const deliveryName =
        deliveryCoords.name ||
        "Teslimat Noktası";

      const deliveryIcon =
        L.divIcon({
          className:
            "custom-map-marker-delivery",

          html:
            '<div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">' +
            '<div style="background:#0B0B0D;border:2px solid #10B981;color:#10B981;font-size:10px;font-weight:800;padding:3px 7px;border-radius:6px;white-space:nowrap;margin-bottom:4px;box-shadow:0 4px 10px rgba(0,0,0,.5);">' +
            "Teslimat: " +
            deliveryName +
            "</div>" +
            '<div style="width:24px;height:24px;border-radius:50%;background:#10B981;border:3px solid #0B0B0D;box-shadow:0 0 12px rgba(16,185,129,.8);display:flex;align-items:center;justify-content:center;">' +
            '<div style="width:8px;height:8px;border-radius:50%;background:#0B0B0D;"></div>' +
            "</div>" +
            "</div>",

          iconSize: [0, 0],
        });

      const marker =
        L.marker(
          [
            deliveryCoords.lat,
            deliveryCoords.lng,
          ],
          {
            icon: deliveryIcon,
          }
        );

      layerGroup.addLayer(
        marker
      );

      boundsPoints.push([
        deliveryCoords.lat,
        deliveryCoords.lng,
      ]);
    }

    /*
     * ==========================================================
     * CANLI KURYE
     * ==========================================================
     */
    if (
      courierCoords &&
      typeof courierCoords.lat === "number" &&
      typeof courierCoords.lng === "number"
    ) {
      const courierName =
        courierCoords.name ||
        "Kurye Canlı";

      const courierIcon =
        L.divIcon({
          className:
            "custom-map-marker-courier",

          html:
            '<div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">' +
            '<div style="background:#0B0B0D;border:2px solid #D6A84F;color:#D6A84F;font-size:10px;font-weight:800;padding:3px 7px;border-radius:6px;white-space:nowrap;margin-bottom:4px;box-shadow:0 4px 10px rgba(0,0,0,.5);display:flex;align-items:center;gap:4px;">' +
            '<span style="width:6px;height:6px;border-radius:50%;background:#10B981;display:inline-block;"></span>' +
            courierName +
            "</div>" +
            '<div style="width:30px;height:30px;border-radius:50%;background:#D6A84F;border:3px solid #0B0B0D;box-shadow:0 0 16px rgba(214,168,79,1);display:flex;align-items:center;justify-content:center;font-size:14px;">' +
            "🏁›µ" +
            "</div>" +
            "</div>",

          iconSize: [0, 0],
        });

      const marker =
        L.marker(
          [
            courierCoords.lat,
            courierCoords.lng,
          ],
          {
            icon: courierIcon,
          }
        );

      layerGroup.addLayer(
        marker
      );

      boundsPoints.push([
        courierCoords.lat,
        courierCoords.lng,
      ]);
    }

    /*
     * ==========================================================
     * GERÇEK ROTA
     * ==========================================================
     */
    if (
      routePoints &&
      routePoints.length >= 2
    ) {
      const glowPolyline =
        L.polyline(
          routePoints,
          {
            color: "#D6A84F",
            weight: 7,
            opacity: 0.3,
            lineCap: "round",
            lineJoin: "round",
          }
        );

      layerGroup.addLayer(
        glowPolyline
      );

      const mainPolyline =
        L.polyline(
          routePoints,
          {
            color: "#D6A84F",
            weight: 3,
            opacity: 0.95,
            dashArray: "8, 6",
            lineCap: "round",
            lineJoin: "round",
          }
        );

      layerGroup.addLayer(
        mainPolyline
      );

      routePoints.forEach(
        (point) => {
          boundsPoints.push(point);
        }
      );
    } else if (
      pickupCoords &&
      deliveryCoords &&
      typeof pickupCoords.lat === "number" &&
      typeof pickupCoords.lng === "number" &&
      typeof deliveryCoords.lat === "number" &&
      typeof deliveryCoords.lng === "number"
    ) {
      /*
       * Rota henüz gelmediyse iki adres
       * arasında geçici bağlantı göster.
       */
      const directPoints:
        [number, number][] = [
          [
            pickupCoords.lat,
            pickupCoords.lng,
          ],
          [
            deliveryCoords.lat,
            deliveryCoords.lng,
          ],
        ];

      const line =
        L.polyline(
          directPoints,
          {
            color: "#D6A84F",
            weight: 3,
            opacity: 0.85,
            dashArray: "6, 6",
            lineCap: "round",
          }
        );

      layerGroup.addLayer(
        line
      );
    }

    /*
     * ==========================================================
     * HARİTAYI NOKTALARA SIÄDIR
     * ==========================================================
     */
    if (
      boundsPoints.length >= 2
    ) {
      const bounds =
        L.latLngBounds(
          boundsPoints
        );

      map.fitBounds(
        bounds,
        {
          padding: [
            45,
            45,
          ],
          maxZoom: 14,
          animate: true,
        }
      );
    } else if (
      boundsPoints.length === 1
    ) {
      map.setView(
        boundsPoints[0],
        13,
        {
          animate: true,
        }
      );
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [
    pickupCoords,
    deliveryCoords,
    courierCoords,
    routePoints,
  ]);

  const hasRoute =
    Boolean(
      pickupCoords &&
      deliveryCoords
    );

  const isTracking =
    Boolean(courierCoords);

  return (
    <div className="relative w-full h-48 sm:h-52 rounded-2xl overflow-hidden border border-[#303036] bg-[#0B0B0D] shadow-inner">

      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
      />

      {/* STATUS */}
      <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 pointer-events-none">

        <div className="flex items-center gap-1.5 bg-[#0B0B0D]/90 backdrop-blur-md border border-[#303036] px-2.5 py-1 rounded-lg text-[10px] text-white font-medium shadow-lg">

          <div
            className={
              "w-2 h-2 rounded-full " +
              (
                isTracking
                  ? "bg-emerald-400 animate-ping"
                  : hasRoute
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-[#D6A84F]"
              )
            }
          />

          <span className="font-['Space_Grotesk'] font-bold text-[#D6A84F]">
            {
              isTracking
                ? "Kurye Canlı Konum Takibi"
                : hasRoute
                  ? "Canlı Rota Önizleme"
                  : "Türkiye Haritası"
            }
          </span>
        </div>

        {hasRoute &&
          approximateDistanceText && (
            <div className="flex items-center gap-1 bg-[#D6A84F]/15 backdrop-blur-md border border-[#D6A84F]/40 px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#D6A84F] shadow-lg">

              <Sparkles className="w-3 h-3 text-[#D6A84F]" />

              <span>
                {
                  approximateDistanceText
                }
              </span>
            </div>
          )}
      </div>

      {/* BOÅ DURUM */}
      {!hasRoute &&
        !isTracking && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 pointer-events-none flex items-center justify-center">

            <div className="bg-[#0B0B0D]/85 backdrop-blur-sm border border-[#303036] px-3 py-1.5 rounded-xl text-[10px] text-[#999999] text-center max-w-xs shadow-lg">

              🏁“ Alınacak ve teslim edilecek
              adresleri girdiğinizde rota
              otomatik çizilecektir.

            </div>
          </div>
        )}

      {/* LEJANT */}
      {(hasRoute ||
        isTracking) && (
          <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-2 bg-[#0B0B0D]/90 backdrop-blur-md border border-[#303036] px-2.5 py-1 rounded-lg text-[9px] text-slate-300 shadow-lg pointer-events-none">

            {pickupCoords && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#D6A84F]" />
                Alım
              </span>
            )}

            {courierCoords && (
              <span className="flex items-center gap-1 font-bold text-amber-300">
                <span>🏁›µ</span>
                Kurye
              </span>
            )}

            {deliveryCoords && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                Teslimat
              </span>
            )}
          </div>
        )}
    </div>
  );
};

export default RouteMap;

