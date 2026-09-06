import React, { useState } from 'react';
import {
  Bell,
  ChevronDown,
  Shield,
  Smartphone,
  Truck,
  User,
  Zap,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { SEED_ADMIN, SEED_COURIERS, SEED_CUSTOMERS } from '../data/seedData';

interface Props {
  currentUser: UserProfile;
  onSwitchUser: (user: UserProfile) => void;
  unreadNotificationsCount: number;
  onOpenNotifications: () => void;
  isIPhoneMode: boolean;
  onToggleIPhoneMode: () => void;
  activeTab: string;
}

export const Navbar: React.FC<Props> = ({
  currentUser,
  onSwitchUser,
  unreadNotificationsCount,
  onOpenNotifications,
  isIPhoneMode,
  onToggleIPhoneMode,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#D6A84F] bg-[#D6A84F]/10 border border-[#D6A84F]/30 px-2 py-0.5 rounded-full">
            <Shield className="w-3 h-3 text-[#D6A84F]" />
            YÖNETİCİ
          </span>
        );
      case 'courier':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <Truck className="w-3 h-3 text-emerald-400" />
            KURYE
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-full">
            <User className="w-3 h-3 text-sky-400" />
            MÜŞTERİ
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0B0B0D] border-b border-[#303036] px-4 sm:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo - Elegant Dark Theme */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#D6A84F] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(214,168,79,0.3)] shrink-0">
            <span className="text-[#0B0B0D] font-black text-xl font-['Space_Grotesk']">T</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-bold tracking-widest text-[#D6A84F] font-['Space_Grotesk'] leading-tight">
              TRUSTLINE EXPRESS
            </span>
            <span className="text-[10px] text-[#999999] tracking-tighter uppercase font-medium">
              PROFESSIONAL LOGISTICS
            </span>
          </div>
        </div>

        {/* Quick Role Switcher Pills (from Elegant Dark Design) */}
        <div className="hidden lg:flex items-center bg-[#19191E] rounded-full p-1 border border-[#303036]">
          <button
            onClick={() => onSwitchUser(SEED_CUSTOMERS[0])}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              currentUser.role === 'customer'
                ? 'bg-[#D6A84F] text-[#0B0B0D] shadow-[0_0_10px_rgba(214,168,79,0.25)]'
                : 'text-[#999999] hover:text-white'
            }`}
          >
            Müşteri
          </button>
          <button
            onClick={() => onSwitchUser(SEED_COURIERS[0])}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              currentUser.role === 'courier'
                ? 'bg-[#D6A84F] text-[#0B0B0D] shadow-[0_0_10px_rgba(214,168,79,0.25)]'
                : 'text-[#999999] hover:text-white'
            }`}
          >
            Kurye
          </button>
          <button
            onClick={() => onSwitchUser(SEED_ADMIN)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
              currentUser.role === 'admin'
                ? 'bg-[#D6A84F] text-[#0B0B0D] shadow-[0_0_10px_rgba(214,168,79,0.25)]'
                : 'text-[#999999] hover:text-white'
            }`}
          >
            Yönetici
          </button>
        </div>

        {/* Action Controls & Role Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* iPhone Frame Mode Switcher */}
          <button
            onClick={onToggleIPhoneMode}
            title={isIPhoneMode ? 'Geniş Ekran Görünümüne Geç' : 'iPhone Mobil Çerçevesine Geç'}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              isIPhoneMode
                ? 'bg-[#D6A84F]/15 text-[#D6A84F] border-[#D6A84F]/50 shadow-[0_0_10px_rgba(214,168,79,0.15)]'
                : 'bg-[#19191E] text-[#999999] border-[#303036] hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{isIPhoneMode ? 'iPhone Modu' : 'Tam Ekran'}</span>
          </button>

          {/* User Profile & Switcher Button */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2.5 bg-[#19191E] hover:bg-[#222229] border border-[#303036] hover:border-[#D6A84F]/40 px-3 py-1.5 rounded-full transition-all text-xs font-medium text-white cursor-pointer"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold leading-tight truncate max-w-[130px]">
                  {currentUser.name}
                </p>
                <p className="text-[10px] text-[#D6A84F] uppercase font-semibold">
                  {currentUser.role === 'customer'
                    ? 'Premium Müşteri'
                    : currentUser.role === 'courier'
                    ? 'Aktif Kurye'
                    : 'Yönetici'}
                </p>
              </div>

              <div className="w-8 h-8 rounded-full bg-[#222229] border border-[#303036] flex items-center justify-center text-xs font-bold text-[#D6A84F] shrink-0 overflow-hidden">
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                ) : (
                  currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                )}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#999999]" />
            </button>

            {/* Switcher Dropdown Modal */}
            {showRoleMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowRoleMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-[#19191E] border border-[#303036] rounded-2xl shadow-2xl p-2 z-40 text-xs animate-fadeIn">
                  <div className="px-3 py-2 border-b border-[#303036] mb-1">
                    <p className="text-[11px] font-bold text-[#D6A84F] uppercase tracking-wider">
                      Hızlı Rol & Kullanıcı Değiştir
                    </p>
                    <p className="text-[10px] text-[#999999]">
                      3 paneli ve demo verileri doğrudan test edin
                    </p>
                  </div>

                  {/* ADMIN */}
                  <div className="mb-2">
                    <p className="px-3 py-1 text-[10px] font-bold text-[#999999] uppercase">
                      Yönetici
                    </p>
                    <button
                      onClick={() => {
                        onSwitchUser(SEED_ADMIN);
                        setShowRoleMenu(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl transition-colors ${
                        currentUser.id === SEED_ADMIN.id
                          ? 'bg-[#D6A84F]/15 border border-[#D6A84F]/40 text-white'
                          : 'hover:bg-[#222229] text-[#999999] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[#D6A84F]" />
                        <span className="font-semibold">{SEED_ADMIN.name}</span>
                      </div>
                      <span className="text-[10px] text-[#D6A84F]">Admin Paneli</span>
                    </button>
                  </div>

                  {/* COURIERS */}
                  <div className="mb-2">
                    <p className="px-3 py-1 text-[10px] font-bold text-[#999999] uppercase">
                      Kuryeler (5 Kurye)
                    </p>
                    <div className="space-y-1">
                      {SEED_COURIERS.map((courier) => (
                        <button
                          key={courier.id}
                          onClick={() => {
                            onSwitchUser(courier);
                            setShowRoleMenu(false);
                          }}
                          className={`w-full flex items-center justify-between p-1.5 rounded-lg transition-colors ${
                            currentUser.id === courier.id
                              ? 'bg-emerald-500/15 border border-emerald-500/40 text-white'
                              : 'hover:bg-[#222229] text-[#999999] hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Truck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{courier.name}</span>
                          </div>
                          <span className="text-[10px] text-emerald-400 shrink-0 font-mono">
                            {courier.plate}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CUSTOMERS */}
                  <div>
                    <p className="px-3 py-1 text-[10px] font-bold text-[#999999] uppercase">
                      Müşteriler (5 Müşteri)
                    </p>
                    <div className="space-y-1">
                      {SEED_CUSTOMERS.map((cust) => (
                        <button
                          key={cust.id}
                          onClick={() => {
                            onSwitchUser(cust);
                            setShowRoleMenu(false);
                          }}
                          className={`w-full flex items-center justify-between p-1.5 rounded-lg transition-colors ${
                            currentUser.id === cust.id
                              ? 'bg-sky-500/15 border border-sky-500/40 text-white'
                              : 'hover:bg-[#222229] text-[#999999] hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span className="truncate">{cust.name}</span>
                          </div>
                          <span className="text-[10px] text-[#999999] shrink-0 font-mono">
                            {cust.phone}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Notifications Button */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl bg-[#19191E] hover:bg-[#222229] border border-[#303036] text-white transition-colors"
            title="Bildirimler"
          >
            <Bell className="w-4 h-4 text-[#D6A84F]" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D6A84F] text-[#0B0B0D] text-[10px] font-extrabold flex items-center justify-center animate-pulse">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
