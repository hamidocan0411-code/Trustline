import React from 'react';
import type { UserProfile } from '../types';

const TRUSTLINE_LOGO =
  'https://i.ibb.co/wZpW2m4v/3-E0-E545-B-ADD8-46-F8-A01-F-83-D5-D61-E6-DA5.png';

interface NavbarProps {
  currentUser: UserProfile;
  onSwitchUser?: () => void;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  isIPhoneMode?: boolean;
  onToggleIPhoneMode?: () => void;
  activeTab?: string;
}

export function Navbar({
  currentUser,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  isIPhoneMode = false,
  onToggleIPhoneMode,
}: NavbarProps) {
  const roleLabel =
    currentUser.role === 'admin'
      ? 'Yönetici'
      : currentUser.role === 'courier'
      ? 'Kurye'
      : 'Müşteri';

  return (
    <header
      className={`sticky top-0 z-40 w-full bg-[#0B0B0D]/95 backdrop-blur-xl border-b border-[#303036] ${
        isIPhoneMode ? 'pt-1' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">

        {/* TRUSTLINE LOGO */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#19191E] border border-[#303036] flex items-center justify-center shrink-0 overflow-hidden shadow-[0_0_20px_rgba(214,168,79,0.15)]">
            <img
              src={TRUSTLINE_LOGO}
              alt="Trustline Express"
              className="w-full h-full object-contain p-1.5"
              loading="eager"
              draggable={false}
            />
          </div>

          <div className="min-w-0">
            <div className="text-white font-black tracking-tight text-sm sm:text-base truncate">
              TRUSTLINE
            </div>

            <div className="text-[#D6A84F] text-[9px] sm:text-[10px] font-bold tracking-[0.18em]">
              EXPRESS
            </div>
          </div>
        </div>

        {/* USER INFO */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden sm:block text-right">
            <div className="text-white text-xs font-semibold truncate max-w-[150px]">
              {currentUser.name}
            </div>

            <div className="text-[#777777] text-[10px]">
              {roleLabel}
            </div>
          </div>

          {/* NOTIFICATIONS */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative w-10 h-10 rounded-xl bg-[#19191E] border border-[#303036] flex items-center justify-center hover:border-[#D6A84F]/50 transition-colors"
            aria-label="Bildirimler"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="text-[#CCCCCC]"
            >
              <path
                d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13.73 21a2 2 0 0 1-3.46 0"
                strokeLinecap="round"
              />
            </svg>

            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D6A84F] text-[#0B0B0D] text-[9px] font-black flex items-center justify-center border-2 border-[#0B0B0D]">
                {unreadNotificationsCount > 99
                  ? '99+'
                  : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* IPHONE MODE */}
          {onToggleIPhoneMode && (
            <button
              type="button"
              onClick={onToggleIPhoneMode}
              className="hidden sm:flex w-10 h-10 rounded-xl bg-[#19191E] border border-[#303036] items-center justify-center hover:border-[#D6A84F]/50 transition-colors"
              aria-label={
                isIPhoneMode
                  ? 'iPhone görünümünü kapat'
                  : 'iPhone görünümünü aç'
              }
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect
                  x="7"
                  y="2"
                  width="10"
                  height="20"
                  rx="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M11 18h2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}

          {/* AVATAR */}
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#19191E] border border-[#303036] flex items-center justify-center shrink-0">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[#D6A84F] font-black text-sm">
                {currentUser.name
                  ?.trim()
                  ?.charAt(0)
                  ?.toUpperCase() || 'T'}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;