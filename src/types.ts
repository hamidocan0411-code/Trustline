export type UserRole = 'customer' | 'courier' | 'admin';

export type PackageType =
  | 'Evrak'
  | 'Küçük Paket'
  | 'Orta Paket'
  | 'Büyük Paket'
  | 'Diğer';

export type CourierType =
  | 'Standart Kurye'
  | 'Acil Kurye'
  | 'VIP Kurye';

export type UrgencyLevel =
  | 'Normal'
  | 'Acil'
  | 'Çok Acil';

export type OrderStatus =
  | 'Kurye Bekleniyor'
  | 'Kurye Atandı'
  | 'Kurye Kabul Etti'
  | 'Paket Alındı'
  | 'Teslimatta'
  | 'Teslim Edildi'
  | 'İptal Edildi';

export type CourierAvailability =
  | 'Müsait'
  | 'Meşgul'
  | 'Çevrimdışı';

export interface CourierLocation {
  courierId: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  isSharing: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;

  // Kurye araç bilgileri
  vehicle?: string;
  plate?: string;

  courierStatus?: CourierAvailability;
  employmentStatus?: 'active' | 'inactive';
  totalDeliveries?: number;
  rating?: number;

  createdAt: string;
  updatedAt?: string;
}

export interface CourierRating {
  id: string;
  orderId: string;
  courierId: string;
  customerId: string;
  customerName?: string;
  score: number;
  comment?: string;
  createdAt: string;
}

export interface DeliveryProof {
  deliveryPhoto?: string;
  receiverName: string;
  deliveryNote?: string;
  signature: string;
  deliveredAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;

  courierId: string | null;
  courierName?: string;
  courierPhone?: string;
  courierSeenAt?: string;

  pickupAddress: string;
  deliveryAddress: string;

  packageType: PackageType;
  courierType: CourierType;
  urgency: UrgencyLevel;

  distanceKm: number;
  packageCount?: number;

  price: number;
  status: OrderStatus;
  note: string;

  estimatedDeliveryMinutes?: number;

  deliveryProof?: DeliveryProof;

  deliveryPhoto?: string;
  receiverName?: string;
  deliveryNote?: string;
  signature?: string;
  deliveredAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface PricingConfig {
  perKmPrice: number;
  minPrice: number;
  urgentMultiplier: number;
  vipMultiplier: number;
  requireDeliveryPhoto?: boolean;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  orderId?: string;
  title: string;
  message: string;
  type:
    | 'order_status'
    | 'assignment'
    | 'system'
    | 'info';
  read: boolean;
  createdAt: string;
}

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  extractedDraft?: Partial<Order>;
}

export interface GeoCoordinate {
  lat: number;
  lng: number;
  name?: string;
}
