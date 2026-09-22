import React from "react";
import { Building2, CheckCircle2, Clock3, Package, Plus, XCircle } from "lucide-react";
import type { Order, UserProfile } from "../types";

interface Props {
  currentUser: UserProfile;
  orders: Order[];
  onOpenNewOrder: () => void;
  onGoToOrders: () => void;
}

export const CorporatePanel: React.FC<Props> = ({
  currentUser,
  orders,
  onOpenNewOrder,
  onGoToOrders,
}) => {
  const active = orders.filter((o) => o.status !== "Teslim Edildi" && o.status !== "İptal Edildi");
  const completed = orders.filter((o) => o.status === "Teslim Edildi");
  const cancelled = orders.filter((o) => o.status === "İptal Edildi");
  const recent = [...orders].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0,5);

  const stats = [
    { label: "Toplam Sipariş", value: orders.length, icon: Package },
    { label: "Aktif Sipariş", value: active.length, icon: Clock3 },
    { label: "Tamamlanan", value: completed.length, icon: CheckCircle2 },
    { label: "İptal Edilen", value: cancelled.length, icon: XCircle },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-24">
      <section className="rounded-3xl border border-[#D6A84F]/20 bg-gradient-to-br from-[#19191E] to-[#101014] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D6A84F]/15 text-[#D6A84F]">
              <Building2 size={23} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D6A84F]">Kurumsal Firma</p>
              <h1 className="truncate text-xl font-black text-white">{currentUser.companyName || currentUser.name}</h1>
              <p className="truncate text-xs text-[#888891]">{currentUser.companyContactName || currentUser.name}</p>
            </div>
          </div>
          <button type="button" onClick={onOpenNewOrder} className="flex items-center justify-center gap-2 rounded-xl bg-[#D6A84F] px-4 py-3 text-sm font-black text-[#0B0B0D] transition hover:opacity-90">
            <Plus size={17} /> Yeni Sipariş
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({label,value,icon:Icon}) => (
          <div key={label} className="rounded-2xl border border-[#303036] bg-[#19191E] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#77777F]">{label}</span>
              <Icon size={17} className="text-[#D6A84F]" />
            </div>
            <div className="mt-3 text-2xl font-black text-white">{value}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-[#303036] bg-[#19191E] overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[#303036] p-4">
          <div>
            <h2 className="font-black text-white">Son Siparişler</h2>
            <p className="mt-1 text-xs text-[#77777F]">Firmanızın son işlemleri</p>
          </div>
          <button type="button" onClick={onGoToOrders} className="rounded-xl border border-[#303036] px-3 py-2 text-xs font-bold text-[#D6A84F]">Tümünü Gör</button>
        </div>
        {recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#77777F]">Henüz sipariş bulunmuyor.</div>
        ) : (
          <div className="divide-y divide-[#303036]">
            {recent.map((order) => (
              <button type="button" key={order.id} onClick={onGoToOrders} className="flex w-full flex-col gap-2 p-4 text-left transition hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#D6A84F]">#{order.id}</span>
                    <span className="rounded-full bg-[#D6A84F]/10 px-2 py-1 text-[9px] font-black text-[#D6A84F]">KURUMSAL</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-white">{order.deliveryAddress}</p>
                  <p className="mt-1 text-[10px] text-[#77777F]">{new Date(order.createdAt).toLocaleString("tr-TR")}</p>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <div className="text-xs font-bold text-white">{order.status}</div>
                  <div className="mt-1 text-sm font-black text-[#D6A84F]">{Number(order.price || 0).toLocaleString("tr-TR")} TL</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#303036] bg-[#19191E] p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#77777F]">Firma</p>
          <p className="mt-2 font-bold text-white">{currentUser.companyName || "Firma adı belirtilmemiş"}</p>
          <p className="mt-1 text-xs text-[#888891]">{currentUser.companyEmail || currentUser.email}</p>
          <p className="mt-1 text-xs text-[#888891]">{currentUser.companyPhone || currentUser.phone || "Telefon belirtilmemiş"}</p>
        </div>
        <div className="rounded-2xl border border-[#303036] bg-[#19191E] p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#77777F]">Firma ID</p>
          <p className="mt-2 break-all font-mono text-xs font-bold text-[#D6A84F]">{currentUser.companyId || "Tanımlanmamış"}</p>
          <p className="mt-2 text-xs text-[#888891]">Kurumsal siparişler yalnızca bu firmaya göre listelenir.</p>
        </div>
      </section>
    </div>
  );
};

export default CorporatePanel;
