import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  MessageSquareText,
  Star,
  User,
} from "lucide-react";

import type { CourierRating } from "../types";
import { subscribeToAllCourierRatings } from "../services/courierRatings";

interface Props {
  courierId: string;
}

const formatDate = (value?: string) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Stars: React.FC<{ score: number }> = ({ score }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }).map((_, index) => {
      const active = index + 1 <= score;

      return (
        <Star
          key={index}
          size={13}
          className={
            active
              ? "text-[#D6A84F]"
              : "text-[#4A4A52]"
          }
          fill={
            active
              ? "currentColor"
              : "none"
          }
        />
      );
    })}
  </div>
);

export const CourierRatingAdminDetails: React.FC<Props> = ({
  courierId,
}) => {
  const [ratings, setRatings] =
    useState<CourierRating[]>([]);

  useEffect(() => {
    return subscribeToAllCourierRatings(
      (allRatings) => {
        setRatings(
          allRatings.filter(
            (rating) =>
              rating.courierId ===
              courierId
          )
        );
      }
    );
  }, [courierId]);

  const orderedRatings = useMemo(
    () =>
      [...ratings].sort(
        (a, b) =>
          new Date(
            b.createdAt
          ).getTime() -
          new Date(
            a.createdAt
          ).getTime()
      ),
    [ratings]
  );

  const average =
    ratings.length > 0
      ? Number(
          (
            ratings.reduce(
              (sum, rating) =>
                sum +
                Number(
                  rating.score || 0
                ),
              0
            ) / ratings.length
          ).toFixed(2)
        )
      : 0;

  const lowRating =
    ratings.length > 0 &&
    average < 3;

  return (
    <div
      className={`mt-5 overflow-hidden rounded-2xl border ${
        lowRating
          ? "border-red-500/25 bg-red-500/[0.05]"
          : "border-[#303036] bg-[#19191E]"
      }`}
    >
      <div className="border-b border-[#303036] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {lowRating ? (
              <AlertCircle
                size={17}
                className="text-red-400"
              />
            ) : (
              <Star
                size={17}
                className="text-[#D6A84F]"
                fill="currentColor"
              />
            )}

            <div>
              <h3 className="text-sm font-bold text-white">
                Kurye değerlendirmeleri
              </h3>

              <p className="mt-0.5 text-[10px] text-[#777777]">
                Müşteri puanları ve yorumları
              </p>
            </div>
          </div>

          <div className="text-right">
            <div
              className={`text-lg font-black ${
                lowRating
                  ? "text-red-300"
                  : "text-[#D6A84F]"
              }`}
            >
              {ratings.length > 0
                ? `${average.toFixed(
                    2
                  )} / 5`
                : "—"}
            </div>

            <div className="text-[9px] text-[#777777]">
              {ratings.length} değerlendirme
            </div>
          </div>
        </div>

        {lowRating && (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-[10px] font-semibold leading-5 text-red-300">
            Bu kuryenin ortalama puanı
            3.00 altında. Operasyonel
            değerlendirme önerilir.
          </div>
        )}
      </div>

      {orderedRatings.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-7 text-center text-[#777777]">
          <MessageSquareText
            size={22}
            className="text-[#55555C]"
          />

          <p className="text-xs font-semibold text-[#999999]">
            Henüz müşteri değerlendirmesi yok.
          </p>

          <p className="max-w-xs text-[10px] leading-relaxed">
            Kurye teslimatları sonrasında
            verilen yıldız ve yorumlar burada
            canlı olarak görünecek.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#303036]">
          {orderedRatings.map(
            (rating) => {
              const score =
                Number(
                  rating.score || 0
                );

              const comment =
                typeof rating.comment ===
                "string"
                  ? rating.comment.trim()
                  : "";

              return (
                <div
                  key={
                    rating.id ||
                    rating.orderId
                  }
                  className="p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                        <User size={15} />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white">
                          {rating.customerName ||
                            "Müşteri"}
                        </p>

                        <p className="mt-0.5 truncate font-mono text-[9px] text-[#66666F]">
                          Sipariş #
                          {rating.orderId}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <Stars score={score} />

                      <p className="mt-1 text-[9px] text-[#777777]">
                        {formatDate(
                          rating.createdAt
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-[#303036] bg-[#0B0B0D] p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[#777777]">
                      <MessageSquareText size={12} />
                      Müşteri yorumu
                    </div>

                    <p className="text-xs leading-5 text-slate-300">
                      {comment ||
                        "Müşteri yorum yazmamış."}
                    </p>
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
};