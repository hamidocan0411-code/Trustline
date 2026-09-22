import React from "react";
import {
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
  Headphones,
  MapPin,
  Package,
  Plus,
  Truck,
  UserRound,
  XCircle,
} from "lucide-react";
import type { Order, UserProfile } from "../types";

interface Props {
  currentUser: UserProfile;
  orders: Order[];
  onOpenNewOrder: () => void;
  onGoToOrders: () => void;
  onSelectOrder: (orderId: string) => void;
  onOpenSupport: () => void;
  onOpenCompany: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount?: number;
}

const ACTIVE_STATUSES = new Set([
  "Kurye Bekleniyor",
  "Kurye Atandı",
  "Kurye Kabul Etti",
  "Paket Alındı",
  "Teslimatta",
]);

const statusTone = (status: Order["status"]) => {
  switch (status) {
    case "Teslim Edildi":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
    case "İptal Edildi":
      return "border-red-500/25 bg-red-500/10 text-red-300";
    case "Teslimatta":
      return "border-[#D6A84F]/30 bg-[#D6A84F]/10 text-[#E2B866]";
    case "Kurye Atandı":
    case "Kurye Kabul Etti":
      return "border-blue-500/25 bg-blue-500/10 text-blue-300";
    default:
      return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }
};

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TL";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "TL";
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const CorporatePanel: React.FC<Props> = ({
  currentUser,
  orders,
  onOpenNewOrder,
  onGoToOrders,
  onSelectOrder,
  onOpenSupport,
  onOpenCompany,
  onOpenNotifications,
  unreadNotificationsCount = 0,
}) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const active = safeOrders.filter((order) => ACTIVE_STATUSES.has(order.status));
  const completed = safeOrders.filter((order) => order.status === "Teslim Edildi");
  const cancelled = safeOrders.filter((order) => order.status === "İptal Edildi");
  const recent = [...safeOrders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const companyName = currentUser.companyName || currentUser.name || "Kurumsal Firma";
  const contactName = currentUser.companyContactName || currentUser.name || "Yetkili";
  const companyInitials = initials(companyName);

  const stats = [
    { label: "Toplam Sipariş", value: safeOrders.length, helper: "Tüm zamanlar", icon: Package, tone: "text-white" },
    { label: "Aktif Sipariş", value: active.length, helper: "Şu anda devam eden", icon: Clock3, tone: "text-[#D6A84F]" },
    { label: "Tamamlanan", value: completed.length, helper: "Başarıyla teslim edildi", icon: CheckCircle2, tone: "text-emerald-300" },
    { label: "İptal Edilen", value: cancelled.length, helper: "İptal edilen gönderiler", icon: XCircle, tone: "text-red-300" },
  ];

  const quickActions = [
    { label: "Yeni Sipariş", description: "Kurye talebi oluştur", icon: Plus, onClick: onOpenNewOrder, primary: true },
    { label: "Siparişlerim", description: "Tüm gönderileri görüntüle", icon: Package, onClick: onGoToOrders, primary: false },
    { label: "Aktif Teslimatlar", description: active.length ? active.length + " aktif gönderi" : "Şu anda aktif gönderi yok", icon: Truck, onClick: onGoToOrders, primary: false },
    { label: "Destek", description: "TrustLine ekibine ulaş", icon: Headphones, onClick: onOpenSupport, primary: false },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-24">
      <section className="relative overflow-hidden rounded-[28px] border border-[#D6A84F]/20 bg-gradient-to-br from-[#19191E] via-[#151519] to-[#0F0F13] p-5 shadow-2xl sm:p-6 lg:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#D6A84F]/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-56 rounded-full bg-white/[0.02] blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#D6A84F]/25 bg-[#D6A84F]/10 text-base font-black text-[#D6A84F] shadow-inner">
              {companyInitials}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D6A84F]">Kurumsal Operasyon</p>
              <h1 className="mt-1 truncate text-2xl font-black tracking-tight text-white sm:text-3xl">Hoş geldiniz, {companyName}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8F8F99]">Teslimatlarınızı ve gönderilerinizi tek panelden yönetin.</p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button type="button" onClick={onOpenNotifications} className="inline-flex items-center gap-2 rounded-xl border border-[#303036] bg-[#19191E] px-4 py-3 text-xs font-bold text-white transition hover:border-[#D6A84F]/30 hover:text-[#D6A84F]">
              <Bell size={16} /> Bildirimler
              {unreadNotificationsCount > 0 && (
                <span className="min-w-5 rounded-full bg-[#D6A84F] px-1.5 py-0.5 text-[9px] font-black text-[#0B0B0D]">{unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}</span>
              )}
            </button>
            <button type="button" onClick={onOpenNewOrder} className="inline-flex items-center gap-2 rounded-xl bg-[#D6A84F] px-4 py-3 text-xs font-black text-[#0B0B0D] shadow-lg shadow-[#D6A84F]/10 transition hover:-translate-y-0.5 hover:bg-[#E2B866] active:translate-y-0">
              <Plus size={16} /> Yeni Sipariş
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, helper, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border border-[#303036] bg-[#19191E] p-4 transition-colors hover:border-[#3B3B44]">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#777780]">{label}</span>
              <Icon size={17} className={tone} />
            </div>
            <div className={"mt-3 text-3xl font-black tracking-tight " + tone}>{value}</div>
            <p className="mt-1 text-[10px] text-[#777780]">{helper}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[#303036] bg-[#19191E] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D6A84F]">Operasyon özeti</p>
            <h2 className="mt-1 text-sm font-black text-white">Kurumsal gönderi durumunuz</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[300px]">
            <div className="rounded-xl border border-[#303036] bg-[#111116] px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-[#66666F]">Aktif</p>
              <p className="mt-1 text-lg font-black text-[#D6A84F]">{active.length}</p>
            </div>
            <div className="rounded-xl border border-[#303036] bg-[#111116] px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-[#66666F]">Teslimat oranı</p>
              <p className="mt-1 text-lg font-black text-emerald-300">
                {safeOrders.length ? Math.round((completed.length / safeOrders.length) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#2A2A31]" aria-label="Teslimat oranı">
          <div
            className="h-full rounded-full bg-[#D6A84F] transition-all duration-500"
            style={{ width: safeOrders.length ? Math.min(100, (completed.length / safeOrders.length) * 100) + "%" : "0%" }}
          />
        </div>
        <p className="mt-2 text-[10px] text-[#66666F]">
          Oran, bu panelde görünen toplam siparişler içindeki teslim edilmiş gönderileri ifade eder.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map(({ label, description, icon: Icon, onClick, primary }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className={
              "group rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 active:translate-y-0 " +
              (primary
                ? "border-[#D6A84F]/30 bg-[#D6A84F]/[0.07] hover:bg-[#D6A84F]/[0.11]"
                : "border-[#303036] bg-[#19191E] hover:border-[#D6A84F]/25")
            }
          >
            <div className="flex items-center justify-between gap-3">
              <span className={"flex h-10 w-10 items-center justify-center rounded-xl " + (primary ? "bg-[#D6A84F] text-[#0B0B0D]" : "bg-[#222229] text-[#D6A84F]")}>
                <Icon size={17} />
              </span>
              <ArrowRight size={15} className="text-[#55555D] transition-transform group-hover:translate-x-1 group-hover:text-[#D6A84F]" />
            </div>
            <p className="mt-4 text-sm font-black text-white">{label}</p>
            <p className="mt-1 text-xs text-[#777780]">{description}</p>
          </button>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-2xl border border-[#303036] bg-[#19191E]">
          <div className="flex items-center justify-between gap-3 border-b border-[#303036] px-4 py-4 sm:px-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D6A84F]">Canlı operasyon</p>
              <h2 className="mt-1 text-base font-black text-white">Şu An Devam Eden Teslimatlar</h2>
            </div>
            <button type="button" onClick={onGoToOrders} className="hidden items-center gap-1 text-xs font-bold text-[#D6A84F] sm:flex">Tümünü Gör <ArrowRight size={14} /></button>
          </div>

          {active.length === 0 ? (
            <div className="p-8 text-center sm:p-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#303036] bg-[#111116] text-[#66666F]"><Truck size={24} /></div>
              <h3 className="mt-4 text-sm font-black text-white">Şu anda devam eden teslimatınız bulunmuyor.</h3>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#777780]">Yeni bir gönderi oluşturduğunuzda operasyon durumu burada anlık olarak görünecektir.</p>
              <button type="button" onClick={onOpenNewOrder} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#D6A84F] px-4 py-2.5 text-xs font-black text-[#0B0B0D]"><Plus size={15} /> Yeni Sipariş Oluştur</button>
            </div>
          ) : (
            <div className="divide-y divide-[#303036]">
              {active.slice(0, 5).map((order) => (
                <button key={order.id} type="button" onClick={() => onSelectOrder(order.id)} className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-[#D6A84F]">#{order.id}</span>
                      {order.customerType === "corporate" && <span className="rounded-full bg-[#D6A84F]/10 px-2 py-1 text-[9px] font-black text-[#D6A84F]">KURUMSAL</span>}
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-[#C8C8D0] sm:grid-cols-2 sm:gap-x-5">
                      <span className="truncate"><span className="text-[#66666F]">Alış:</span> {order.pickupAddress}</span>
                      <span className="truncate"><span className="text-[#66666F]">Teslimat:</span> {order.deliveryAddress}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <span className={"rounded-full border px-2.5 py-1 text-[10px] font-bold " + statusTone(order.status)}>{order.status}</span>
                    <span className="text-sm font-black text-white">{Number(order.price || 0).toLocaleString("tr-TR")} TL</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#303036] bg-[#19191E] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D6A84F]">Firma özeti</p>
              <h2 className="mt-1 text-base font-black text-white">Firma Bilgileri</h2>
            </div>
            <button type="button" onClick={onOpenCompany} className="rounded-xl border border-[#303036] p-2 text-[#999999] transition hover:border-[#D6A84F]/30 hover:text-[#D6A84F]" aria-label="Firma bilgilerini aç"><ArrowRight size={15} /></button>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-[#303036] bg-[#111116] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D6A84F]/10 text-[#D6A84F]"><Building2 size={16} /></div>
              <div className="min-w-0"><p className="text-[9px] uppercase tracking-wider text-[#66666F]">Firma</p><p className="truncate text-xs font-bold text-white">{companyName}</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[#303036] bg-[#111116] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#222229] text-[#D6A84F]"><UserRound size={16} /></div>
              <div className="min-w-0"><p className="text-[9px] uppercase tracking-wider text-[#66666F]">Yetkili</p><p className="truncate text-xs font-bold text-white">{contactName}</p></div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[#303036] bg-[#111116] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#222229] text-[#D6A84F]"><MapPin size={16} /></div>
              <div className="min-w-0"><p className="text-[9px] uppercase tracking-wider text-[#66666F]">Adres</p><p className="text-xs leading-5 text-[#C8C8D0]">{currentUser.companyAddress || "Bilgi eklenmemiş"}</p></div>
            </div>
          </div>

          <button type="button" onClick={onOpenCompany} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#303036] bg-[#222229] px-4 py-3 text-xs font-bold text-white transition hover:border-[#D6A84F]/30 hover:text-[#D6A84F]">Firma Bilgilerini Gör <ArrowRight size={14} /></button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#303036] bg-[#19191E]">
        <div className="flex items-center justify-between gap-3 border-b border-[#303036] px-4 py-4 sm:px-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D6A84F]">Operasyon geçmişi</p>
            <h2 className="mt-1 text-base font-black text-white">Son Siparişler</h2>
          </div>
          <button type="button" onClick={onGoToOrders} className="flex items-center gap-1 text-xs font-bold text-[#D6A84F]">Tümünü Gör <ArrowRight size={14} /></button>
        </div>

        {recent.length === 0 ? (
          <div className="p-10 text-center">
            <Package size={26} className="mx-auto text-[#55555D]" />
            <p className="mt-3 text-sm font-bold text-white">Henüz siparişiniz bulunmuyor.</p>
            <p className="mt-1 text-xs text-[#777780]">İlk gönderinizi oluşturmak için hemen yeni sipariş oluşturabilirsiniz.</p>
            <button type="button" onClick={onOpenNewOrder} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#D6A84F] px-4 py-2.5 text-xs font-black text-[#0B0B0D]"><Plus size={15} /> Yeni Sipariş</button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-[#303036] text-[9px] uppercase tracking-[0.14em] text-[#66666F]">
                    <th className="px-5 py-3 font-black">Takip No</th>
                    <th className="px-5 py-3 font-black">Tarih</th>
                    <th className="px-5 py-3 font-black">Teslimat</th>
                    <th className="px-5 py-3 font-black">Durum</th>
                    <th className="px-5 py-3 text-right font-black">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((order) => (
                    <tr key={order.id} onClick={() => onSelectOrder(order.id)} className="cursor-pointer border-b border-[#303036]/70 transition hover:bg-white/[0.02]">
                      <td className="px-5 py-4 font-mono text-xs font-black text-[#D6A84F]">#{order.id}</td>
                      <td className="px-5 py-4 text-xs text-[#999999]">{formatDate(order.createdAt)}</td>
                      <td className="max-w-[320px] px-5 py-4 text-xs text-white"><span className="block truncate">{order.deliveryAddress}</span></td>
                      <td className="px-5 py-4"><span className={"inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold " + statusTone(order.status)}>{order.status}</span></td>
                      <td className="px-5 py-4 text-right text-xs font-black text-white">{Number(order.price || 0).toLocaleString("tr-TR")} TL</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#303036] md:hidden">
              {recent.map((order) => (
                <button key={order.id} type="button" onClick={() => onSelectOrder(order.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-black text-[#D6A84F]">#{order.id}</div>
                    <p className="mt-1 truncate text-xs text-white">{order.deliveryAddress}</p>
                    <p className="mt-1 text-[10px] text-[#66666F]">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={"inline-flex rounded-full border px-2 py-1 text-[9px] font-bold " + statusTone(order.status)}>{order.status}</span>
                    <p className="mt-1 text-xs font-black text-white">{Number(order.price || 0).toLocaleString("tr-TR")} TL</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#303036] bg-[#19191E] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D6A84F]/10 text-[#D6A84F]"><Headphones size={19} /></div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-white">Yardıma mı ihtiyacınız var?</h2>
              <p className="mt-1 text-xs leading-5 text-[#777780]">Sipariş, teslimat veya hesabınızla ilgili sorularınız için mevcut destek sisteminden TrustLine ekibine ulaşabilirsiniz.</p>
            </div>
          </div>
          <button type="button" onClick={onOpenSupport} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#D6A84F] px-4 py-2.5 text-xs font-black text-[#0B0B0D]"><Headphones size={15} /> Destek Al</button>
        </div>

        <button type="button" onClick={onOpenNotifications} className="rounded-2xl border border-[#303036] bg-[#19191E] p-5 text-left transition hover:border-[#D6A84F]/25">
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#222229] text-[#D6A84F]"><Bell size={19} /></div>
            <ArrowRight size={16} className="text-[#55555D]" />
          </div>
          <p className="mt-4 text-sm font-black text-white">Bildirimler</p>
          <p className="mt-1 text-xs text-[#777780]">
            {unreadNotificationsCount > 0 ? unreadNotificationsCount + " okunmamış bildiriminiz var." : "Yeni sipariş ve teslimat güncellemeleri burada."}
          </p>
        </button>
      </section>
    </div>
  );
};

export default CorporatePanel;
