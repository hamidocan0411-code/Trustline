import React, { useEffect, useState } from "react";
import { AlertCircle, Star } from "lucide-react";

import {
  subscribeToCourierRatingSummary,
  type CourierRatingSummary,
} from "../services/courierRatings";

interface Props {
  courierId: string;
}

export const CourierRatingAdminCard: React.FC<Props> = ({
  courierId,
}) => {
  const [summary, setSummary] =
    useState<CourierRatingSummary>({
      average: 0,
      count: 0,
      total: 0,
    });

  useEffect(() => {
    return subscribeToCourierRatingSummary(
      courierId,
      setSummary
    );
  }, [courierId]);

  const low =
    summary.count > 0 &&
    summary.average < 3;

  return (
    <div
      className={`mt-4 rounded-xl border p-3 ${
        low
          ? "border-red-500/25 bg-red-500/10"
          : "border-[#D6A84F]/10 bg-[#0B0B0D]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {low ? (
            <AlertCircle
              size={15}
              className="text-red-400"
            />
          ) : (
            <Star
              size={15}
              className="text-[#D6A84F]"
              fill="currentColor"
            />
          )}

          <span className="text-[10px] font-bold text-[#777777]">
            Canlı kurye puanı
          </span>
        </div>

        <span
          className={`text-sm font-black ${
            low
              ? "text-red-300"
              : "text-[#D6A84F]"
          }`}
        >
          {summary.count > 0
            ? `${summary.average.toFixed(2)} / 5`
            : "Henüz yok"}
        </span>
      </div>

      <div className="mt-1 text-[9px] text-[#777777]">
        {summary.count > 0
          ? `${summary.count} müşteri değerlendirmesi`
          : "Henüz müşteri değerlendirmesi bulunmuyor."}
      </div>

      {low && (
        <div className="mt-2 text-[9px] font-bold leading-4 text-red-300">
          Düşük puan uyarısı —
          operasyonel değerlendirme gerekli.
        </div>
      )}
    </div>
  );
};
