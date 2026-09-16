import type { PricingConfig, Order } from "../types";

type Storage = typeof import("./storage")["storage"];

const DEFAULT_PRICING: PricingConfig = {
  perKmPrice: 20,
  minPrice: 100,
  urgentMultiplier: 1.5,
  vipMultiplier: 2,
  requireDeliveryPhoto: false,
  updatedAt: new Date().toISOString(),
};

let storagePromise: Promise<Storage> | null = null;

function loadStorage(): Promise<Storage> {
  if (!storagePromise) {
    storagePromise = import("./storage").then(({ storage }) => storage);
  }
  return storagePromise;
}

export const storage = {
  getOrders(): Order[] {
    return [];
  },

  getPricing(): PricingConfig {
    return DEFAULT_PRICING;
  },

  getCurrentUser() {
    return null;
  },

  async getService(): Promise<Storage> {
    return loadStorage();
  },
};
