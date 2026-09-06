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
}

export const BottomNavigation: React.FC<Props> = ({
  role,
  activeTab,
  onTabChange,
  onOpenNewOrder,
  activeOrdersCount = 0,
}) => {
  if (role === 'customer') {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#19191E] border-t border-[#303036] px-2 h-16 flex items-center justify-around max-w-7xl mx-auto shadow-2xl">
        {/* 1. Ana Sayfa */}
        <button
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'home' ? 'text-[#D6A84F]' : 'text-[#999999] hover:text-white'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Anasayfa</span>
        </button>

        {/* 2. Kurye Çağır (Highlighted CTA) */}
        <button
          onClick={onOpenNewOrder}
          className="flex flex-col items-center gap-1 -mt-5 cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#D6A84F] text-[#0B0B0D] flex items-center justify-center shadow-lg shadow-[#D6A84F]/30 group-hover:scale-105 active:scale-95 transition-transform">
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className="text-[9px] font-black uppercase text-[#D6A84F] tracking-wider">Kurye Çağır</span>
        </button>

        {/* 3. Siparişlerim */}
        <button
          onClick={() => onTabChange('orders')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'orders' ? 'text-[#D6A84F]' : 'text-[#999999] hover:text-white'
          }`}
        >
          <Package className="w-5 h-5" />
          {activeOrdersCount > 0 && (
            <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-[#D6A84F] animate-pulse" />
          )}
          <span className="text-[9px] font-bold uppercase tracking-wider">Siparişlerim</span>
        </button>

        {/* 4. Trustline AI */}
        <button
          onClick={() => onTabChange('ai')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'ai' ? 'text-[#D6A84F]' : 'text-[#999999] hover:text-white'
          }`}
        >
          <Bot className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Trustline AI</span>
        </button>

        {/* 5. Profil */}
        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'profile' ? 'text-[#D6A84F]' : 'text-[#999999] hover:text-white'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Profil</span>
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
