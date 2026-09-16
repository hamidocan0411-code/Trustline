import React, {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";

import { storage } from "./services/storage";

import {
  subscribeToAuth,
  handleGoogleRedirectResult,
  ensureUserProfile,
} from "./services/auth";

import { auth } from "./services/firebase";
import { signOut } from "firebase/auth";

import type {
  NotificationItem,
  Order,
  PricingConfig,
  UserProfile,
} from "./types";

const Navbar = lazy(() => import("./components/Navbar").then((m) => ({ default: m.Navbar })));
const BottomNavigation = lazy(() => import("./components/BottomNavigation").then((m) => ({ default: m.BottomNavigation })));
const CustomerHome = lazy(() => import("./components/CustomerHome").then((m) => ({ default: m.CustomerHome })));
const CustomerOrders = lazy(() => import("./components/CustomerOrders").then((m) => ({ default: m.CustomerOrders })));
const TrustlineAI = lazy(() => import("./components/TrustlineAI").then((m) => ({ default: m.TrustlineAI })));
const CourierPanel = lazy(() => import("./components/CourierPanel").then((m) => ({ default: m.CourierPanel })));
const AdminPanel = lazy(() => import("./components/AdminPanel").then((m) => ({ default: m.AdminPanel })));
const ProfileView = lazy(() => import("./components/ProfileView").then((m) => ({ default: m.ProfileView })));
const NewOrderModal = lazy(() => import("./components/NewOrderModal").then((m) => ({ default: m.NewOrderModal })));
const PharmacyOrderPanel = lazy(() => import("./components/PharmacyOrderPanel").then((m) => ({ default: m.PharmacyOrderPanel })));
const NotificationDrawer = lazy(() => import("./components/NotificationDrawer").then((m) => ({ default: m.NotificationDrawer })));
const AuthScreen = lazy(() => import("./components/AuthScreen").then((m) => ({ default: m.AuthScreen })));
const LiveSupport = lazy(() => import("./components/LiveSupport").then((m) => ({ default: m.LiveSupport })));

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const savedOrders = storage.getOrders();
      return Array.isArray(savedOrders) ? savedOrders : [];
    } catch (error) {
      console.error("Orders yüklenemedi:", error);
      return [];
    }
  });
  const [pricing, setPricing] = useState<PricingConfig>(() => {
    try {
      return storage.getPricing();
    } catch (error) {
      console.error("Pricing yüklenemedi:", error);
      return {
        perKmPrice: 20,
        minPrice: 100,
        urgentMultiplier: 1.5,
        vipMultiplier: 2,
        requireDeliveryPhoto: false,
        updatedAt: new Date().toISOString(),
      };
    }
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isPharmacyOrderOpen, setIsPharmacyOrderOpen] = useState(false);
  const [newOrderPrefill, setNewOrderPrefill] = useState<Partial<Order> | undefined>();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isIPhoneMode, setIsIPhoneMode] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [inactiveAccount, setInactiveAccount] = useState(false);
  const authResolved = useRef(false);
  const authStateResolved = useRef(false);