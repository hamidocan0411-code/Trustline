import React, { useState } from 'react';
import { CheckCircle2, Calendar, Clock, User, FileText, Image as ImageIcon, PenTool, X, ZoomIn, ShieldCheck } from 'lucide-react';
import { DeliveryProof, Order } from '../types';

interface DeliveryProofCardProps {
  order: Order;
  className?: string;
}

export const DeliveryProofCard: React.FC<DeliveryProofCardProps> = ({ order, className = '' }) => {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const proof: Partial<DeliveryProof> = order.deliveryProof || {
    receiverName: order.receiverName,
    deliveryNote: order.deliveryNote,
    deliveryPhoto: order.deliveryPhoto,
    signature: order.signature,
    deliveredAt: order.deliveredAt || order.updatedAt,
  };

  const hasProof = Boolean(
    proof.receiverName || proof.signature || proof.deliveryPhoto || order.deliveredAt
  );

  if (!hasProof && order.status !== 'Teslim Edildi') {
    return null;
  }

  const deliveredDate = proof.deliveredAt ? new Date(proof.deliveredAt) : new Date(order.updatedAt);
  const formattedDate = deliveredDate.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = deliveredDate.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      id={`delivery-proof-${order.id}`}
      className={`bg-[#0B0B0D] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#303036] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <span>Teslimat Kanıtı</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Doğrulandı
              </span>
            </h4>
            <p className="text-[11px] text-[#999999]">
              Bu sipariş dijital imza ve teslimat bilgileri ile teslim edilmiştir
            </p>
          </div>
        </div>

        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        {/* Date & Time */}
        <div className="bg-[#19191E] border border-[#303036] p-3 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#222229] flex items-center justify-center text-[#D6A84F] shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-[#999999] uppercase font-bold block">Teslim Tarihi</span>
            <span className="text-white font-medium">{formattedDate}</span>
          </div>
        </div>

        <div className="bg-[#19191E] border border-[#303036] p-3 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#222229] flex items-center justify-center text-[#D6A84F] shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-[#999999] uppercase font-bold block">Teslim Saati</span>
            <span className="text-white font-mono font-medium">{formattedTime}</span>
          </div>
        </div>

        {/* Receiver Name */}
        <div className="bg-[#19191E] border border-[#303036] p-3 rounded-xl flex items-center gap-3 sm:col-span-2">
          <div className="w-8 h-8 rounded-lg bg-[#222229] flex items-center justify-center text-emerald-400 shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-[#999999] uppercase font-bold block">Teslim Alan Kişi</span>
            <span className="text-white font-bold text-sm truncate block">
              {proof.receiverName || order.customerName || 'Alıcı'}
            </span>
          </div>
        </div>

        {/* Delivery Note if present */}
        {proof.deliveryNote && (
          <div className="bg-[#19191E] border border-[#303036] p-3 rounded-xl flex items-start gap-3 sm:col-span-2">
            <div className="w-8 h-8 rounded-lg bg-[#222229] flex items-center justify-center text-[#D6A84F] shrink-0 mt-0.5">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-[#999999] uppercase font-bold block">Teslimat Notu</span>
              <p className="text-slate-300 italic text-xs mt-0.5">"{proof.deliveryNote}"</p>
            </div>
          </div>
        )}
      </div>

      {/* Visual Proofs: Photo & Signature */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Photo Card */}
        <div className="bg-[#19191E] border border-[#303036] rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#999999]">
            <span className="font-bold text-white flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-[#D6A84F]" />
              <span>Teslimat Fotoğrafı</span>
            </span>
            {proof.deliveryPhoto ? (
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-semibold">
                Mevcut
              </span>
            ) : (
              <span className="text-[10px] text-[#666666]">Eklenmedi</span>
            )}
          </div>

          {proof.deliveryPhoto ? (
            <div
              onClick={() => setLightboxImage(proof.deliveryPhoto!)}
              className="relative group rounded-lg overflow-hidden border border-[#303036] bg-[#0B0B0D] aspect-4/3 cursor-pointer"
            >
              <img
                src={proof.deliveryPhoto}
                alt="Teslimat Fotoğrafı"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                <ZoomIn className="w-4 h-4" />
                <span>Büyüt</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#303036] bg-[#0B0B0D]/50 aspect-4/3 flex flex-col items-center justify-center text-[#666666] text-xs p-3 text-center">
              <ImageIcon className="w-6 h-6 mb-1 opacity-40" />
              <span>Fotoğraf yüklenmeden tamamlandı</span>
            </div>
          )}
        </div>

        {/* Signature Card */}
        <div className="bg-[#19191E] border border-[#303036] rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#999999]">
            <span className="font-bold text-white flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-emerald-400" />
              <span>Dijital İmza</span>
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md font-semibold">
              Islak / Dijital
            </span>
          </div>

          {proof.signature ? (
            <div className="relative rounded-lg overflow-hidden border border-[#303036] bg-[#0B0B0D] aspect-4/3 p-2 flex flex-col items-center justify-center">
              <img
                src={proof.signature}
                alt="Teslimat İmzası"
                className="max-w-full max-h-full object-contain filter invert-0 contrast-125"
              />
              <div className="absolute bottom-1 right-2 text-[9px] text-[#666666] font-mono">
                Trustline ID Verified
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#303036] bg-[#0B0B0D]/50 aspect-4/3 flex flex-col items-center justify-center text-[#666666] text-xs p-3 text-center">
              <PenTool className="w-6 h-6 mb-1 opacity-40" />
              <span>İmza kaydı yok</span>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-2xl w-full max-h-[85vh] bg-[#19191E] border border-[#303036] rounded-3xl overflow-hidden p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-[#303036]">
              <h5 className="text-xs font-bold text-white">Teslimat Fotoğrafı (Büyük Görünüm)</h5>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="w-8 h-8 rounded-full bg-[#222229] hover:bg-[#303036] text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center max-h-[70vh] overflow-auto">
              <img
                src={lightboxImage}
                alt="Büyük teslimat fotoğrafı"
                className="max-w-full max-h-[65vh] object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
