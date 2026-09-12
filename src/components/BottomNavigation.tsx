import React from 'react';
import {
  Bot,
  Home,
  Layers,
  Package,
  PlusCircle,
  Truck,
  User,
  Zap,
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';

interface Props {
  role: UserRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenNewOrder: () => void;
  activeOrdersCount?: number;
  isIPhoneMode?: boolean;
}

export const BottomNavigation: React.FC<Props> = ({
  role,
  activeTab,
  onTabChange,
  onOpenNewOrder,
  activeOrdersCount = 0,
  isIPhoneMode = false,
}) => {
  if (role === 'customer') {
    const desktopNavigation = isIPhoneMode
      ? ''
      : 'lg:bottom-auto lg:left-5 lg:right-auto lg:top-24 lg:h-auto lg:w-52 lg:translate-x-0 lg:flex-col lg:items-stretch lg:justify-start lg:gap-1 lg:rounded-2xl lg:border lg:border-[#303036] lg:p-2';

    const desktopItem = isIPhoneMode
      ? ''
      : 'lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-3';

    const desktopLabel = isIPhoneMode
      ? ''
      : 'lg:text-xs lg:normal-case lg:tracking-normal';

    return (
      <nav className={`fixed bottom-0 left-0 right-0 z-40 mx-auto flex h-16 max-w-7xl items-center justify-around border-t border-[#303036] bg-[#19191E] px-2 shadow-2xl ${desktopNavigation}`}>
        {/* 1. Ana Sayfa */}
        <button
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1 transition-all cursor-pointer ${desktopItem} ${
            activeTab === 'home' ? 'text-[#D6A84F]' : 'text-[#999999] hover:text-white'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className={`text-[9px] font-bold uppercase tracking-wider ${desktopLabel}`}>Anasayfa</span>
        </button>

        {/* 2. Kurye Çağır (Highlighted CTA) */}
        <button
          onClick={onOpenNewOrder}
          className={`group -mt-5 flex flex-col items-center gap-1 cursor-pointer ${desktopItem} ${isIPhoneMode ? '' : 'lg:mt-0 lg:rounded-xl lg:bg-[#D6A84F] lg:px-3 lg:py-3'}`}
        >
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D6A84F] text-[#0B0B0D] shadow-lg shadow-[#D6A84F]/30 transition-transform group-hover:scale-105 active:scale-95 ${isIPhoneMode ? '' : 'lg:h-9 lg:w-9 lg:rounded-xl'}`}>
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className={`text-[9px] font-black uppercase tracking-wider text-[#D6A84F] ${desktopLabel} ${isIPhoneMode ? '' : 'lg:text-[#0B0B0D]'}`}>Kurye Çağır</span>
        </button>

        {/* 3. Siparişlerim */}
        <button
          onClick={() => onTabChange('orders')}
          className={`relative flex flex-col items-center gap-1 rounded-xl px-3 py-1 transition-all cursor-pointer ${desktopItem} ${
            activeTab === 'orders' ? 'text-[#D6A84F]' : 'text-[#999999] hover:text-white'
          }`}
        >
          <Package className="w-5 h-5" />
          {activeOrdersCount > 0 && (
            <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-[#D6A84F] animate-pulse" />
          )}
          <span className={`text-[9px] font-bold uppercase tracking-wider ${desktopLabel}`}>Siparişlerim</span>
        </button>

        {/* 4. Trustline AI */}
        <button
          onClick={() => onTabChange('ai')}
          className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1 transition-all cursor-pointer ${desktopItem} ${
            activeTab === 'ai' ? 'text-[#D6A84F]' : 'text-[#999999] hover:text-white'
          }`}
        >
          <Bot className="w-5 h-5" />
          <span className={`text-[9px] font-bold uppercase tracking-wider ${desktopLabel}`}>Trustline AI</span>
        </button>

        {/* 5. Profil */}
        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1 transition-all cursor-pointer ${desktopItem} ${
            activeTab === 'profile' ? 'text-[#D6A84F]' : 'text-[#999999] hover:text-white'
          }`}
        >
          <User className="w-5 h-5" />
          <span className={`text-[9px] font-bold uppercase tracking-wider ${desktopLabel}`}>Profil</span>
        </button>
      </nav>
    );
  }

  // Courier or Admin bottom bar - Elegant Dark
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#19191E] border-t border-[#303036] px-4 h-16 flex items-center justify-around max-w-7xl mx-auto shadow-2xl">
      {role === 'courier' ? (
        <>
          <button
            onClick={() => onTabChange('courier_panel')}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all cursor-pointer ${
              activeTab === 'courier_panel' ? 'text-emerald-400' : 'text-[#999999] hover:text-white'
            }`}
          >
            <Truck className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Görevler</span>
          </button>
          <button
            onClick={() => onTabChange('profile')}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all cursor-pointer ${
              activeTab === 'profile' ? 'text-emerald-400' : 'text-[#999999] hover:text-white'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Profil</span>
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => onTabChange('admin_panel')}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all cursor-pointer ${
              activeTab === 'admin_panel' ? 'text-[#D6A84F]' : 'text-[#999999] hover:text-white'
            }`}
          >
            <Layers className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Yönetim Masası</span>
          </button>
          <button
            onClick={() => onTabChange('profile')}
            className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all cursor-pointer ${
              activeTab === 'profile' ? 'text-[#D6A84F]' : 'text-[#999999] hover:text-white'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Profil</span>
          </button>
        </>
      )}
    </nav>
  );
};
