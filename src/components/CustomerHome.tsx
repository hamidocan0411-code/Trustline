import React, { useState } from 'react';
import {
  ArrowRight,
  Bot,
  Calculator,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  Package,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Zap,
} from 'lucide-react';
import { CourierType, Order, PricingConfig } from '../types';
import { calculateOrderPrice, estimateDistanceBetweenAddresses } from '../utils/pricing';

interface Props {
  onOpenNewOrder: (prefill?: Partial<Order>) => void;
  onOpenAI: () => void;
  onGoToOrders: () => void;
  activeOrders: Order[];
  pricing: PricingConfig;
}

export const CustomerHome: React.FC<Props> = ({
  onOpenNewOrder,
  onOpenAI,
  onGoToOrders,
  activeOrders,
  pricing,
}) => {
  // Quick calculator state
  const [calcKm, setCalcKm] = useState<number>(10);
  const [calcType, setCalcType] = useState<CourierType>('Standart Kurye');

  const { finalPrice, isMinimumApplied } = calculateOrderPrice(calcKm, calcType, pricing);

  const activeOrder = activeOrders[0];

  return (
    <div className="space-y-6 pb-20">
      {/* Active Order Banner if any */}
      {activeOrder && (
        <div 
          onClick={onGoToOrders}
          className="bg-gradient-to-r from-[#19191E] via-[#222229] to-[#19191E] border border-[#D6A84F]/40 p-4 rounded-2xl cursor-pointer hover:border-[#D6A84F] transition-all shadow-lg shadow-[#D6A84F]/5 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#D6A84F]/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#D6A84F]/20 border border-[#D6A84F]/40 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5 text-[#D6A84F] animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#D6A84F] tracking-wide uppercase">
                    Aktif Siparişiniz Var
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0B0B0D] border border-[#303036] text-white font-mono">
                    #{activeOrder.id}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white mt-0.5">
                  Durum: <span className="text-emerald-400">{activeOrder.status}</span>
                </p>
                <p className="text-xs text-[#999999] truncate max-w-xs sm:max-w-md">
                  {activeOrder.deliveryAddress}
                </p>
              </div>
            </div>
            <button className="shrink-0 p-2 rounded-xl bg-[#222229] border border-[#303036] text-[#D6A84F] group-hover:bg-[#D6A84F] group-hover:text-[#0B0B0D] transition-colors">
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Hero Header */}
      <div className="relative rounded-3xl bg-[#19191E] border border-[#303036] p-6 sm:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-radial from-[#D6A84F]/15 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#222229] border border-[#303036] text-[#D6A84F] text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#D6A84F]" />
            <span>İstanbul Geneli VIP & Ekspres Teslimat</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight font-['Space_Grotesk']">
            Kurye hizmetinde güvenin yeni adresi.
          </h1>

          <p className="text-sm sm:text-base text-[#999999] mt-3 leading-relaxed">
            Şehir içi ve şehirler arası hızlı, güvenilir ve profesyonel kurye hizmeti.
            Otomatik mesafe ve adil fiyatlandırma garantisiyle dakikalar içinde kapınızda.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6">
            <button
              onClick={() => onOpenNewOrder()}
              className="flex items-center justify-center gap-2 bg-[#D6A84F] hover:bg-[#c49740] active:scale-[0.98] text-[#0B0B0D] font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-[#D6A84F]/20 transition-all cursor-pointer text-sm"
            >
              <Truck className="w-4 h-4" />
              <span>Kurye Çağır</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenAI}
              className="flex items-center justify-center gap-2 bg-[#222229] hover:bg-[#2c2c36] active:scale-[0.98] text-white border border-[#303036] hover:border-[#D6A84F]/60 font-semibold px-6 py-3.5 rounded-xl transition-all cursor-pointer text-sm group"
            >
              <Bot className="w-4 h-4 text-[#D6A84F] group-hover:scale-110 transition-transform" />
              <span>Trustline AI</span>
              <span className="text-[10px] bg-[#D6A84F]/20 text-[#D6A84F] px-1.5 py-0.5 rounded font-mono">
                Akıllı Asistan
              </span>
            </button>
          </div>
        </div>

        {/* Feature quick badges */}
        <div className="grid grid-cols-3 gap-2 mt-8 pt-6 border-t border-[#303036]/60 text-center">
          <div>
            <div className="text-base sm:text-xl font-bold text-white font-mono">30-45 dk</div>
            <div className="text-[11px] text-[#999999] mt-0.5">Ortalama Teslimat</div>
          </div>
          <div className="border-x border-[#303036]/60">
            <div className="text-base sm:text-xl font-bold text-[#D6A84F] font-mono">%100</div>
            <div className="text-[11px] text-[#999999] mt-0.5">Güvenli Taşıma</div>
          </div>
          <div>
            <div className="text-base sm:text-xl font-bold text-white font-mono">7/24</div>
            <div className="text-[11px] text-[#999999] mt-0.5">Aktif Filo</div>
          </div>
        </div>
      </div>

      {/* Service Cards (STANDART, ACİL, VIP) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-base font-bold text-white tracking-wide">
            Hizmet Seçenekleri
          </h2>
          <span className="text-xs text-[#999999]">İhtiyacınıza uygun kurye modeli</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* STANDART */}
          <div className="bg-[#19191E] border border-[#303036] hover:border-[#D6A84F]/50 transition-all rounded-2xl p-4 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#222229] border border-[#303036] text-[#999999] tracking-wider">
                  STANDART
                </span>
                <span className="text-xs text-[#999999] font-mono">1.00×</span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#D6A84F] transition-colors">
                Standart Moto Kurye
              </h3>
              <p className="text-xs text-[#999999] mt-1.5 leading-relaxed">
                Gün içi evrak, numune ve paketleriniz için en ekonomik ve güvenli taşımacılık çözümü.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>90-120 dakika içinde teslim</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Ekonomik tarife (KM başı 50 TL)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Fotoğraflı dijital teslim onayı</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => onOpenNewOrder({ courierType: 'Standart Kurye' })}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#222229] hover:bg-[#D6A84F] hover:text-[#0B0B0D] text-white text-xs font-bold transition-all border border-[#303036] cursor-pointer"
            >
              Standart Kurye Seç
            </button>
          </div>

          {/* ACİL */}
          <div className="bg-[#19191E] border-2 border-[#D6A84F]/60 shadow-lg shadow-[#D6A84F]/10 rounded-2xl p-4 flex flex-col justify-between relative group">
            <div className="absolute -top-3 right-4 bg-[#D6A84F] text-[#0B0B0D] text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              EN ÇOK TERCİH EDİLEN
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#D6A84F]/15 border border-[#D6A84F]/40 text-[#D6A84F] tracking-wider">
                  ACİL KURYE
                </span>
                <span className="text-xs text-[#D6A84F] font-mono">1.30×</span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#D6A84F] transition-colors">
                Ekspres Öncelikli
              </h3>
              <p className="text-xs text-[#999999] mt-1.5 leading-relaxed">
                Zamanla yarışan gönderileriniz için en yakın boş kurye anında adrese sevk edilir.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#D6A84F] shrink-0" />
                  <span>30-60 dakika ekspres varış</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#D6A84F] shrink-0" />
                  <span>Doğrudan rotalama & öncelikli kurye</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#D6A84F] shrink-0" />
                  <span>Canlı takip ve SMS bilgilendirme</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => onOpenNewOrder({ courierType: 'Acil Kurye', urgency: 'Acil' })}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] text-xs font-extrabold transition-all shadow-md shadow-[#D6A84F]/20 cursor-pointer"
            >
              Acil Kurye Çağır
            </button>
          </div>

          {/* VIP */}
          <div className="bg-[#19191E] border border-[#303036] hover:border-[#D6A84F]/50 transition-all rounded-2xl p-4 flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#222229] border border-[#303036] text-purple-300 tracking-wider">
                  VIP KURYE
                </span>
                <span className="text-xs text-purple-300 font-mono">1.60×</span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#D6A84F] transition-colors">
                Özel Tahsisli VIP
              </h3>
              <p className="text-xs text-[#999999] mt-1.5 leading-relaxed">
                Hassas, yüksek değerli veya gizlilik gerektiren gönderiler için kurye yalnızca size tahsis edilir.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Araya başka paket almadan tek yön</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Korumalı araç veya kapalı kasa seçeneği</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Elden ele gizlilik taahhüdü</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => onOpenNewOrder({ courierType: 'VIP Kurye', urgency: 'Çok Acil' })}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#222229] hover:bg-[#D6A84F] hover:text-[#0B0B0D] text-white text-xs font-bold transition-all border border-[#303036] cursor-pointer"
            >
              VIP Kurye Seç
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Price Calculator Widget */}
      <div className="bg-[#19191E] border border-[#303036] rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#222229] border border-[#303036] text-[#D6A84F]">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Anlık Ücret Hesaplayıcı</h3>
              <p className="text-[11px] text-[#999999]">Mesafe ve kurye tipine göre şeffaf fiyat</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#999999]">Hesaplanan Tutar</div>
            <div className="text-xl font-extrabold text-[#D6A84F] font-mono">
              {finalPrice} TL
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* KM Slider & Input */}
          <div className="bg-[#222229] border border-[#303036] p-3 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300">
                Tahmini Mesafe (KM)
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="150"
                  value={calcKm}
                  onChange={(e) => setCalcKm(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 bg-[#0B0B0D] border border-[#303036] rounded-lg px-2 py-1 text-right text-xs font-mono font-bold text-white focus:outline-hidden focus:border-[#D6A84F]"
                />
                <span className="text-xs text-[#999999]">KM</span>
              </div>
            </div>
            <input
              type="range"
              min="1"
              max="60"
              value={calcKm}
              onChange={(e) => setCalcKm(Number(e.target.value))}
              className="w-full accent-[#D6A84F] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#999999] mt-1">
              <span>1 KM</span>
              <span>20 KM</span>
              <span>40 KM</span>
              <span>60+ KM</span>
            </div>
          </div>

          {/* Courier Type Picker */}
          <div className="bg-[#222229] border border-[#303036] p-3 rounded-xl flex flex-col justify-between">
            <label className="text-xs font-semibold text-slate-300 mb-2 block">
              Kurye Türü
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['Standart Kurye', 'Acil Kurye', 'VIP Kurye'] as CourierType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setCalcType(type)}
                  className={`py-2 px-1 text-[11px] font-bold rounded-lg transition-all text-center ${
                    calcType === type
                      ? 'bg-[#D6A84F] text-[#0B0B0D] shadow-sm'
                      : 'bg-[#19191E] text-[#999999] hover:text-white border border-[#303036]'
                  }`}
                >
                  {type.replace(' Kurye', '')}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-[#999999] mt-2 flex items-center justify-between">
              <span>Açılış/Minimum: {pricing.minPrice} TL</span>
              {isMinimumApplied && (
                <span className="text-amber-400 font-medium">Minimum tutar uygulandı</span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => onOpenNewOrder({ distanceKm: calcKm, courierType: calcType })}
          className="mt-4 w-full py-2.5 rounded-xl bg-[#222229] hover:bg-[#D6A84F] hover:text-[#0B0B0D] text-white text-xs font-bold transition-all border border-[#303036] flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Bu Fiyatla Sipariş Oluştur ({finalPrice} TL)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
