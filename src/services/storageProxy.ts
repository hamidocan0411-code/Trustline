import type { StorageService } from "./storage";
import type { PricingConfig, Order } from "../types";

const DEFAULT_PRICING: PricingConfig = {
  perKmPrice: 20,
  minPrice: 100,
  urgentMultiplier: 1.5,
  vipMultiplier: 2,
  requireDeliveryPhoto: false,
  updatedAt: new Date().toISOString(),
};

let storagePromise: Promise<StorageService> | null = null;

function loadStorage(): Promise<StorageService> {
  if (!storagePromise) {
    storagePromise = import("./storage").then(({ storage }) => storage);
  }
  return storagePromise;
}

/**
 * App ilk ekranda yalnızca yerel başlangıç verisine ihtiyaç duyuyor.
 * Ağ/Firebase tabanlı StorageService, kullanıcı oturumu oluştuktan sonra
 * gerçekten ihtiyaç olduğunda yüklenir.
 */
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

  async getService(): Promise<StorageService> {
    return loadStorage();
  },
} as Pick<StorageService, "getOrders" | "getPricing" | "getCurrentUser"> & {
  getService: () => Promise<StorageService>;
};
