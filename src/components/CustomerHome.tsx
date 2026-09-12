import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  Calculator,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";

import type {
  Order,
  PricingConfig,
} from "../types";

interface Props {
  onOpenNewOrder: (
    prefill?: Partial<Order>
  ) => void;
  onOpenAI: () => void;
  onGoToOrders: () => void;
  activeOrders: Order[];
  pricing: PricingConfig;
}

export function CustomerHome({
  onOpenNewOrder,
  onOpenAI,
  onGoToOrders,
  activeOrders,
  pricing,
}: Props) {
  const [calcKm, setCalcKm] =
    useState<number>(10);

  const [calcType, setCalcType] =
    useState<
      "Standart Kurye" |
      "Acil Kurye" |
      "VIP Kurye"
    >("Standart Kurye");

  const activeOrder =
    activeOrders?.[0] ?? null;

  const activeOrderCount =
    activeOrders?.length ?? 0;

  /*
   * ==========================================
   * PRICE CALCULATOR
   * ==========================================
   */

  const priceCalculation = useMemo(() => {
    const km = Math.max(
      0,
      Number(calcKm) || 0
    );

    let multiplier = 1;

    if (calcType === "Acil Kurye") {
      multiplier =
        pricing?.urgentMultiplier ?? 1.3;
    }

    if (calcType === "VIP Kurye") {
      multiplier =
        pricing?.vipMultiplier ?? 1.6;
    }

    const basePrice =
      km *
      (pricing?.perKmPrice ?? 50);

    const calculatedPrice =
      basePrice * multiplier;

    const minimumPrice =
      pricing?.minPrice ?? 250;

    const finalPrice = Math.max(
      calculatedPrice,
      minimumPrice
    );

    return {
      finalPrice,
      basePrice,
      minimumApplied:
        calculatedPrice < minimumPrice,
    };
  }, [
    calcKm,
    calcType,
    pricing,
  ]);

  /*
   * ==========================================
   * STATUS
   * ==========================================
   */

  const getStatusText = (
    order: Order
  ) => {
    switch (order.status) {
      case "Kurye Bekleniyor":
        return "Kurye aranıyor";

      case "Kurye Atandı":
        return "Kurye atandı";

      case "Kurye Kabul Etti":
        return "Kurye siparişi kabul etti";

      case "Paket Alındı":
        return "Paket alındı";

      case "Teslimatta":
        return "Teslimat devam ediyor";

      default:
        return order.status;
    }
  };

  const getStatusProgress = (
    order: Order
  ) => {
    switch (order.status) {
      case "Kurye Bekleniyor":
        return 20;

      case "Kurye Atandı":
        return 40;

      case "Kurye Kabul Etti":
        return 55;

      case "Paket Alındı":
        return 75;

      case "Teslimatta":
        return 90;

      case "Teslim Edildi":
        return 100;

      default:
        return 10;
    }
  };

  /*
   * ==========================================
   * QUICK ORDER
   * ==========================================
   */

  const handleQuickOrder = (
    type:
      | "Standart Kurye"
      | "Acil Kurye"
      | "VIP Kurye"
  ) => {
    const urgency =
      type === "VIP Kurye"
        ? "Çok Acil"
        : type === "Acil Kurye"
        ? "Acil"
        : "Normal";

    onOpenNewOrder({
      courierType: type,
      urgency,
    });
  };

  /*
   * ==========================================
   * RENDER
   * ==========================================
   */

  return (
    <div className="mx-auto w-full max-w-6xl pb-8">
      {/* ==========================================
          PREMIUM HERO
      ========================================== */}

      <section className="relative overflow-hidden rounded-[32px] border border-[#2E2E36] bg-gradient-to-br from-[#1B1B21] via-[#111116] to-[#0D0D10] shadow-2xl">
        {/* Ambient lights */}

        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#D6A84F]/10 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-[#D6A84F]/5 blur-3xl" />

        {/* Grid */}

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative p-6 sm:p-8 lg:p-10">
          {/* Top badge */}

          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#D6A84F]/20 bg-[#D6A84F]/10 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D6A84F] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#D6A84F]" />
            </span>

            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D6A84F]">
              Trustline Express aktif
            </span>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
            {/* Hero text */}

            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#888891]">
                <ShieldCheck
                  size={15}
                  className="text-[#D6A84F]"
                />

                Güvenli • Hızlı • Profesyonel
              </div>

              <h1 className="max-w-2xl text-3xl font-black leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-5xl">
                Gönderin güvende,
                <span className="block text-[#D6A84F]">
                  teslimatınız bizde.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-6 text-[#9A9AA3] sm:text-base">
                İhtiyacınız olan kurye hizmetini
                birkaç saniyede oluşturun.
                Siparişinizi oluşturun, kurye
                sürecini anlık olarak takip edin.
              </p>

              {/* Main actions */}

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    onOpenNewOrder()
                  }
                  className="group flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#D6A84F] px-6 text-sm font-black text-[#0B0B0D] shadow-lg shadow-[#D6A84F]/10 transition hover:-translate-y-0.5 hover:bg-[#E2B866]"
                >
                  <Plus size={19} />

                  Yeni Kurye Çağır

                  <ArrowRight
                    size={17}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </button>

                <button
                  type="button"
                  onClick={onOpenAI}
                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#3A3A43] bg-white/[0.03] px-6 text-sm font-bold text-white transition hover:border-[#D6A84F]/40 hover:bg-white/[0.06]"
                >
                  <Bot
                    size={18}
                    className="text-[#D6A84F]"
                  />

                  Trustline AI
                </button>
              </div>
            </div>

            {/* Dashboard visual */}

            <div className="hidden lg:block">
              <div className="relative mx-auto h-64 w-64">
                <div className="absolute inset-4 rounded-full border border-[#D6A84F]/10" />

                <div className="absolute inset-10 rounded-full border border-dashed border-[#D6A84F]/20" />

                <div className="absolute inset-[72px] flex items-center justify-center rounded-[28px] border border-[#D6A84F]/20 bg-[#D6A84F]/10 shadow-2xl shadow-[#D6A84F]/5">
                  <Truck
                    size={48}
                    strokeWidth={1.5}
                    className="text-[#D6A84F]"
                  />
                </div>

                <div className="absolute left-1 top-12 flex h-10 w-10 items-center justify-center rounded-xl border border-[#303038] bg-[#18181D] shadow-xl">
                  <MapPin
                    size={17}
                    className="text-[#D6A84F]"
                  />
                </div>

                <div className="absolute right-1 top-28 flex h-10 w-10 items-center justify-center rounded-xl border border-[#303038] bg-[#18181D] shadow-xl">
                  <Package
                    size={17}
                    className="text-[#D6A84F]"
                  />
                </div>

                <div className="absolute bottom-8 left-14 flex h-9 w-9 items-center justify-center rounded-xl border border-[#303038] bg-[#18181D] shadow-xl">
                  <Zap
                    size={15}
                    className="text-[#D6A84F]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          ACTIVE ORDER
      ========================================== */}

      {activeOrder && (
        <section className="mt-5 overflow-hidden rounded-[28px] border border-[#D6A84F]/20 bg-[#15151A] shadow-xl">
          <button
            type="button"
            onClick={onGoToOrders}
            className="w-full text-left"
          >
            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D6A84F]/10">
                    <Truck
                      size={20}
                      className="text-[#D6A84F]"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D6A84F]">
                        Aktif sipariş
                      </span>

                      {activeOrderCount > 1 && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-bold text-[#9999A2]">
                          +{activeOrderCount - 1} aktif
                        </span>
                      )}
                    </div>

                    <h2 className="mt-1 text-base font-black text-white">
                      {getStatusText(
                        activeOrder
                      )}
                    </h2>

                    <p className="mt-1 text-xs text-[#777780]">
                      #{activeOrder.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start rounded-xl border border-[#303038] px-3 py-2 sm:self-auto">
                  <span className="text-xs font-bold text-[#B4B4BC]">
                    Detayları Gör
                  </span>

                  <ArrowRight
                    size={15}
                    className="text-[#D6A84F]"
                  />
                </div>
              </div>

              {/* Progress */}

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-[10px] font-bold">
                  <span className="text-[#777780]">
                    Teslimat ilerlemesi
                  </span>

                  <span className="text-[#D6A84F]">
                    {getStatusProgress(
                      activeOrder
                    )}
                    %
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[#28282F]">
                  <div
                    className="h-full rounded-full bg-[#D6A84F] transition-all duration-700"
                    style={{
                      width: `${getStatusProgress(
                        activeOrder
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Addresses */}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#292930] bg-[#101014] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-emerald-500/10 p-2">
                      <MapPin
                        size={15}
                        className="text-emerald-400"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#66666F]">
                        Alış adresi
                      </p>

                      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#C4C4CB]">
                        {
                          activeOrder.pickupAddress
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#292930] bg-[#101014] p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-[#D6A84F]/10 p-2">
                      <MapPin
                        size={15}
                        className="text-[#D6A84F]"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#66666F]">
                        Teslimat adresi
                      </p>

                      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-[#C4C4CB]">
                        {
                          activeOrder.deliveryAddress
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </section>
      )}

      {/* ==========================================
          QUICK STATS
      ========================================== */}

      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#292930] bg-[#15151A] p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#D6A84F]/10">
            <Clock3
              size={17}
              className="text-[#D6A84F]"
            />
          </div>

          <p className="text-lg font-black text-white">
            30-45
          </p>

          <p className="mt-1 text-[10px] font-bold text-[#6E6E77]">
            dk teslimat
          </p>
        </div>

        <div className="rounded-2xl border border-[#292930] bg-[#15151A] p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
            <CheckCircle2
              size={17}
              className="text-emerald-400"
            />
          </div>

          <p className="text-lg font-black text-white">
            %100
          </p>

          <p className="mt-1 text-[10px] font-bold text-[#6E6E77]">
            güvenli teslimat
          </p>
        </div>

        <div className="rounded-2xl border border-[#292930] bg-[#15151A] p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
            <Truck
              size={17}
              className="text-blue-400"
            />
          </div>

          <p className="text-lg font-black text-white">
            7/24
          </p>

          <p className="mt-1 text-[10px] font-bold text-[#6E6E77]">
            kurye hizmeti
          </p>
        </div>

        <div className="rounded-2xl border border-[#292930] bg-[#15151A] p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10">
            <Sparkles
              size={17}
              className="text-purple-400"
            />
          </div>

          <p className="text-lg font-black text-white">
            AI
          </p>

          <p className="mt-1 text-[10px] font-bold text-[#6E6E77]">
            akıllı destek
          </p>
        </div>
      </section>

      {/* ==========================================
          SERVICES
      ========================================== */}

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D6A84F]">
              Hizmetler
            </p>

            <h2 className="mt-1 text-xl font-black text-white">
              Size uygun kuryeyi seçin
            </h2>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {/* Standard */}

          <button
            type="button"
            onClick={() =>
              handleQuickOrder(
                "Standart Kurye"
              )
            }
            className="group relative overflow-hidden rounded-[24px] border border-[#2C2C33] bg-[#15151A] p-5 text-left transition hover:-translate-y-1 hover:border-[#D6A84F]/30 hover:bg-[#19191F]"
          >
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#D6A84F]/5 blur-2xl transition group-hover:bg-[#D6A84F]/10" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D6A84F]/10">
                  <Truck
                    size={22}
                    className="text-[#D6A84F]"
                  />
                </div>

                <ArrowRight
                  size={17}
                  className="text-[#55555E] transition group-hover:translate-x-1 group-hover:text-[#D6A84F]"
                />
              </div>

              <h3 className="mt-5 text-base font-black text-white">
                Standart Kurye
              </h3>

              <p className="mt-2 text-xs leading-5 text-[#777780]">
                Günlük gönderileriniz için
                ekonomik ve güvenilir kurye
                hizmeti.
              </p>

              <div className="mt-5 flex items-center gap-2 text-[10px] font-bold text-[#D6A84F]">
                <CheckCircle2 size={13} />
                En çok tercih edilen
              </div>
            </div>
          </button>

          {/* Urgent */}

          <button
            type="button"
            onClick={() =>
              handleQuickOrder(
                "Acil Kurye"
              )
            }
            className="group relative overflow-hidden rounded-[24px] border border-[#2C2C33] bg-[#15151A] p-5 text-left transition hover:-translate-y-1 hover:border-orange-400/30 hover:bg-[#19191F]"
          >
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-orange-500/5 blur-2xl" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10">
                  <Zap
                    size={22}
                    className="text-orange-400"
                  />
                </div>

                <ArrowRight
                  size={17}
                  className="text-[#55555E] transition group-hover:translate-x-1 group-hover:text-orange-400"
                />
              </div>

              <h3 className="mt-5 text-base font-black text-white">
                Acil Kurye
              </h3>

              <p className="mt-2 text-xs leading-5 text-[#777780]">
                Zaman kritik gönderileriniz
                için öncelikli kurye hizmeti.
              </p>

              <div className="mt-5 flex items-center gap-2 text-[10px] font-bold text-orange-400">
                <Zap size={13} />
                Öncelikli teslimat
              </div>
            </div>
          </button>

          {/* VIP */}

          <button
            type="button"
            onClick={() =>
              handleQuickOrder(
                "VIP Kurye"
              )
            }
            className="group relative overflow-hidden rounded-[24px] border border-[#D6A84F]/20 bg-gradient-to-br from-[#1A1813] to-[#15151A] p-5 text-left transition hover:-translate-y-1 hover:border-[#D6A84F]/40"
          >
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#D6A84F]/10 blur-2xl" />

            <div className="relative">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D6A84F]/15">
                  <Sparkles
                    size={22}
                    className="text-[#D6A84F]"
                  />
                </div>

                <ArrowRight
                  size={17}
                  className="text-[#55555E] transition group-hover:translate-x-1 group-hover:text-[#D6A84F]"
                />
              </div>

              <h3 className="mt-5 text-base font-black text-white">
                VIP Kurye
              </h3>

              <p className="mt-2 text-xs leading-5 text-[#777780]">
                Özel gönderileriniz için
                maksimum öncelik ve özen.
              </p>

              <div className="mt-5 flex items-center gap-2 text-[10px] font-bold text-[#D6A84F]">
                <Sparkles size={13} />
                Premium hizmet
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* ==========================================
          PRICE CALCULATOR
      ========================================== */}

      <section className="mt-8 overflow-hidden rounded-[28px] border border-[#2D2D35] bg-[#15151A]">
        <div className="grid lg:grid-cols-[1fr_0.8fr]">
          {/* Calculator */}

          <div className="p-6 sm:p-7">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D6A84F]/10">
                <Calculator
                  size={20}
                  className="text-[#D6A84F]"
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#D6A84F]">
                  Hızlı hesaplama
                </p>

                <h2 className="mt-1 text-xl font-black text-white">
                  Tahmini teslimat ücretini hesapla
                </h2>

                <p className="mt-1 text-xs text-[#707079]">
                  Mesafeyi ve kurye tipini seçin.
                </p>
              </div>
            </div>

            {/* KM */}

            <div className="mt-7">
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="customer-calc-km"
                  className="text-xs font-bold text-[#B5B5BD]"
                >
                  Mesafe
                </label>

                <span className="text-xs font-black text-[#D6A84F]">
                  {calcKm} km
                </span>
              </div>

              <input
                id="customer-calc-km"
                type="range"
                min="1"
                max="100"
                value={calcKm}
                onChange={(event) =>
                  setCalcKm(
                    Number(
                      event.target.value
                    )
                  )
                }
                className="w-full accent-[#D6A84F]"
              />

              <div className="mt-2 flex justify-between text-[9px] font-bold text-[#55555E]">
                <span>1 km</span>
                <span>100 km</span>
              </div>
            </div>

            {/* Type */}

            <div className="mt-6">
              <p className="mb-2 text-xs font-bold text-[#B5B5BD]">
                Kurye tipi
              </p>

              <div className="grid grid-cols-3 gap-2">
                {[
                  "Standart Kurye",
                  "Acil Kurye",
                  "VIP Kurye",
                ].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setCalcType(
                        type as
                          | "Standart Kurye"
                          | "Acil Kurye"
                          | "VIP Kurye"
                      )
                    }
                    className={`rounded-xl border px-2 py-3 text-[10px] font-black transition ${
                      calcType === type
                        ? "border-[#D6A84F] bg-[#D6A84F]/10 text-[#D6A84F]"
                        : "border-[#303038] bg-[#101014] text-[#777780] hover:border-[#4A4A53]"
                    }`}
                  >
                    {type.replace(
                      " Kurye",
                      ""
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Result */}

          <div className="relative flex flex-col justify-between overflow-hidden border-t border-[#2D2D35] bg-gradient-to-br from-[#1C1A15] to-[#121216] p-6 lg:border-l lg:border-t-0 sm:p-7">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#D6A84F]/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#777780]">
                <Sparkles
                  size={13}
                  className="text-[#D6A84F]"
                />

                Tahmini ücret
              </div>

              <div className="mt-5 flex items-end gap-2">
                <span className="text-4xl font-black tracking-tight text-white">
                  {Math.round(
                    priceCalculation.finalPrice
                  ).toLocaleString(
                    "tr-TR"
                  )}
                </span>

                <span className="mb-1.5 text-sm font-bold text-[#777780]">
                  TL
                </span>
              </div>

              {priceCalculation.minimumApplied && (
                <p className="mt-2 text-[10px] leading-4 text-[#777780]">
                  Minimum hizmet bedeli
                  uygulanmıştır.
                </p>
              )}

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between border-b border-[#292930] pb-3">
                  <span className="text-[10px] text-[#777780]">
                    Mesafe
                  </span>

                  <span className="text-xs font-bold text-white">
                    {calcKm} km
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-[#292930] pb-3">
                  <span className="text-[10px] text-[#777780]">
                    Kurye
                  </span>

                  <span className="text-xs font-bold text-white">
                    {calcType.replace(
                      " Kurye",
                      ""
                    )}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                onOpenNewOrder({
                  courierType: calcType,
                  urgency:
                    calcType ===
                    "VIP Kurye"
                      ? "Çok Acil"
                      : calcType ===
                        "Acil Kurye"
                      ? "Acil"
                      : "Normal",
                })
              }
              className="relative mt-7 flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#D6A84F] px-5 text-xs font-black text-[#0B0B0D] transition hover:bg-[#E2B866]"
            >
              Bu Ayarla Sipariş Oluştur
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* ==========================================
          TRUSTLINE AI
      ========================================== */}

      <section className="mt-8">
        <button
          type="button"
          onClick={onOpenAI}
          className="group relative w-full overflow-hidden rounded-[28px] border border-[#303038] bg-gradient-to-r from-[#17171C] to-[#111115] p-6 text-left transition hover:border-[#D6A84F]/30"
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#D6A84F]/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D6A84F]/10">
                <Bot
                  size={23}
                  className="text-[#D6A84F]"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white">
                    Trustline AI
                  </h2>

                  <span className="rounded-full bg-[#D6A84F]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#D6A84F]">
                    Beta
                  </span>
                </div>

                <p className="mt-1 max-w-xl text-xs leading-5 text-[#777780]">
                  Siparişinizi oluştururken AI
                  asistanından yardım alın ve
                  gönderi bilgilerinizi hızlıca
                  hazırlayın.
                </p>
              </div>
            </div>

            <div className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#34343C] px-4 text-xs font-black text-white transition group-hover:border-[#D6A84F]/30 group-hover:text-[#D6A84F]">
              AI'ı Aç

              <ArrowRight size={14} />
            </div>
          </div>
        </button>
      </section>

      {/* ==========================================
          FOOTER INFO
      ========================================== */}

      <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center">
        <div className="flex items-center gap-2">
          <ShieldCheck
            size={14}
            className="text-[#D6A84F]"
          />

          <span className="text-[10px] font-bold text-[#66666F]">
            Trustline Express güvenli teslimat
            altyapısı
          </span>
        </div>

        <p className="text-[9px] text-[#4F4F57]">
          Siparişlerinizi oluşturun, takip edin
          ve teslimat sürecini kolayca yönetin.
        </p>
      </div>
    </div>
  );
}

export default CustomerHome;