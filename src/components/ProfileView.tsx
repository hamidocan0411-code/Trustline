import React, { useState } from 'react';
import type { UserProfile } from '../types';
import { logoutUser } from '../services/auth';

interface ProfileViewProps {
  currentUser: UserProfile;
  onSwitchUser?: () => void;
}

export function ProfileView({
  currentUser,
}: ProfileViewProps) {
  const [loggingOut, setLoggingOut] =
    useState(false);

  const [error, setError] =
    useState('');

  const handleLogout = async () => {
    if (loggingOut) return;

    setError('');
    setLoggingOut(true);

    try {
      await logoutUser();
    } catch (err) {
      console.error(
        'Çıkış yapılamadı:',
        err
      );

      setError(
        'Çıkış yapılırken bir hata oluştu. Lütfen tekrar deneyin.'
      );

      setLoggingOut(false);
    }
  };

  const roleLabel =
    currentUser.role === 'admin'
      ? 'Yönetici'
      : currentUser.role === 'courier'
      ? 'Kurye'
      : 'Müşteri';

  const initial =
    currentUser.name
      ?.trim()
      ?.charAt(0)
      ?.toUpperCase() || 'T';

  return (
    <div className="w-full max-w-3xl mx-auto pb-24">

      {/* HEADER */}
      <div className="mb-6">
        <p className="text-[#D6A84F] text-xs font-bold tracking-[0.2em] uppercase">
          Hesabım
        </p>

        <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
          Profil
        </h1>

        <p className="text-[#777777] text-sm mt-2">
          Trustline Express hesabınızı yönetin.
        </p>
      </div>

      {/* PROFILE CARD */}
      <div className="bg-[#19191E] border border-[#303036] rounded-3xl p-5 sm:p-6">

        <div className="flex items-center gap-4">

          {/* AVATAR */}
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#222229] border border-[#3A3A42] flex items-center justify-center shrink-0">

            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[#D6A84F] font-black text-2xl">
                {initial}
              </span>
            )}

          </div>

          {/* NAME */}
          <div className="min-w-0">
            <h2 className="text-white font-black text-lg truncate">
              {currentUser.name}
            </h2>

            <p className="text-[#888888] text-sm truncate">
              {currentUser.email}
            </p>

            <div className="inline-flex mt-2 px-2.5 py-1 rounded-full bg-[#D6A84F]/10 border border-[#D6A84F]/20">
              <span className="text-[#D6A84F] text-[10px] font-bold">
                {roleLabel}
              </span>
            </div>
          </div>

        </div>

        {/* USER INFORMATION */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">

          <div className="rounded-2xl bg-[#222229] border border-[#303036] p-4">
            <p className="text-[#666666] text-[10px] uppercase tracking-wider">
              Ad Soyad
            </p>

            <p className="text-white text-sm font-semibold mt-1">
              {currentUser.name || '-'}
            </p>
          </div>

          <div className="rounded-2xl bg-[#222229] border border-[#303036] p-4">
            <p className="text-[#666666] text-[10px] uppercase tracking-wider">
              Telefon
            </p>

            <p className="text-white text-sm font-semibold mt-1">
              {currentUser.phone || '-'}
            </p>
          </div>

          <div className="rounded-2xl bg-[#222229] border border-[#303036] p-4">
            <p className="text-[#666666] text-[10px] uppercase tracking-wider">
              E-posta
            </p>

            <p className="text-white text-sm font-semibold mt-1 break-all">
              {currentUser.email || '-'}
            </p>
          </div>

          <div className="rounded-2xl bg-[#222229] border border-[#303036] p-4">
            <p className="text-[#666666] text-[10px] uppercase tracking-wider">
              Hesap Türü
            </p>

            <p className="text-white text-sm font-semibold mt-1">
              {roleLabel}
            </p>
          </div>

        </div>

        {/* COURIER INFORMATION */}
        {currentUser.role === 'courier' && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">

            <div className="rounded-2xl bg-[#222229] border border-[#303036] p-4">
              <p className="text-[#666666] text-[10px] uppercase tracking-wider">
                Araç
              </p>

              <p className="text-white text-sm font-semibold mt-1">
                {currentUser.vehicle || '-'}
              </p>
            </div>

            <div className="rounded-2xl bg-[#222229] border border-[#303036] p-4">
              <p className="text-[#666666] text-[10px] uppercase tracking-wider">
                Plaka
              </p>

              <p className="text-white text-sm font-semibold mt-1">
                {currentUser.plate || '-'}
              </p>
            </div>

          </div>
        )}

        {/* COURIER STATS */}
        {currentUser.role === 'courier' && (
          <div className="mt-3 grid grid-cols-2 gap-3">

            <div className="rounded-2xl bg-[#222229] border border-[#303036] p-4 text-center">
              <p className="text-[#D6A84F] text-xl font-black">
                {currentUser.totalDeliveries ?? 0}
              </p>

              <p className="text-[#666666] text-[10px] mt-1">
                Teslimat
              </p>
            </div>

            <div className="rounded-2xl bg-[#222229] border border-[#303036] p-4 text-center">
              <p className="text-[#D6A84F] text-xl font-black">
                {currentUser.rating
                  ? currentUser.rating.toFixed(1)
                  : '0.0'}
              </p>

              <p className="text-[#666666] text-[10px] mt-1">
                Puan
              </p>
            </div>

          </div>
        )}

        {/* ACCOUNT ID */}
        <div className="mt-3 rounded-2xl bg-[#222229] border border-[#303036] p-4">
          <p className="text-[#666666] text-[10px] uppercase tracking-wider">
            Hesap ID
          </p>

          <p className="text-[#999999] text-xs font-mono mt-1 break-all">
            {currentUser.id}
          </p>
        </div>

      </div>

      {/* ERROR */}
      {error && (
        <div className="mt-4 rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-red-300 text-sm">
            {error}
          </p>
        </div>
      )}

      {/* ACCOUNT ACTIONS */}
      <div className="mt-5 bg-[#19191E] border border-[#303036] rounded-3xl p-5">

        <h3 className="text-white font-bold text-sm">
          Hesap İşlemleri
        </h3>

        <p className="text-[#777777] text-xs mt-1">
          Bu cihazdaki Trustline Express oturumunuzu yönetin.
        </p>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full mt-5 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 text-red-300 font-bold text-sm py-4 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loggingOut
            ? 'Çıkış yapılıyor...'
            : 'Çıkış Yap'}
        </button>

      </div>

      {/* V1 INFO */}
      <div className="mt-4 text-center">
        <p className="text-[#555555] text-[10px]">
          Trustline Express V1
        </p>
      </div>

    </div>
  );
}

export default ProfileView;