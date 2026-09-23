export type UserRole = 'customer' | 'corporate' | 'courier' | 'admin';

export type OrderType = 'standard' | 'pharmacy';

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
  visibleToCustomerIds?: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  companyId?: string;
  companyName?: string;
  companyContactName?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  address?: string;
  taxNumber?: string;
  taxOffice?: string;
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
  orderType?: OrderType;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerType?: 'individual' | 'corporate';
  companyId?: string;
  companyName?: string;
  companyContactName?: string;

  courierId: string | null;
  courierName?: string;
  courierPhone?: string;
  courierSeenAt?: string;

  pickupAddress: string;
  deliveryAddress: string;

  packageType: PackageType;
  packageSize?: 'Küçük' | 'Orta' | 'Büyük' | 'Çok Büyük';
  courierType: CourierType;
  urgency: UrgencyLevel;

  distanceKm: number;
  packageCount?: number;

  price: number;
  status: OrderStatus;
  note: string;
  // Eczane siparişi alanları
  pharmacyName?: string;
  pharmacyAddress?: string;
  pharmacyPhone?: string;
  pharmacyLatitude?: number;
  pharmacyLongitude?: number;
  pharmacyPlaceId?: string;
  pharmacyOpeningHours?: string;
  pharmacyProduct?: string;
  pharmacyProductDescription?: string;
  pharmacyQuantity?: number;
  pharmacyRecipientName?: string;
  pharmacyRecipientPhone?: string;
  pharmacyDeliveryType?: 'Standart Teslimat' | 'Acil Teslimat';
  pharmacyPaymentMethod?: 'Nakit';
  pharmacyPrescriptionPath?: string;
  pharmacyPrescriptionFileName?: string;


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

