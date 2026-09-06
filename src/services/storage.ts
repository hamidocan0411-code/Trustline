import {
  Order,
  OrderStatus,
  PricingConfig,
  UserProfile,
  NotificationItem,
  CourierAvailability,
  CourierLocation,
} from '../types';

import { DEFAULT_PRICING } from '../utils/pricing';

import {
  SEED_ADMIN,
  SEED_COURIERS,
  SEED_CUSTOMERS,
  SEED_ORDERS,
} from '../data/seedData';

const STORAGE_KEYS = {
  ORDERS: 'trustline_orders_v1',
  USERS: 'trustline_users_v1',
  PRICING: 'trustline_pricing_v1',
  NOTIFICATIONS: 'trustline_notifications_v1',
  CURRENT_USER: 'trustline_current_user_v1',
  COURIER_LOCATIONS: 'trustline_courier_locations_v1',
};

class StorageService {
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initDataIfEmpty();
  }

  private initDataIfEmpty() {
    try {
      if (!localStorage.getItem(STORAGE_KEYS.PRICING)) {
        localStorage.setItem(
          STORAGE_KEYS.PRICING,
          JSON.stringify(DEFAULT_PRICING)
        );
      }

      if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
        const allUsers: UserProfile[] = [
          SEED_ADMIN,
          ...SEED_COURIERS,
          ...SEED_CUSTOMERS,
        ];

        localStorage.setItem(
          STORAGE_KEYS.USERS,
          JSON.stringify(allUsers)
        );
      }

      if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
        localStorage.setItem(
          STORAGE_KEYS.ORDERS,
          JSON.stringify(SEED_ORDERS)
        );
      }

      if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
        const initialNotifications: NotificationItem[] = [
          {
            id: 'notif-1',
            userId: 'cust_1',
            orderId: 'TL-8941',
            title: 'Siparişiniz Yolda 🛵',
            message:
              'Kuryeniz Maslak istikametinde teslimat adresine doğru ilerliyor.',
            type: 'order_status',
            read: false,
            createdAt: new Date(
              Date.now() - 1000 * 60 * 15
            ).toISOString(),
          },
          {
            id: 'notif-2',
            userId: 'cust_2',
            orderId: 'TL-8942',
            title: 'Paket Kurye Tarafından Alındı 📦',
            message:
              'Kurye Murat Öztürk paketinizi teslim aldı.',
            type: 'order_status',
            read: false,
            createdAt: new Date(
              Date.now() - 1000 * 60 * 45
            ).toISOString(),
          },
        ];

        localStorage.setItem(
          STORAGE_KEYS.NOTIFICATIONS,
          JSON.stringify(initialNotifications)
        );
      }

      if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
        localStorage.setItem(
          STORAGE_KEYS.CURRENT_USER,
          JSON.stringify(SEED_CUSTOMERS[0])
        );
      }

      if (!localStorage.getItem(STORAGE_KEYS.COURIER_LOCATIONS)) {
        localStorage.setItem(
          STORAGE_KEYS.COURIER_LOCATIONS,
          JSON.stringify({})
        );
      }
    } catch (error) {
      console.error(
        'Trustline Express local data initialization failed:',
        error
      );
    }
  }

  public subscribe(callback: () => void) {
    this.listeners.add(callback);

    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    this.listeners.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.warn('Storage listener error:', error);
      }
    });
  }

  // =========================================================
  // PRICING
  // =========================================================

  public getPricing(): PricingConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRICING);

      return data
        ? JSON.parse(data)
        : DEFAULT_PRICING;
    } catch {
      return DEFAULT_PRICING;
    }
  }

  public updatePricing(
    config: Partial<PricingConfig>
  ): PricingConfig {
    const current = this.getPricing();

    const updated: PricingConfig = {
      ...current,
      ...config,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      STORAGE_KEYS.PRICING,
      JSON.stringify(updated)
    );

    this.notify();

    return updated;
  }

  // =========================================================
  // USERS
  // =========================================================

  public getUsers(): UserProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);

      if (data) {
        return JSON.parse(data);
      }

      return [
        SEED_ADMIN,
        ...SEED_COURIERS,
        ...SEED_CUSTOMERS,
      ];
    } catch {
      return [
        SEED_ADMIN,
        ...SEED_COURIERS,
        ...SEED_CUSTOMERS,
      ];
    }
  }

  public getCouriers(): UserProfile[] {
    return this.getUsers().filter(
      (user) => user.role === 'courier'
    );
  }

  public getCustomers(): UserProfile[] {
    return this.getUsers().filter(
      (user) => user.role === 'customer'
    );
  }

  public addCourier(
    courierData: Omit<
      UserProfile,
      'id' | 'role' | 'createdAt'
    >
  ): UserProfile {
    const users = this.getUsers();

    const newCourier: UserProfile = {
      ...courierData,
      id: `cour_${Date.now()}`,
      role: 'courier',
      totalDeliveries: 0,
      rating: 5,
      courierStatus:
        courierData.courierStatus || 'Müsait',
      createdAt: new Date().toISOString(),
    };

    users.push(newCourier);

    localStorage.setItem(
      STORAGE_KEYS.USERS,
      JSON.stringify(users)
    );

    this.notify();

    return newCourier;
  }

  public updateCourierStatus(
    courierId: string,
    status: CourierAvailability
  ) {
    const users = this.getUsers();

    const index = users.findIndex(
      (user) => user.id === courierId
    );

    if (index === -1) return;

    users[index].courierStatus = status;

    localStorage.setItem(
      STORAGE_KEYS.USERS,
      JSON.stringify(users)
    );

    this.notify();
  }

  // =========================================================
  // ORDERS
  // =========================================================

  public getOrders(): Order[] {
    try {
      const data = localStorage.getItem(
        STORAGE_KEYS.ORDERS
      );

      if (!data) {
        return SEED_ORDERS;
      }

      const parsed: Order[] = JSON.parse(data);

      // Restore demo delivery proof if necessary
      const demoOrder = parsed.find(
        (order) => order.id === 'TL-8948'
      );

      if (
        demoOrder &&
        !demoOrder.deliveryProof
      ) {
        const seedOrder = SEED_ORDERS.find(
          (order) => order.id === 'TL-8948'
        );

        if (seedOrder) {
          Object.assign(demoOrder, seedOrder);

          localStorage.setItem(
            STORAGE_KEYS.ORDERS,
            JSON.stringify(parsed)
          );
        }
      }

      return parsed;
    } catch {
      return SEED_ORDERS;
    }
  }

  public getOrderById(
    id: string
  ): Order | undefined {
    return this.getOrders().find(
      (order) => order.id === id
    );
  }

  public createOrder(
    orderData: Omit<
      Order,
      'id' | 'createdAt' | 'updatedAt'
    >
  ): Order {
    const orders = this.getOrders();

    let orderId = '';

    do {
      orderId = `TL-${Math.floor(
        1000 + Math.random() * 9000
      )}`;
    } while (
      orders.some((order) => order.id === orderId)
    );

    const now = new Date().toISOString();

    const newOrder: Order = {
      ...orderData,
      id: orderId,
      createdAt: now,
      updatedAt: now,
    };

    orders.unshift(newOrder);

    localStorage.setItem(
      STORAGE_KEYS.ORDERS,
      JSON.stringify(orders)
    );

    this.addNotification({
      userId: newOrder.customerId,
      orderId: newOrder.id,
      title: 'Siparişiniz Alındı',
      message:
        `${newOrder.id} numaralı siparişiniz oluşturuldu. ` +
        'En yakın kurye atanıyor.',
      type: 'order_status',
    });

    this.notify();

    return newOrder;
  }

  public updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    note?: string
  ): Order | undefined {
    const orders = this.getOrders();

    const index = orders.findIndex(
      (order) => order.id === orderId
    );

    if (index === -1) return undefined;

    const order = orders[index];

    order.status = status;
    order.updatedAt = new Date().toISOString();

    if (note) {
      order.note = note;
    }

    orders[index] = order;

    localStorage.setItem(
      STORAGE_KEYS.ORDERS,
      JSON.stringify(orders)
    );

    const notifMessages: Record<
      OrderStatus,
      string
    > = {
      'Kurye Bekleniyor':
        'Siparişiniz için kurye aranıyor.',

      'Kurye Atandı':
        `Siparişinize kurye ${
          order.courierName || ''
        } atandı.`,

      'Kurye Kabul Etti':
        `Kurye ${
          order.courierName || ''
        } siparişinizi kabul etti ve teslimat için harekete geçti.`,

      'Paket Alındı':
        'Paketiniz kurye tarafından teslim alındı, adrese yola çıkıyor.',

      'Teslimatta':
        'Paketiniz şu anda teslimat adresine doğru taşınıyor.',

      'Teslim Edildi':
        'Paketiniz başarıyla teslim edildi. Trustline Express\'i tercih ettiğiniz için teşekkür ederiz.',

      'İptal Edildi':
        'Siparişiniz iptal edildi.',
    };

    this.addNotification({
      userId: order.customerId,
      orderId: order.id,
      title: `Sipariş Durumu: ${status}`,
      message:
        notifMessages[status] ||
        `Sipariş durumu güncellendi: ${status}`,
      type: 'order_status',
    });

    this.notify();

    return order;
  }

  // =========================================================
  // DELIVERY PROOF
  // =========================================================

  public completeOrderWithProof(
    orderId: string,
    proof: {
      receiverName: string;
      deliveryNote?: string;
      deliveryPhoto?: string;
      signature: string;
    }
  ): Order | undefined {
    const orders = this.getOrders();

    const index = orders.findIndex(
      (order) => order.id === orderId
    );

    if (index === -1) return undefined;

    const deliveredAt =
      new Date().toISOString();

    const order = orders[index];

    const receiverName =
      proof.receiverName.trim();

    const deliveryNote =
      proof.deliveryNote?.trim() || '';

    const deliveryPhoto =
      proof.deliveryPhoto || '';

    order.status = 'Teslim Edildi';
    order.updatedAt = deliveredAt;
    order.deliveredAt = deliveredAt;

    order.receiverName = receiverName;
    order.deliveryNote = deliveryNote;
    order.deliveryPhoto = deliveryPhoto;
    order.signature = proof.signature;

    order.deliveryProof = {
      receiverName,
      deliveryNote,
      deliveryPhoto,
      signature: proof.signature,
      deliveredAt,
    };

    orders[index] = order;

    localStorage.setItem(
      STORAGE_KEYS.ORDERS,
      JSON.stringify(orders)
    );

    // Courier statistics
    if (order.courierId) {
      const users = this.getUsers();

      const courierIndex = users.findIndex(
        (user) => user.id === order.courierId
      );

      if (courierIndex !== -1) {
        users[courierIndex].totalDeliveries =
          (users[courierIndex].totalDeliveries || 0) +
          1;

        localStorage.setItem(
          STORAGE_KEYS.USERS,
          JSON.stringify(users)
        );
      }
    }

    this.addNotification({
      userId: order.customerId,
      orderId: order.id,
      title: 'Siparişiniz Teslim Edildi 🎁',
      message:
        `${order.id} numaralı paketiniz ` +
        `${receiverName || 'alıcıya'} teslim edildi. ` +
        'Teslimat kanıtını sipariş detayından inceleyebilirsiniz.',
      type: 'order_status',
    });

    this.notify();

    return order;
  }

  // =========================================================
  // COURIER ASSIGNMENT
  // =========================================================

  public assignCourier(
    orderId: string,
    courierId: string
  ): Order | undefined {
    const orders = this.getOrders();
    const couriers = this.getCouriers();

    const courier = couriers.find(
      (item) => item.id === courierId
    );

    const index = orders.findIndex(
      (order) => order.id === orderId
    );

    if (!courier || index === -1) {
      return undefined;
    }

    const order = orders[index];

    order.courierId = courier.id;
    order.courierName = courier.name;
    order.courierPhone = courier.phone;
    order.status = 'Kurye Atandı';
    order.updatedAt =
      new Date().toISOString();

    orders[index] = order;

    localStorage.setItem(
      STORAGE_KEYS.ORDERS,
      JSON.stringify(orders)
    );

    // Customer notification
    this.addNotification({
      userId: order.customerId,
      orderId: order.id,
      title: 'Kurye Siparişinize Atandı 🛵',
      message:
        `${courier.name} (${courier.phone}) ` +
        'kuryeniz olarak atandı.',
      type: 'assignment',
    });

    // Courier notification
    this.addNotification({
      userId: courier.id,
      orderId: order.id,
      title: 'Yeni Görev Atandı 📦',
      message:
        `${order.pickupAddress} adresinden ` +
        'paket alımı için atandınız.',
      type: 'assignment',
    });

    this.notify();

    return order;
  }

  // =========================================================
  // ORDER PRICE
  // =========================================================

  public updateOrderPrice(
    orderId: string,
    newPrice: number
  ): Order | undefined {
    const orders = this.getOrders();

    const index = orders.findIndex(
      (order) => order.id === orderId
    );

    if (index === -1) return undefined;

    orders[index].price = newPrice;
    orders[index].updatedAt =
      new Date().toISOString();

    localStorage.setItem(
      STORAGE_KEYS.ORDERS,
      JSON.stringify(orders)
    );

    this.notify();

    return orders[index];
  }

  // =========================================================
  // NOTIFICATIONS
  // =========================================================

  public getNotifications(
    userId?: string
  ): NotificationItem[] {
    try {
      const data = localStorage.getItem(
        STORAGE_KEYS.NOTIFICATIONS
      );

      const all: NotificationItem[] =
        data ? JSON.parse(data) : [];

      if (!userId) {
        return all;
      }

      return all.filter(
        (notification) =>
          notification.userId === userId ||
          notification.userId === 'all'
      );
    } catch {
      return [];
    }
  }

  public addNotification(
    item: Omit<
      NotificationItem,
      'id' | 'read' | 'createdAt'
    >
  ): NotificationItem {
    const notifs =
      this.getNotifications();

    const newNotification: NotificationItem = {
      ...item,
      id:
        `notif_${Date.now()}_` +
        Math.random()
          .toString(36)
          .substring(2, 6),

      read: false,

      createdAt:
        new Date().toISOString(),
    };

    notifs.unshift(newNotification);

    localStorage.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      JSON.stringify(notifs)
    );

    this.notify();

    return newNotification;
  }

  public markNotificationAsRead(
    id: string
  ) {
    const notifs =
      this.getNotifications();

    const index = notifs.findIndex(
      (notification) =>
        notification.id === id
    );

    if (index === -1) return;

    notifs[index].read = true;

    localStorage.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      JSON.stringify(notifs)
    );

    this.notify();
  }

  public markAllNotificationsAsRead(
    userId: string
  ) {
    const notifs =
      this.getNotifications();

    notifs.forEach((notification) => {
      if (
        notification.userId === userId ||
        notification.userId === 'all'
      ) {
        notification.read = true;
      }
    });

    localStorage.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      JSON.stringify(notifs)
    );

    this.notify();
  }

  // =========================================================
  // COURIER LOCATIONS
  // =========================================================

  public getCourierLocations(): Record<
    string,
    CourierLocation
  > {
    try {
      const data = localStorage.getItem(
        STORAGE_KEYS.COURIER_LOCATIONS
      );

      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  public getCourierLocation(
    courierId: string
  ): CourierLocation | undefined {
    return this.getCourierLocations()[
      courierId
    ];
  }

  public updateCourierLocation(
    courierId: string,
    latitude: number,
    longitude: number,
    isSharing: boolean = true
  ): CourierLocation {
    const locations =
      this.getCourierLocations();

    const locationData: CourierLocation = {
      courierId,
      latitude,
      longitude,
      updatedAt:
        new Date().toISOString(),
      isSharing,
    };

    locations[courierId] =
      locationData;

    localStorage.setItem(
      STORAGE_KEYS.COURIER_LOCATIONS,
      JSON.stringify(locations)
    );

    this.notify();

    return locationData;
  }

  public stopCourierLocationSharing(
    courierId: string
  ): void {
    const locations =
      this.getCourierLocations();

    if (!locations[courierId]) {
      return;
    }

    locations[courierId].isSharing =
      false;

    locations[courierId].updatedAt =
      new Date().toISOString();

    localStorage.setItem(
      STORAGE_KEYS.COURIER_LOCATIONS,
      JSON.stringify(locations)
    );

    this.notify();
  }

  // =========================================================
  // CURRENT USER
  // =========================================================

  public getCurrentUser(): UserProfile {
    try {
      const data = localStorage.getItem(
        STORAGE_KEYS.CURRENT_USER
      );

      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // fallback
    }

    return SEED_CUSTOMERS[0];
  }

  public setCurrentUser(
    user: UserProfile
  ) {
    localStorage.setItem(
      STORAGE_KEYS.CURRENT_USER,
      JSON.stringify(user)
    );

    this.notify();
  }

  // =========================================================
  // RESET DEMO DATA
  // =========================================================

  public resetDemoData() {
    localStorage.removeItem(
      STORAGE_KEYS.ORDERS
    );

    localStorage.removeItem(
      STORAGE_KEYS.USERS
    );

    localStorage.removeItem(
      STORAGE_KEYS.PRICING
    );

    localStorage.removeItem(
      STORAGE_KEYS.NOTIFICATIONS
    );

    localStorage.removeItem(
      STORAGE_KEYS.COURIER_LOCATIONS
    );

    this.initDataIfEmpty();

    this.notify();
  }
}

export const storage =
  new StorageService();