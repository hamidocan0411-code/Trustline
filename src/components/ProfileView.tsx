import React from 'react';
import {
  Award,
  CheckCircle2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Shield,
  Star,
  Truck,
  User,
  Zap,
} from 'lucide-react';
import { UserProfile } from '../types';
import { SEED_ADMIN, SEED_COURIERS, SEED_CUSTOMERS } from '../data/seedData';

interface Props {
  currentUser: UserProfile;
  onSwitchUser: (user: UserProfile) => void;
}

export const ProfileView: React.FC<Props> = ({ currentUser, onSwitchUser }) => {
  return (
    <div className="space-y-5 pb-20 max-w-2xl mx-auto animate-fadeIn">
      {/* Profile Card */}
      <div className="bg-[#19191E] border border-[#303036] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <div className="w-20 h-20 rounded-3xl bg-[#222229] border-2 border-[#D6A84F] p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-lg shadow-[#D6A84F]/10">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <User className="w-10 h-10 text-[#D6A84F]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-black text-white font-['Space_Grotesk']">
                {currentUser.name}
              </h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#D6A84F]/15 border border-[#D6A84F]/40 text-[#D6A84F] uppercase">
                {currentUser.role === 'customer'
                  ? 'Müşteri Hesabı'
                  : currentUser.role === 'courier'
                  ? 'Kurye Hesabı'
                  : 'Sistem Yöneticisi'}
              </span>
            </div>

            <p className="text-xs text-[#999999] mt-1">
              Trustline Express Onaylı Kullanıcı Profili
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-xs text-slate-300">
              <div className="flex items-center justify-center sm:justify-start gap-2 bg-[#222229] p-2.5 rounded-xl border border-[#303036]/60">
                <Phone className="w-3.5 h-3.5 text-[#D6A84F]" />
                <span className="font-mono">{currentUser.phone}</span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2 bg-[#222229] p-2.5 rounded-xl border border-[#303036]/60">
                <Mail className="w-3.5 h-3.5 text-sky-400" />
                <span className="truncate">{currentUser.email}</span>
              </div>
            </div>

            {currentUser.role === 'courier' && (
              <div className="mt-3 bg-[#0B0B0D] p-3 rounded-xl border border-[#303036] flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-[#999999] block">Araç ve Plaka</span>
                  <span className="text-white font-bold">{currentUser.vehicle || 'Motosiklet'}</span>
                </div>
                <span className="text-[#D6A84F] font-mono font-bold">{currentUser.plate}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Account Switching (For immediate demo and QA testing) */}
      <div className="bg-[#19191E] border border-[#303036] rounded-3xl p-5 shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white">Örnek Demo Hesaplar Arası Geçiş</h3>
          <p className="text-xs text-[#999999] mt-0.5">
            Müşteri, Kurye veya Admin rollerini doğrudan deneyimlemek için aşağıdaki hesaplardan birini seçebilirsiniz.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold text-[#D6A84F] uppercase tracking-wider">
            Yönetici (Admin)
          </p>
          <button
            onClick={() => onSwitchUser(SEED_ADMIN)}
            className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-colors ${
              currentUser.id === SEED_ADMIN.id
                ? 'bg-[#D6A84F]/15 border-[#D6A84F] text-white'
                : 'bg-[#222229] border-[#303036] text-[#999999] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#D6A84F]" />
              <div>
                <span className="text-xs font-bold text-white block">{SEED_ADMIN.name}</span>
                <span className="text-[11px] text-[#999999]">{SEED_ADMIN.email}</span>
              </div>
            </div>
            {currentUser.id === SEED_ADMIN.id && (
              <span className="text-xs text-[#D6A84F] font-bold">Aktif ✓</span>
            )}
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
            Kuryeler
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SEED_COURIERS.map((courier) => (
              <button
                key={courier.id}
                onClick={() => onSwitchUser(courier)}
                className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-colors ${
                  currentUser.id === courier.id
                    ? 'bg-emerald-500/15 border-emerald-500 text-white'
                    : 'bg-[#222229] border-[#303036] text-[#999999] hover:text-white'
                }`}
              >
                <div className="truncate">
                  <span className="text-xs font-bold text-white block truncate">{courier.name}</span>
                  <span className="text-[10px] text-emerald-400 font-mono">{courier.plate}</span>
                </div>
                {currentUser.id === courier.id && (
                  <span className="text-xs text-emerald-400 font-bold shrink-0">Aktif</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">
            Müşteriler
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SEED_CUSTOMERS.map((cust) => (
              <button
                key={cust.id}
                onClick={() => onSwitchUser(cust)}
                className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-colors ${
                  currentUser.id === cust.id
                    ? 'bg-sky-500/15 border-sky-500 text-white'
                    : 'bg-[#222229] border-[#303036] text-[#999999] hover:text-white'
                }`}
              >
                <div className="truncate">
                  <span className="text-xs font-bold text-white block truncate">{cust.name}</span>
                  <span className="text-[10px] text-[#999999] font-mono">{cust.phone}</span>
                </div>
                {currentUser.id === cust.id && (
                  <span className="text-xs text-sky-400 font-bold shrink-0">Aktif</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
