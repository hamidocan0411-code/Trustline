import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  PenLine,
  Star,
} from "lucide-react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";

import type { Order } from "../types";
import { storage } from "../services/storage";
import { db } from "../services/firebase";
import {
  getCourierRatingForOrder,
  submitCourierRating,
} from "../services/courierRatings";

interface Props {
  order: Order;
}

export const DeliveryProofCard: React.FC<Props> = ({ order }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const [ratingError, setRatingError] = useState("");
  const [ratingChecked, setRatingChecked] = useState(false);
  const [savedProof, setSavedProof] = useState<{
    receiverName?: string;
    deliveryNote?: string;
    signature?: string;
    deliveryPhoto?: string | null;
    deliveredAt?: string;
  } | null>(null);

  const proof = order.deliveryProof;
  const currentUser = storage.getCurrentUser();

  const canRate = Boolean(
    order.status === "Teslim Edildi" &&
      order.courierId &&
      currentUser?.role === "customer" &&
      currentUser.id === order.customerId
  );

  useEffect(() => {
    let mounted = true;

    const loadSavedProof = async () => {
      try {
        if (!order.id) return;

        const proofQuery = query(
          collection(db, "orders", order.id, "deliveryProofs"),
          orderBy("deliveredAt", "desc"),
          limit(1)
        );

        const snapshot = await getDocs(proofQuery);
        const latest = snapshot.docs[0]?.data();

        if (mounted && latest) {
          setSavedProof({
            receiverName:
              typeof latest.receiverName === "string"
                ? latest.receiverName
                : "",
            deliveryNote:
              typeof latest.deliveryNote === "string"
                ? latest.deliveryNote
                : "",
            signature:
              typeof latest.signature === "string"
                ? latest.signature
                : "",
            deliveryPhoto:
              typeof latest.deliveryPhoto === "string"
                ? latest.deliveryPhoto
                : null,
            deliveredAt:
              typeof latest.deliveredAt === "string"
                ? latest.deliveredAt
                : "",
          });
        }
      } catch (error) {
        console.warn("Teslimat kanıtı yüklenemedi:", error);
      }
    };

    void loadSavedProof();

    return () => {
      mounted = false;
    };
  }, [order.id]);

  useEffect(() => {
    let mounted = true;

    const loadExistingRating = async () => {
      if (!canRate) {
        if (mounted) setRatingChecked(true);
        return;
      }

      try {
        const existing = await getCourierRatingForOrder(order.id);
        if (!mounted) return;
        setRatingDone(Boolean(existing));
      } catch (error) {
        console.error("❌ Mevcut kurye puanı kontrol edilemedi:", error);
      } finally {
        if (mounted) setRatingChecked(true);
      }
    };

    void loadExistingRating();

    return () => {
      mounted = false;
    };
  }, [canRate, order.id]);

  const receiverName =
    proof?.receiverName ||
    savedProof?.receiverName ||
    order.receiverName ||
    "";

  const deliveryNote =
    proof?.deliveryNote ||
    savedProof?.deliveryNote ||
    order.deliveryNote ||
    "";

  const signature =
    proof?.signature ||
    savedProof?.signature ||
    order.signature ||
    "";

  const deliveryPhoto =
    proof?.deliveryPhoto ||
    savedProof?.deliveryPhoto ||
    order.deliveryPhoto ||
    "";

  const deliveredAt =
    proof?.deliveredAt ||
    savedProof?.deliveredAt ||
    order.deliveredAt ||
    "";

  const hasProof = Boolean(
    receiverName || deliveryNote || signature || deliveryPhoto || deliveredAt
  );

  if (!hasProof && !canRate) return null;

  const formattedDate = deliveredAt
    ? new Date(deliveredAt).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const handleSubmitRating = async () => {
    if (!order.courierId) {
      setRatingError("Bu sipariş için kurye bulunamadı.");
      return;
    }

    if (!Number.isInteger(ratingScore) || ratingScore < 1 || ratingScore > 5) {
      setRatingError("Lütfen 1 ile 5 arasında bir puan seçin.");
      return;
    }

    try {
      setRatingSaving(true);
      setRatingError("");

      await submitCourierRating({
        orderId: order.id,
        courierId: order.courierId,
        score: ratingScore,
        comment: ratingComment,
      });

      setRatingDone(true);
    } catch (error) {
      console.error("❌ Kurye puanı kaydedilemedi:", error);
      setRatingError(
        error instanceof Error
          ? error.message
          : "Puan kaydedilemedi. Lütfen tekrar deneyin."
      );
    } finally {
      setRatingSaving(false);
    }
  };

  return (
    <>
      {hasProof && (
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
                <h3 className="text-xs font-bold text-white">Teslimat Kanıtı</h3>
                <p className="mt-0.5 text-[10px] text-[#999999]">
                  Paket teslim edildi
                  {deliveredAt ? ` • ${formattedDate}` : ""}
                </p>
              </div>
            </div>

            <div className="shrink-0 text-[#999999]">
              {showDetails ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </div>
          </button>

          {showDetails && (
            <div className="space-y-3 border-t border-[#303036] bg-[#222229] p-4">
              {receiverName && (
                <div className="rounded-xl border border-[#303036] bg-[#19191E] p-3">
                  <span className="block text-[10px] uppercase tracking-wide text-[#999999]">
                    Teslim Alan
                  </span>
                  <p className="mt-1 text-xs font-bold text-white">{receiverName}</p>
                </div>
              )}

              <div className="rounded-xl border border-[#303036] bg-[#19191E] p-3">
                <span className="block text-[10px] uppercase tracking-wide text-[#999999]">
                  Teslim Tarihi
                </span>
                <p className="mt-1 text-xs font-bold text-white">{formattedDate}</p>
              </div>

              {deliveryPhoto && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <ImageIcon size={14} className="text-[#D6A84F]" />
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
                    <PenLine size={14} className="text-[#D6A84F]" />
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
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">{deliveryNote}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {canRate && ratingChecked && (
        <div className="mt-3 rounded-xl border border-[#303036] bg-[#19191E] p-3">
          <div className="flex items-start gap-3">
            <div
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                ratingDone
                  ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                  : "border-[#D6A84F]/30 bg-[#D6A84F]/10 text-[#D6A84F]"
              }`}
            >
              {ratingDone ? <CheckCircle2 size={18} /> : <Star size={18} />}
            </div>

            <div className="min-w-0 flex-1">
              <span className="block text-[10px] uppercase tracking-wide text-[#999999]">
                {ratingDone ? "Kurye Değerlendirmesi" : "Kuryenizi Değerlendirin"}
              </span>

              {ratingDone ? (
                <h4 className="mt-0.5 text-xs font-bold text-emerald-400">
                  Puanınız kaydedildi. Teşekkür ederiz.
                </h4>
              ) : (
                <>
                  <p className="mt-0.5 text-[10px] text-[#999999]">
                    Teslimat deneyiminizi 1–5 yıldız arasında puanlayın.
                  </p>

                  <div className="mt-3 flex justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRatingScore(value)}
                        aria-label={`${value} yıldız`}
                        className="rounded-xl p-1 transition active:scale-90"
                      >
                        <Star
                          size={30}
                          className={
                            value <= ratingScore
                              ? "text-[#D6A84F]"
                              : "text-[#4C4C53]"
                          }
                          fill={value <= ratingScore ? "currentColor" : "none"}
                        />
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={ratingComment}
                    onChange={(event) => setRatingComment(event.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="İsterseniz kısa bir yorum bırakın..."
                    className="mt-3 w-full resize-none rounded-xl border border-[#303036] bg-[#0B0B0D] px-3 py-2.5 text-xs text-white outline-none transition placeholder:text-[#666666] focus:border-[#D6A84F]"
                  />

                  {ratingError && (
                    <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-2.5 text-[10px] font-semibold leading-4 text-red-300">
                      {ratingError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleSubmitRating()}
                    disabled={ratingSaving || ratingScore < 1}
                    className="mt-3 flex w-full items-center justify-center rounded-xl bg-[#D6A84F] py-3 text-xs font-black text-[#0B0B0D] transition hover:bg-[#E2B866] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {ratingSaving ? "Puan Kaydediliyor..." : "Puanı Kaydet"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
