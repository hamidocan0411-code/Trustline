import React, { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  PenLine,
  User,
} from "lucide-react";

import type { Order } from "../types";

interface Props {
  order: Order;
}

export const DeliveryProofCard: React.FC<Props> = ({
  order,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const proof = order.deliveryProof;

  const receiverName =
    proof?.receiverName ||
    order.receiverName ||
    "";

  const deliveryNote =
    proof?.deliveryNote ||
    order.deliveryNote ||
    "";

  const signature =
    proof?.signature ||
    order.signature ||
    "";

  const deliveryPhoto =
    proof?.deliveryPhoto ||
    order.deliveryPhoto ||
    "";

  const deliveredAt =
    proof?.deliveredAt ||
    order.deliveredAt ||
    "";

  const hasProof =
    !!receiverName ||
    !!deliveryNote ||
    !!signature ||
    !!deliveryPhoto ||
    !!deliveredAt;

  if (!hasProof) {
    return null;
  }

  const formattedDate = deliveredAt
    ? new Date(deliveredAt).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-[#19191E]">
      <button
        type="button"
        onClick={() => setShowDetails((value) => !value)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 size={19} />
          </div>

          <div className="min-w-0">
            <h3 className="text-xs font-bold text-white">
              Teslimat Kanıtı
            </h3>

            <p className="mt-0.5 text-[10px] text-[#999999]">
              Paket teslim edildi
              {deliveredAt
                ? ` • ${formattedDate}`
                : ""}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-[#999999]">
          {showDetails ? (
            <ChevronUp size={17} />
          ) : (
            <ChevronDown size={17} />
          )}
        </div>
      </button>

      {showDetails && (
        <div className="space-y-4 border-t border-[#303036] bg-[#222229] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#303036] bg-[#19191E] p-3">
              <div className="flex items-center gap-2">
                <User
                  size={14}
                  className="text-[#D6A84F]"
                />

                <span className="text-[10px] font-bold uppercase tracking-wider text-[#999999]">
                  Teslim Alan
                </span>
              </div>

              <p className="mt-2 text-xs font-bold text-white">
                {receiverName || "—"}
              </p>
            </div>

            <div className="rounded-xl border border-[#303036] bg-[#19191E] p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2
                  size={14}
                  className="text-emerald-400"
                />

                <span className="text-[10px] font-bold uppercase tracking-wider text-[#999999]">
                  Teslim Tarihi
                </span>
              </div>

              <p className="mt-2 text-xs font-bold text-white">
                {formattedDate}
              </p>
            </div>
          </div>

          {deliveryPhoto && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ImageIcon
                  size={14}
                  className="text-[#D6A84F]"
                />

                <span className="text-[10px] font-bold uppercase tracking-wider text-[#999999]">
                  Teslimat Fotoğrafı
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#303036] bg-[#0F0F12]">
                <img
                  src={deliveryPhoto}
                  alt="Teslimat kanıtı"
                  className="max-h-[420px] w-full object-contain"
                />
              </div>
            </div>
          )}

          {signature && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <PenLine
                  size={14}
                  className="text-[#D6A84F]"
                />

                <span className="text-[10px] font-bold uppercase tracking-wider text-[#999999]">
                  Alıcı İmzası
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#303036] bg-white p-2">
                <img
                  src={signature}
                  alt="Alıcı imzası"
                  className="h-28 w-full object-contain"
                />
              </div>
            </div>
          )}

          {deliveryNote && (
            <div className="rounded-xl border border-[#303036] bg-[#19191E] p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#999999]">
                Teslimat Notu
              </span>

              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                {deliveryNote}
              </p>
            </div>
          )}

          {!deliveryPhoto &&
            !signature &&
            !deliveryNote && (
              <div className="rounded-xl border border-[#303036] bg-[#19191E] p-3 text-center text-[10px] text-[#777777]">
                Teslimat bilgileri mevcut ancak
                görüntülenecek ek kanıt bulunmuyor.
              </div>
            )}
        </div>
      )}
    </div>
  );
};