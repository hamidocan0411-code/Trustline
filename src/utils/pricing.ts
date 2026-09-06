import { CourierType, PricingConfig } from '../types';

export const DEFAULT_PRICING: PricingConfig = {
  perKmPrice: 50,
  minPrice: 250,
  urgentMultiplier: 1.30,
  vipMultiplier: 1.60,
  requireDeliveryPhoto: false,
  updatedAt: new Date().toISOString(),
};

/**
 * Calculates delivery price according to official Trustline Express formulas:
 * 1. Base price = distanceKm * perKmPrice
 * 2. If base price < minPrice => minPrice
 * 3. Multiply by courier type multiplier (Standart: 1.0, Acil: urgentMultiplier, VIP: vipMultiplier)
 * 4. Round to nearest integer or 2 decimals
 */
export function calculateOrderPrice(
  distanceKm: number,
  courierType: CourierType,
  pricing: PricingConfig = DEFAULT_PRICING
): { basePrice: number; finalPrice: number; multiplier: number; isMinimumApplied: boolean } {
  const safeKm = Math.max(0, distanceKm || 0);
  const rawKmCost = safeKm * pricing.perKmPrice;
  const isMinimumApplied = rawKmCost < pricing.minPrice;
  const basePrice = Math.max(rawKmCost, pricing.minPrice);

  let multiplier = 1.0;
  if (courierType === 'Acil Kurye') {
    multiplier = pricing.urgentMultiplier;
  } else if (courierType === 'VIP Kurye') {
    multiplier = pricing.vipMultiplier;
  }

  const finalPrice = Math.round(basePrice * multiplier);

  return {
    basePrice,
    finalPrice,
    multiplier,
    isMinimumApplied,
  };
}

/**
 * Modular geocoding and distance calculation utility.
 * Ready for future Google Maps Distance Matrix or Directions API integration.
 */
export function estimateDistanceBetweenAddresses(pickup: string, delivery: string): number {
  if (!pickup || !delivery) return 10;

  const p = pickup.toLowerCase();
  const d = delivery.toLowerCase();

  // Approximate realistic Istanbul district distances
  const districtDistances: Record<string, number> = {
    'kadıköy-beşiktaş': 14,
    'beşiktaş-kadıköy': 14,
    'avcılar-beşiktaş': 34,
    'beşiktaş-avcılar': 34,
    'maslak-levent': 6,
    'levent-maslak': 6,
    'üsküdar-kadıköy': 7,
    'kadıköy-üsküdar': 7,
    'şişli-beşiktaş': 4,
    'beşiktaş-şişli': 4,
    'bakırköy-taksim': 16,
    'taksim-bakırköy': 16,
    'ataşehir-kadıköy': 9,
    'kadıköy-ataşehir': 9,
    'sarıyer-beşiktaş': 18,
    'beşiktaş-sarıyer': 18,
    'kartal-kadıköy': 22,
    'kadıköy-kartal': 22,
    'başakşehir-şişli': 26,
    'şişli-başakşehir': 26,
  };

  for (const key of Object.keys(districtDistances)) {
    const [from, to] = key.split('-');
    if (p.includes(from) && d.includes(to)) {
      return districtDistances[key];
    }
  }

  // Length-based synthetic hash between 6 and 32 km if not in pre-mapped table
  const hash = Math.abs((p.length * 7 + d.length * 13) % 27) + 5;
  return hash;
}
