import React, { useState } from "react";

import {
  Check,
  Loader2,
  User,
  X,
} from "lucide-react";

import type { Order } from "../types";

interface Props {
  order: Order;
  onClose: () => void;
  onSubmit: (data: {
    receiverName: string;
    deliveryNote: string;
    signature: string;
    photoFile?: File;
  }) => Promise<void> | void;
}

export const DeliveryProofModal: React.FC<Props> = ({
  order,
  onClose,
  onSubmit,
}) => {
  const [receiverName, setReceiverName] =
    useState("");

  const [deliveryNote, setDeliveryNote] =
    useState("");

  const [isSaving, setIsSaving] =
    useState(false);

  const handleSubmit = async () => {
    if (!receiverName.trim()) {
      window.alert(
        "Lütfen teslim alan kişinin adını girin."
      );
      return;
    }

    try {
      setIsSaving(true);

      await onSubmit({
        receiverName:
          receiverName.trim(),
        deliveryNote:
          deliveryNote.trim(),
        signature: "",
      });
    } catch (error) {
      console.error(
        "Teslimat bilgileri kaydedilemedi:",
        error
      );

      window.alert(
        "Teslimat bilgileri kaydedilemedi. Lütfen tekrar deneyin."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#303036] bg-[#19191E] shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-[#303036] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-white">
              Teslimatı Tamamla
            </h2>

            <p className="mt-0.5 text-[10px] text-[#999999]">
              Sipariş #{order.id}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl p-2 text-[#999999] transition hover:bg-[#222229] hover:text-white disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <div className="rounded-xl border border-[#D6A84F]/20 bg-[#D6A84F]/10 p-4">
            <div className="flex items-start gap-3">
              <Check
                size={17}
                className="mt-0.5 shrink-0 text-[#D6A84F]"
              />

              <div>
                <p className="text-xs font-bold text-[#D6A84F]">
                  Teslimat doğrulaması
                </p>

                <p className="mt-1 text-[10px] leading-relaxed text-[#BBBBBB]">
                  Alıcı imzası ve teslimat fotoğrafı
                  hizmetleri şu anda devre dışıdır.
                  Teslimat bu bilgiler olmadan
                  tamamlanabilir.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#D6A84F]/25 bg-[#0F0F12] p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#D6A84F]/30 bg-[#D6A84F]/10 text-[#D6A84F]">
              <Check size={22} />
            </div>

            <h3 className="mt-3 text-sm font-extrabold text-white">
              Çok Yakında Hizmette
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-[10px] leading-relaxed text-[#8F8F99]">
              Alıcı imzası ve teslimat fotoğrafı
              özellikleri çok yakında TrustLine
              Express&apos;te hizmete sunulacaktır.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#999999]">
              Teslim Alan Kişi
            </label>

            <div className="relative">
              <User
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777777]"
              />

              <input
                type="text"
                value={receiverName}
                onChange={(event) =>
                  setReceiverName(
                    event.target.value
                  )
                }
                placeholder="Ad Soyad"
                className="w-full rounded-xl border border-[#303036] bg-[#0F0F12] py-3 pl-9 pr-3 text-xs text-white outline-none transition focus:border-[#D6A84F]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#999999]">
              Teslimat Notu
              <span className="ml-1 font-normal normal-case text-[#666666]">
                (İsteğe bağlı)
              </span>
            </label>

            <textarea
              value={deliveryNote}
              onChange={(event) =>
                setDeliveryNote(
                  event.target.value
                )
              }
              rows={3}
              placeholder="Örn: Resepsiyona teslim edildi."
              className="w-full resize-none rounded-xl border border-[#303036] bg-[#0F0F12] px-3 py-3 text-xs text-white outline-none transition focus:border-[#D6A84F]"
            />
          </div>
        </div>

        <div className="border-t border-[#303036] bg-[#19191E] p-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSaving ||
              !receiverName.trim()
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D6A84F] py-3.5 text-xs font-extrabold text-[#0B0B0D] transition hover:bg-[#c49740] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? (
              <>
                <Loader2
                  size={17}
                  className="animate-spin"
                />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Check size={17} />
                Teslimatı Tamamla
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
