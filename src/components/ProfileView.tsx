import React, { useEffect, useState } from 'react';
import { Check, Edit3, Loader2, Save, X } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import type { UserProfile } from '../types';
import { logoutUser } from '../services/auth';
import { auth } from '../services/firebase';
import { storage } from '../services/storage';

interface ProfileViewProps {
  currentUser: UserProfile;
  onSwitchUser?: () => void;
  onProfileUpdated?: (profile: UserProfile) => void;
}

export function ProfileView({
  currentUser,
  onProfileUpdated,
}: ProfileViewProps) {
  const [loggingOut, setLoggingOut] =
    useState(false);

  const [error, setError] =
    useState('');

  const [editing, setEditing] =
    useState(false);

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [profileMessage, setProfileMessage] =
    useState('');

  const [name, setName] = useState(currentUser.name || '');

  const [phone, setPhone] = useState(currentUser.phone || '');

  useEffect(() => {
    setName(currentUser.name || '');
    setPhone(currentUser.phone || '');
  }, [currentUser.id, currentUser.name, currentUser.phone]);

  const saveProfile = async () => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setProfileMessage('Lütfen ad soyad bilgisini girin.');
      return;
    }

    try {
      setSavingProfile(true);
      setProfileMessage('');

      await storage.updateUser(currentUser.id, {
        name: cleanName,
        phone: cleanPhone,
      });

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: cleanName,
        });
      }

      onProfileUpdated?.({
        ...currentUser,
        name: cleanName,
        phone: cleanPhone,
      });

      setEditing(false);
      setProfileMessage('Profil bilgileriniz kaydedildi.');
    } catch (saveError) {
      console.error('Profil güncellenemedi:', saveError);
      setProfileMessage('Profil kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSavingProfile(false);
    }
  };

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

        {currentUser.role === 'customer' && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D6A84F]/20 bg-[#D6A84F]/5 p-4">
            <div>
              <p className="text-sm font-black text-white">Profil bilgilerini güncel tutun</p>
              <p className="mt-1 text-xs leading-5 text-[#999999]">Kurye ve operasyon ekibi, siparişlerde bu iletişim bilgilerini kullanır.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setProfileMessage('');
                setEditing((value) => !value);
              }}
              className="flex items-center gap-2 rounded-xl border border-[#D6A84F]/30 bg-[#19191E] px-4 py-2.5 text-xs font-bold text-[#D6A84F]"
            >
              {editing ? <X size={15} /> : <Edit3 size={15} />}
              {editing ? 'Vazgeç' : 'Bilgileri Düzenle'}
            </button>
          </div>
        )}

        {editing && currentUser.role === 'customer' && (
          <div className="mt-4 space-y-4 rounded-2xl border border-[#303036] bg-[#111116] p-4">
            <div>
              <label className="mb-2 block text-xs font-semibold text-[#999999]">Ad soyad</label>
              <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-[#303036] bg-[#0B0B0D] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold text-[#999999]">Telefon</label>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="05XX XXX XX XX" className="w-full rounded-xl border border-[#303036] bg-[#0B0B0D] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]" />
            </div>
            <button type="button" disabled={savingProfile} onClick={saveProfile} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D6A84F] py-3 text-sm font-black text-[#0B0B0D] disabled:opacity-50">
              {savingProfile ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              {savingProfile ? 'Kaydediliyor...' : 'Profilimi Kaydet'}
            </button>
          </div>
        )}

        {profileMessage && (
          <div className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs ${profileMessage.includes('kaydedildi') ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
            <Check size={15} />
            {profileMessage}
          </div>
        )}

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
