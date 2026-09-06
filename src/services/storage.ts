import {
  Order,
  OrderStatus,
  PricingConfig,
  UserProfile,
  NotificationItem,
  CourierAvailability,
  CourierLocation,
  DeliveryProof,
} from '../types';
import { DEFAULT_PRICING } from '../utils/pricing';
import { SEED_ADMIN, SEED_COURIERS, SEED_CUSTOMERS, SEED_ORDERS } from '../data/seedData';
import {
  db,
  ensureFirebaseAuth,
  seedFirestoreIfEmpty,
} from './firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
} from 'firebase/firestore';

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
  private isFirestoreSynced: boolean = false;

  constructor() {
    this.initDataIfEmpty();
    this.initFirestoreSync();
  }

  private initDataIfEmpty() {
    try {
      if (!localStorage.getItem(STORAGE_KEYS.PRICING)) {
        localStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(DEFAULT_PRICING));
      }

      if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
        const allUsers: UserProfile[] = [
          SEED_ADMIN,
          ...SEED_COURIERS,
          ...SEED_CUSTOMERS,
        ];
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(allUsers));
      }

      if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(SEED_ORDERS));
      }

      if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
        const initialNotifications: NotificationItem[] = [
          {
            id: 'notif-1',
            userId: 'cust_1',
            orderId: 'TL-8941',
            title: 'Siparişiniz Yolda 🛵',
            message: 'Kuryeniz Maslak istikametinde teslimat adresine doğru ilerliyor.',
            type: 'order_status',
            read: false,
            createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          },
          {
            id: 'notif-2',
            userId: 'cust_2',
            orderId: 'TL-8942',
            title: 'Paket Kurye Tarafından Alındı 📦',
            message: 'Kurye Murat Öztürk paketinizi teslim aldı.',
            type: 'order_status',
            read: false,
            createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          },
        ];
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(initialNotifications));
      }

      if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(SEED_CUSTOMERS[0]));
      }
    } catch (e) {
      console.error('Failed to initialize local data', e);
    }
  }

  // FIREBASE REAL-TIME SYNC
  private async initFirestoreSync() {
    try {
      await ensureFirebaseAuth();
      await seedFirestoreIfEmpty();
      this.isFirestoreSynced = true;

      // 1. Sync Orders in real-time
      const ordersCol = collection(db, 'orders');
      onSnapshot(
        ordersCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const firestoreOrders: Order[] = [];
            snapshot.forEach((docSnap) => {
              firestoreOrders.push(docSnap.data() as Order);
            });
            // Sort by createdAt descending
            firestoreOrders.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(firestoreOrders));
            this.notify();
          }
        },
        (error) => {
          console.warn('Firestore orders sync subscription notice:', error.message);
        }
      );

      // 2. Sync Pricing in real-time
      const pricingRef = doc(db, 'pricing', 'current');
      onSnapshot(
        pricingRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const pData = docSnap.data() as PricingConfig;
            localStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(pData));
            this.notify();
          }
        },
        (error) => {
          console.warn('Firestore pricing sync notice:', error.message);
        }
      );

      // 3. Sync Users in real-time
      const usersCol = collection(db, 'users');
      onSnapshot(
        usersCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const firestoreUsers: UserProfile[] = [];
            snapshot.forEach((docSnap) => {
              firestoreUsers.push(docSnap.data() as UserProfile);
            });
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(firestoreUsers));
            this.notify();
          }
        },
        (error) => {
          console.warn('Firestore users sync notice:', error.message);
        }
      );

      // 4. Sync Notifications in real-time
      const notifsCol = collection(db, 'notifications');
      onSnapshot(
        notifsCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const firestoreNotifs: NotificationItem[] = [];
            snapshot.forEach((docSnap) => {
              firestoreNotifs.push(docSnap.data() as NotificationItem);
            });
            firestoreNotifs.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(firestoreNotifs));
            this.notify();
          }
        },
        (error) => {
          console.warn('Firestore notifications sync notice:', error.message);
        }
      );

      // 5. Sync Courier Locations in real-time
      const locationsCol = collection(db, 'courierLocations');
      onSnapshot(
        locationsCol,
        (snapshot) => {
          if (!snapshot.empty) {
            const locMap: Record<string, CourierLocation> = {};
            snapshot.forEach((docSnap) => {
              locMap[docSnap.id] = docSnap.data() as CourierLocation;
            });
            localStorage.setItem(STORAGE_KEYS.COURIER_LOCATIONS, JSON.stringify(locMap));
            this.notify();
          }
        },
        (error) => {
          console.warn('Firestore courier locations sync notice:', error.message);
        }
      );
    } catch (err) {
      console.warn('Firebase initialization in storage service:', err);
    }
  }

  public subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  // PRICING
  public getPricing(): PricingConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRICING);
      return data ? JSON.parse(data) : DEFAULT_PRICING;
    } catch {
      return DEFAULT_PRICING;
    }
  }

  public updatePricing(config: Partial<PricingConfig>): PricingConfig {
    const current = this.getPricing();
    const updated: PricingConfig = {
      ...current,
      ...config,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(updated));
    this.notify();

    // Persist to Firestore
    setDoc(doc(db, 'pricing', 'current'), updated, { merge: true }).catch((err) => {
      console.warn('Failed to sync pricing to Firestore:', err);
    });

    return updated;
  }

  // USERS
  public getUsers(): UserProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [SEED_ADMIN, ...SEED_COURIERS, ...SEED_CUSTOMERS];
    } catch {
      return [SEED_ADMIN, ...SEED_COURIERS, ...SEED_CUSTOMERS];
    }
  }

  public getCouriers(): UserProfile[] {
    return this.getUsers().filter((u) => u.role === 'courier');
  }

  public getCustomers(): UserProfile[] {
    return this.getUsers().filter((u) => u.role === 'customer');
  }

  public addCourier(courierData: Omit<UserProfile, 'id' | 'role' | 'createdAt'>): UserProfile {
    const users = this.getUsers();
    const newCourier: UserProfile = {
      ...courierData,
      id: `cour_${Date.now()}`,
      role: 'courier',
      totalDeliveries: 0,
      rating: 5.0,
      courierStatus: courierData.courierStatus || 'Müsait',
      createdAt: new Date().toISOString(),
    };
    users.push(newCourier);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.notify();

    // Persist to Firestore
    setDoc(doc(db, 'users', newCourier.id), newCourier).catch((err) => {
      console.warn('Failed to save courier to Firestore:', err);
    });

    return newCourier;
  }

  public updateCourierStatus(courierId: string, status: CourierAvailability) {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === courierId);
    if (index !== -1) {
      users[index].courierStatus = status;
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      this.notify();

      // Persist to Firestore
      updateDoc(doc(db, 'users', courierId), { courierStatus: status }).catch((err) => {
        console.warn('Failed to update courier status in Firestore:', err);
      });
    }
  }

  // ORDERS
  public getOrders(): Order[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      if (!data) return SEED_ORDERS;
      const parsed: Order[] = JSON.parse(data);
      const tl8948 = parsed.find((o) => o.id === 'TL-8948');
      if (tl8948 && !tl8948.deliveryProof) {
        const seed8948 = SEED_ORDERS.find((o) => o.id === 'TL-8948');
        if (seed8948) {
          Object.assign(tl8948, seed8948);
          localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(parsed));
        }
      }
      return parsed;
    } catch {
      return SEED_ORDERS;
    }
  }

  public getOrderById(id: string): Order | undefined {
    return this.getOrders().find((o) => o.id === id);
  }

  public createOrder(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Order {
    const orders = this.getOrders();
    const newOrder: Order = {
      ...orderData,
      id: `TL-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orders.unshift(newOrder);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

    // Send notification
    this.addNotification({
      userId: newOrder.customerId,
      orderId: newOrder.id,
      title: 'Siparişiniz Alındı',
      message: `${newOrder.id} numaralı siparişiniz oluşturuldu. En yakın kurye atanıyor.`,
      type: 'order_status',
    });

    this.notify();

    // Persist directly to Firestore
    setDoc(doc(db, 'orders', newOrder.id), newOrder).catch((err) => {
      console.warn('Failed to sync new order to Firestore:', err);
    });

    return newOrder;
  }

  public updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Order | undefined {
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) return undefined;

    const order = orders[index];
    order.status = status;
    order.updatedAt = new Date().toISOString();
    if (note) order.note = note;

    orders[index] = order;
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

    // Automated descriptive notifications based on status
    const notifMessages: Record<OrderStatus, string> = {
      'Kurye Bekleniyor': 'Siparişiniz için kurye aranıyor.',
      'Kurye Atandı': `Siparişinize kurye ${order.courierName || ''} atandı.`,
      'Kurye Kabul Etti': `Kurye ${order.courierName || ''} siparişinizi kabul etti ve teslimat için harekete geçti.`,
      'Paket Alındı': 'Paketiniz kurye tarafından teslim alındı, adrese yola çıkıyor.',
      'Teslimatta': 'Paketiniz şu anda teslimat adresine doğru taşınıyor.',
      'Teslim Edildi': 'Paketiniz başarıyla teslim edildi. Trustline Express\'i tercih ettiğiniz için teşekkür ederiz.',
      'İptal Edildi': 'Siparişiniz iptal edildi.',
    };

    this.addNotification({
      userId: order.customerId,
      orderId: order.id,
      title: `Sipariş Durumu: ${status}`,
      message: notifMessages[status] || `Sipariş durumu güncellendi: ${status}`,
      type: 'order_status',
    });

    this.notify();

    // Persist to Firestore
    const updatePayload: Record<string, any> = {
      status,
      updatedAt: order.updatedAt,
    };
    if (note) updatePayload.note = note;

    updateDoc(doc(db, 'orders', orderId), updatePayload).catch((err) => {
      console.warn('Failed to update order status in Firestore:', err);
    });

    return order;
  }

  /**
   * Completes order with full delivery proof:
   * - Sets status to 'Teslim Edildi'
   * - Records deliveredAt timestamp
   * - Saves receiverName, deliveryNote, deliveryPhoto, and signature
   * - Updates courier delivery stats
   * - Sends push/in-app notification to customer
   * - Syncs to Firestore with full proof data
   */
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
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) return undefined;

    const deliveredAt = new Date().toISOString();
    const order = orders[index];
    order.status = 'Teslim Edildi';
    order.updatedAt = deliveredAt;
    order.deliveredAt = deliveredAt;
    order.receiverName = proof.receiverName.trim();
    order.deliveryNote = proof.deliveryNote?.trim() || '';
    order.deliveryPhoto = proof.deliveryPhoto || '';
    order.signature = proof.signature;
    order.deliveryProof = {
      receiverName: proof.receiverName.trim(),
      deliveryNote: proof.deliveryNote?.trim() || '',
      deliveryPhoto: proof.deliveryPhoto || '',
      signature: proof.signature,
      deliveredAt,
    };

    orders[index] = order;
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

    // Update courier delivery statistics
    if (order.courierId) {
      const users = this.getUsers();
      const courIdx = users.findIndex((u) => u.id === order.courierId);
      if (courIdx !== -1) {
        users[courIdx].totalDeliveries = (users[courIdx].totalDeliveries || 0) + 1;
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        updateDoc(doc(db, 'users', order.courierId), {
          totalDeliveries: users[courIdx].totalDeliveries,
        }).catch((err) => {
          console.warn('Failed to update courier stats in Firestore:', err);
        });
      }
    }

    // Add in-app notification to customer
    this.addNotification({
      userId: order.customerId,
      orderId: order.id,
      title: 'Siparişiniz Teslim Edildi 🎁',
      message: `${order.id} numaralı paketiniz ${proof.receiverName || 'alıcıya'} teslim edildi. Teslimat kanıtını sipariş detayından inceleyebilirsiniz.`,
      type: 'order_status',
    });

    this.notify();

    // Persist full proof payload to Firestore
    const updatePayload = {
      status: 'Teslim Edildi',
      updatedAt: deliveredAt,
      deliveredAt,
      receiverName: order.receiverName,
      deliveryNote: order.deliveryNote,
      deliveryPhoto: order.deliveryPhoto,
      signature: order.signature,
      deliveryProof: order.deliveryProof,
    };

    updateDoc(doc(db, 'orders', orderId), updatePayload).catch((err) => {
      console.warn('Failed to persist delivery proof in Firestore:', err);
    });

    return order;
  }

  public assignCourier(orderId: string, courierId: string): Order | undefined {
    const orders = this.getOrders();
    const couriers = this.getCouriers();
    const courier = couriers.find((c) => c.id === courierId);
    const index = orders.findIndex((o) => o.id === orderId);

    if (index === -1 || !courier) return undefined;

    orders[index].courierId = courier.id;
    orders[index].courierName = courier.name;
    orders[index].courierPhone = courier.phone;
    orders[index].status = 'Kurye Atandı';
    orders[index].updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));

    // Notify customer
    this.addNotification({
      userId: orders[index].customerId,
      orderId: orders[index].id,
      title: 'Kurye Siparişinize Atandı 🛵',
      message: `${courier.name} (${courier.phone}) kuryeniz olarak atandı.`,
      type: 'assignment',
    });

    // Notify courier
    this.addNotification({
      userId: courier.id,
      orderId: orders[index].id,
      title: 'Yeni Görev Atandı 📦',
      message: `${orders[index].pickupAddress} adresinden paket alımı için atandınız.`,
      type: 'assignment',
    });

    this.notify();

    // Persist to Firestore
    updateDoc(doc(db, 'orders', orderId), {
      courierId: courier.id,
      courierName: courier.name,
      courierPhone: courier.phone,
      status: 'Kurye Atandı',
      updatedAt: orders[index].updatedAt,
    }).catch((err) => {
      console.warn('Failed to assign courier in Firestore:', err);
    });

    return orders[index];
  }

  public updateOrderPrice(orderId: string, newPrice: number): Order | undefined {
    const orders = this.getOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index === -1) return undefined;

    orders[index].price = newPrice;
    orders[index].updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    this.notify();

    // Persist to Firestore
    updateDoc(doc(db, 'orders', orderId), {
      price: newPrice,
      updatedAt: orders[index].updatedAt,
    }).catch((err) => {
      console.warn('Failed to update order price in Firestore:', err);
    });

    return orders[index];
  }

  // NOTIFICATIONS
  public getNotifications(userId?: string): NotificationItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const all: NotificationItem[] = data ? JSON.parse(data) : [];
      if (!userId) return all;
      return all.filter((n) => n.userId === userId || n.userId === 'all');
    } catch {
      return [];
    }
  }

  public addNotification(item: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>): NotificationItem {
    const notifs = this.getNotifications();
    const newNotif: NotificationItem = {
      ...item,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    notifs.unshift(newNotif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    this.notify();

    // Persist to Firestore
    setDoc(doc(db, 'notifications', newNotif.id), newNotif).catch((err) => {
      console.warn('Failed to save notification to Firestore:', err);
    });

    return newNotif;
  }

  public markNotificationAsRead(id: string) {
    const notifs = this.getNotifications();
    const index = notifs.findIndex((n) => n.id === id);
    if (index !== -1) {
      notifs[index].read = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
      this.notify();

      // Persist to Firestore
      updateDoc(doc(db, 'notifications', id), { read: true }).catch((err) => {
        console.warn('Failed to mark notification read in Firestore:', err);
      });
    }
  }

  public markAllNotificationsAsRead(userId: string) {
    const notifs = this.getNotifications();
    notifs.forEach((n) => {
      if (n.userId === userId || n.userId === 'all') {
        n.read = true;
        updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {});
      }
    });
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    this.notify();
  }

  // COURIER LOCATIONS
  public getCourierLocations(): Record<string, CourierLocation> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COURIER_LOCATIONS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  public getCourierLocation(courierId: string): CourierLocation | undefined {
    return this.getCourierLocations()[courierId];
  }

  public updateCourierLocation(
    courierId: string,
    latitude: number,
    longitude: number,
    isSharing: boolean = true
  ): CourierLocation {
    const locations = this.getCourierLocations();
    const locationData: CourierLocation = {
      courierId,
      latitude,
      longitude,
      updatedAt: new Date().toISOString(),
      isSharing,
    };
    locations[courierId] = locationData;
    localStorage.setItem(STORAGE_KEYS.COURIER_LOCATIONS, JSON.stringify(locations));
    this.notify();

    // Persist to Firestore
    setDoc(doc(db, 'courierLocations', courierId), locationData, { merge: true }).catch((err) => {
      console.warn('Failed to update courier location in Firestore:', err);
    });

    return locationData;
  }

  public stopCourierLocationSharing(courierId: string): void {
    const locations = this.getCourierLocations();
    if (locations[courierId]) {
      locations[courierId].isSharing = false;
      locations[courierId].updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.COURIER_LOCATIONS, JSON.stringify(locations));
      this.notify();

      setDoc(
        doc(db, 'courierLocations', courierId),
        { isSharing: false, updatedAt: new Date().toISOString() },
        { merge: true }
      ).catch((err) => {
        console.warn('Failed to stop courier location sharing in Firestore:', err);
      });
    }
  }

  // AUTH STATE
  public getCurrentUser(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (data) return JSON.parse(data);
    } catch {
      // fallback
    }
    return SEED_CUSTOMERS[0];
  }

  public setCurrentUser(user: UserProfile) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    this.notify();
  }

  public resetDemoData() {
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.PRICING);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.COURIER_LOCATIONS);
    this.initDataIfEmpty();
    this.notify();
  }
}

export const storage = new StorageService();
