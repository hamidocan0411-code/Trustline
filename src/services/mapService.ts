export interface GeoCoordinate {
  name: string;
  lat: number;
  lng: number;
  side?: 'europe' | 'asia';
}

export interface DistanceCalculationResult {
  success: boolean;
  isAutoCalculated: boolean;
  distanceKm: number;
  durationMinutes?: number;
  approximateDistanceText?: string;
  pickupCoords?: GeoCoordinate | null;
  deliveryCoords?: GeoCoordinate | null;
  routePoints?: [number, number][];
  error?: string;
  provider?: string;
}

export interface MapProviderConfig {
  tileUrl: string;
  attribution: string;
  defaultCenter: [number, number];
  defaultZoom: number;
}

// Configured for ultra-reliable CartoDB Dark Matter tiles (free, high performance, elegant dark aesthetic)
export const DEFAULT_MAP_CONFIG: MapProviderConfig = {
  tileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  defaultCenter: [41.015137, 28.979530], // Istanbul center
  defaultZoom: 11,
};

/**
 * Modular Map & Distance Service
 * 
 * Abstracted layer connecting the frontend to server-side distance calculation
 * and mapping providers. This allows swapping to Mapbox, Google Maps JavaScript API,
 * or custom tile servers in the future without changing any UI component code.
 */
class MapService {
  private config: MapProviderConfig;

  constructor(config: MapProviderConfig = DEFAULT_MAP_CONFIG) {
    this.config = config;
  }

  public getConfig(): MapProviderConfig {
    return this.config;
  }

  public setConfig(newConfig: Partial<MapProviderConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Resolves an address to geographical coordinates via the distance calculation endpoint
   */
  public async geocode(address: string): Promise<GeoCoordinate | null> {
    if (!address || address.trim().length < 2) return null;
    try {
      const res = await this.calculateDistance(address, 'Kadıköy, İstanbul');
      if (res.pickupCoords) return res.pickupCoords;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Securely requests geographical coordinates and driving distance from the server-side API.
   * No API keys are required or exposed on the client.
   */
  public async calculateDistance(
    pickupAddress: string,
    deliveryAddress: string
  ): Promise<DistanceCalculationResult> {
    const pickup = pickupAddress?.trim() || '';
    const delivery = deliveryAddress?.trim() || '';

    if (pickup.length < 2 || delivery.length < 2) {
      return {
        success: false,
        isAutoCalculated: false,
        distanceKm: 10,
        error: 'Mesafe otomatik hesaplanamadı. KM değerini manuel girebilirsiniz.',
      };
    }

    try {
      const response = await fetch('/api/distance/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup, delivery }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data: DistanceCalculationResult = await response.json();

      if (data && data.success && data.isAutoCalculated && data.distanceKm > 0) {
        return {
          ...data,
          approximateDistanceText: data.approximateDistanceText || `Yaklaşık mesafe: ${data.distanceKm} km`,
        };
      }

      return {
        success: false,
        isAutoCalculated: false,
        distanceKm: 10,
        error: data.error || 'Mesafe otomatik hesaplanamadı. KM değerini manuel girebilirsiniz.',
      };
    } catch (err) {
      // Fallback cleanly without breaking the application
      return {
        success: false,
        isAutoCalculated: false,
        distanceKm: 10,
        error: 'Mesafe otomatik hesaplanamadı. KM değerini manuel girebilirsiniz.',
      };
    }
  }
}

export const mapService = new MapService();
