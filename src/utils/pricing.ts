import { CourierType, PricingConfig } from '../types';

export const DEFAULT_PRICING: PricingConfig = {
  perKmPrice: 36,
  minPrice: 250,
  urgentMultiplier: 1.30,
  vipMultiplier: 1.60,
  requireDeliveryPhoto: false,
  updatedAt: new Date().toISOString(),
};

/**
 * Trustline Express paket ebat ek Ã¼cretleri
 */
export type PackageSize = 'KÃ¼Ã§Ã¼k' | 'Orta' | 'BÃ¼yÃ¼k' | 'Ã‡ok BÃ¼yÃ¼k';

export const PACKAGE_SIZE_FEES: Record<PackageSize, number> = {
  'KÃ¼Ã§Ã¼k': 0,
  'Orta': 50,
  'BÃ¼yÃ¼k': 100,
  'Ã‡ok BÃ¼yÃ¼k': 200,
};

/**
 * Calculates delivery price:
 * 1. KM Ã¼creti hesaplanÄ±r
 * 2. Minimum fiyat uygulanÄ±r
 * 3. Kurye tipine gÃ¶re Ã§arpan uygulanÄ±r
 * 4. Paket ebat ek Ã¼creti eklenir
 */
export function calculateOrderPrice(
  distanceKm: number,
  courierType: CourierType,
  pricing: PricingConfig = DEFAULT_PRICING,
  packageSize: PackageSize = 'KÃ¼Ã§Ã¼k'
): {
  basePrice: number;
  finalPrice: number;
  multiplier: number;
  isMinimumApplied: boolean;
  packageSizeFee: number;
} {
  const safeKm = Math.max(0, distanceKm || 0);

  const rawKmCost = safeKm * pricing.perKmPrice;

  const isMinimumApplied = rawKmCost < pricing.minPrice;

  const basePrice = Math.max(
    rawKmCost,
    pricing.minPrice
  );

  let multiplier = 1.0;

  if (courierType === 'Acil Kurye') {
    multiplier = pricing.urgentMultiplier;
  } else if (courierType === 'VIP Kurye') {
    multiplier = pricing.vipMultiplier;
  }

  const packageSizeFee =
    PACKAGE_SIZE_FEES[packageSize] ?? 0;

  const courierPrice = basePrice * multiplier;

  const finalPrice = Math.round(
    courierPrice + packageSizeFee
  );

  return {
    basePrice,
    finalPrice,
    multiplier,
    isMinimumApplied,
    packageSizeFee,
  };
}

/**
 * Modular geocoding and distance calculation utility.
 */
export function estimateDistanceBetweenAddresses(
  pickup: string,
  delivery: string
): number {
  if (!pickup || !delivery) return 10;

  const p = pickup.toLowerCase();
  const d = delivery.toLowerCase();

  const districtDistances: Record<string, number> = {
    'kadÄ±kÃ¶y-beÅŸiktaÅŸ': 14,
    'beÅŸiktaÅŸ-kadÄ±kÃ¶y': 14,
    'avcÄ±lar-beÅŸiktaÅŸ': 34,
    'beÅŸiktaÅŸ-avcÄ±lar': 34,
    'maslak-levent': 6,
    'levent-maslak': 6,
    'Ã¼skÃ¼dar-kadÄ±kÃ¶y': 7,
    'kadÄ±kÃ¶y-Ã¼skÃ¼dar': 7,
    'ÅŸiÅŸli-beÅŸiktaÅŸ': 4,
    'beÅŸiktaÅŸ-ÅŸiÅŸli': 4,
    'bakÄ±rkÃ¶y-taksim': 16,
    'taksim-bakÄ±rkÃ¶y': 16,
    'ataÅŸehir-kadÄ±kÃ¶y': 9,
    'kadÄ±kÃ¶y-ataÅŸehir': 9,
    'sarÄ±yer-beÅŸiktaÅŸ': 18,
    'beÅŸiktaÅŸ-sarÄ±yer': 18,
    'kartal-kadÄ±kÃ¶y': 22,
    'kadÄ±kÃ¶y-kartal': 22,
    'baÅŸakÅŸehir-ÅŸiÅŸli': 26,
    'ÅŸiÅŸli-baÅŸakÅŸehir': 26,
  };

  for (const key of Object.keys(districtDistances)) {
    const [from, to] = key.split('-');

    if (p.includes(from) && d.includes(to)) {
      return districtDistances[key];
    }
  }

  const hash =
    Math.abs(
      (p.length * 7 + d.length * 13) % 27
    ) + 5;

  return hash;
}
