import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  PenTool,
  RotateCcw,
  User,
  FileText,
  ShieldCheck,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { Order } from '../types';
import { storage } from '../services/storage';

interface DeliveryProofModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedOrder: Order) => void;
}

export const DeliveryProofModal: React.FC<DeliveryProofModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const pricing = storage.getPricing();
  const isPhotoRequired = Boolean(pricing.requireDeliveryPhoto);

  // Form state
  const [receiverName, setReceiverName] = useState(order.customerName || '');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveryPhoto, setDeliveryPhoto] = useState<string | null>(null);
  const [isPhotoProcessing, setIsPhotoProcessing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Signature canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnStroke, setHasDrawnStroke] = useState(false);
  const [isSignatureSaved, setIsSignatureSaved] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  // File input refs
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Setup canvas high-DPI scaling
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#D6A84F';
    ctx.lineWidth = 2.5;

    // Draw subtle guide baseline
    ctx.save();
    ctx.strokeStyle = '#303036';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(16, rect.height - 24);
    ctx.lineTo(rect.width - 16, rect.height - 24);
    ctx.stroke();
    ctx.restore();
  };

  useEffect(() => {
    if (isOpen) {
      // Small timeout to ensure modal DOM is mounted and dimensions calculated
      const timer = setTimeout(() => {
        setupCanvas();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Window resize re-alignment
  useEffect(() => {
    const handleResize = () => {
      if (isOpen && !hasDrawnStroke) {
        setupCanvas();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, hasDrawnStroke]);

  // CANVAS DRAWING LOGIC (TOUCH & MOUSE)
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawnStroke(true);
    setIsSignatureSaved(false);

    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      // Auto-update signature data from canvas
      saveSignatureToState();
    }
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setupCanvas();
    setHasDrawnStroke(false);
    setIsSignatureSaved(false);
    setSignatureData(null);
  };

  const saveSignatureToState = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnStroke) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      setSignatureData(dataUrl);
      setIsSignatureSaved(true);
    } catch (err) {
      console.warn('Signature capture error:', err);
    }
  };

  const handleExplicitSaveSignature = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!hasDrawnStroke) return;
    saveSignatureToState();
  };

  // PHOTO CAPTURE & COMPRESSION LOGIC
  const processImageFile = (file: File) => {
    setPhotoError(null);
    setIsPhotoProcessing(true);

    if (!file.type.startsWith('image/')) {
      setPhotoError('Lütfen geçerli bir resim dosyası seçin.');
      setIsPhotoProcessing(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // High quality client compression to max 900x900
        const maxDimension = 900;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const compressCanvas = document.createElement('canvas');
        compressCanvas.width = width;
        compressCanvas.height = height;
        const ctx = compressCanvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = compressCanvas.toDataURL('image/jpeg', 0.72);
          setDeliveryPhoto(compressedDataUrl);
        } else {
          setDeliveryPhoto(event.target?.result as string);
        }
        setIsPhotoProcessing(false);
      };

      img.onerror = () => {
        setPhotoError('Fotoğraf işlenirken bir sorun oluştu.');
        setIsPhotoProcessing(false);
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      setPhotoError('Fotoğraf okunamadı. Lütfen tekrar deneyin.');
      setIsPhotoProcessing(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  // VALIDATION & COMPLETION
  const isFormValid =
    receiverName.trim().length >= 2 &&
    (hasDrawnStroke || Boolean(signatureData)) &&
    (!isPhotoRequired || Boolean(deliveryPhoto));

  const handleCompleteDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Ensure signature data is captured
      let finalSignature = signatureData;
      if (!finalSignature && canvasRef.current && hasDrawnStroke) {
        finalSignature = canvasRef.current.toDataURL('image/png');
      }

      if (!finalSignature) {
        setSubmitError('Lütfen teslim alan kişinin imzasını kaydediniz.');
        setIsSubmitting(false);
        return;
      }

      const updated = storage.completeOrderWithProof(order.id, {
        receiverName: receiverName.trim(),
        deliveryNote: deliveryNote.trim(),
        deliveryPhoto: deliveryPhoto || undefined,
        signature: finalSignature,
      });

      if (updated) {
        onSuccess(updated);
        onClose();
      } else {
        setSubmitError('Sipariş güncellenirken bir hata oluştu.');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Teslimat kanıtı kaydedilemedi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="delivery-proof-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] bg-[#141418] border-t sm:border border-[#303036] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white animate-slideUp sm:animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#303036] bg-[#19191E] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#D6A84F]/20 text-[#D6A84F] flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">Teslimat Kanıtı</h3>
                <span className="font-mono text-xs text-[#D6A84F] font-bold">#{order.id}</span>
              </div>
              <p className="text-[11px] text-[#999999]">
                Teslimatı tamamlamak için bilgileri giriniz
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#222229] hover:bg-[#303036] text-[#999999] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleCompleteDelivery} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {submitError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{submitError}</span>
            </div>
          )}

          {/* 1. TESLİMAT FOTOĞRAFI */}
          <div className="bg-[#19191E] border border-[#303036] rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#D6A84F]" />
                <span>1. Teslimat Fotoğrafı</span>
              </label>
              {isPhotoRequired ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  * Zorunlu Alan
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#222229] text-[#888888]">
                  İsteğe Bağlı
                </span>
              )}
            </div>

            <p className="text-[11px] text-[#999999]">
              Paketin teslim edildiği yeri, binayı veya teslim anını fotoğraflayın.
            </p>

            {/* Hidden file inputs: one with capture for camera, one standard for gallery */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              onChange={handleFileInputChange}
              className="hidden"
            />
            <input
              type="file"
              accept="image/*"
              ref={galleryInputRef}
              onChange={handleFileInputChange}
              className="hidden"
            />

            {deliveryPhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-emerald-500/40 bg-[#0B0B0D] group">
                <img
                  src={deliveryPhoto}
                  alt="Çekilen Teslimat Fotoğrafı"
                  className="w-full h-44 object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-emerald-500/90 text-[#0B0B0D] font-extrabold text-[10px] flex items-center gap-1 shadow-md">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Fotoğraf Hazır</span>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-[#222229]/90 hover:bg-[#303036] text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#D6A84F]" />
                    <span>Yeniden Çek</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryPhoto(null)}
                    className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-300 transition-colors cursor-pointer"
                    title="Fotoğrafı Kaldır"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isPhotoProcessing}
                  className="min-h-[48px] py-3 px-3 rounded-xl bg-[#222229] hover:bg-[#D6A84F] hover:text-[#0B0B0D] border border-[#303036] hover:border-[#D6A84F] text-white font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Camera className="w-4 h-4 text-[#D6A84F] group-hover:text-[#0B0B0D]" />
                  <span>Kamera İle Çek</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isPhotoProcessing}
                  className="min-h-[48px] py-3 px-3 rounded-xl bg-[#222229] hover:bg-[#303036] border border-[#303036] text-white font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Galeriden Seç</span>
                </button>
              </div>
            )}

            {photoError && (
              <div className="text-[11px] text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{photoError}</span>
              </div>
            )}
          </div>

          {/* 2. TESLİM ALAN KİŞİ */}
          <div className="bg-[#19191E] border border-[#303036] rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-white flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-400" />
                <span>2. Teslim Alan Kişi *</span>
              </label>
              <span className="text-[10px] text-emerald-400 font-bold">Zorunlu</span>
            </div>

            <input
              type="text"
              required
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Teslim alan kişi adı ve soyadı"
              className="w-full bg-[#0B0B0D] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3.5 py-3 text-sm text-white font-medium focus:outline-hidden"
            />

            {/* Quick Suggestions Chips for Fast Mobile Entry */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {[order.customerName, 'Güvenlik Görevlisi', 'Bina Danışma', 'Aile Bireyi', 'Komşu'].filter(Boolean).map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setReceiverName(chip!)}
                  className="px-2.5 py-1 rounded-lg bg-[#222229] hover:bg-[#303036] text-[#999999] hover:text-white border border-[#303036]/60 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>

          {/* 3. TESLİM NOTU */}
          <div className="bg-[#19191E] border border-[#303036] rounded-2xl p-3.5 space-y-2">
            <label className="font-bold text-white flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#D6A84F]" />
              <span>3. Teslim Notu</span>
            </label>

            <textarea
              rows={2}
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder="Örn: Mehmet Bey'e kapıda elden sağlam şekilde teslim edildi."
              className="w-full bg-[#0B0B0D] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#666666] focus:outline-hidden resize-none"
            />

            {/* Quick Note Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'Kapıda elden teslim edildi.',
                'Güvenliğe bırakıldı.',
                'Alıcının kendisine teslim edildi.',
                'İmza karşılığı teslim edildi.',
              ].map((noteText) => (
                <button
                  key={noteText}
                  type="button"
                  onClick={() => setDeliveryNote(noteText)}
                  className="px-2 py-0.5 rounded-md bg-[#222229] hover:bg-[#303036] text-[#999999] hover:text-white text-[10px] transition-colors cursor-pointer"
                >
                  {noteText}
                </button>
              ))}
            </div>
          </div>

          {/* 4. DİJİTAL İMZA ALANI */}
          <div className="bg-[#19191E] border border-[#303036] rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-white flex items-center gap-1.5">
                <PenTool className="w-4 h-4 text-emerald-400" />
                <span>4. Dijital İmza *</span>
              </label>

              {isSignatureSaved ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>İmza Kaydedildi</span>
                </span>
              ) : hasDrawnStroke ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                  İmza Çizildi
                </span>
              ) : (
                <span className="text-[10px] text-emerald-400 font-bold">Zorunlu</span>
              )}
            </div>

            <p className="text-[11px] text-[#999999]">
              Lütfen teslim alan kişiye telefon ekranını uzatarak parmağıyla imza atmasını isteyin.
            </p>

            {/* Signature Canvas Box with touch-action: none */}
            <div className="relative rounded-xl border border-[#303036] bg-[#0B0B0D] overflow-hidden">
              <canvas
                ref={canvasRef}
                className="w-full h-36 block cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />

              {!hasDrawnStroke && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-[#555555] text-xs">
                  <PenTool className="w-5 h-5 mb-1 opacity-30" />
                  <span>İmza için bu alana dokunup çizin</span>
                </div>
              )}
            </div>

            {/* Signature Control Buttons: "İmzayı Temizle" & "İmzayı Kaydet" */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleClearSignature}
                disabled={!hasDrawnStroke}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  hasDrawnStroke
                    ? 'bg-[#222229] hover:bg-red-500/20 text-red-400 hover:text-red-300 border-[#303036]'
                    : 'bg-[#222229]/50 text-[#555555] border-transparent cursor-not-allowed'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>İmzayı Temizle</span>
              </button>

              <button
                type="button"
                onClick={handleExplicitSaveSignature}
                disabled={!hasDrawnStroke}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  hasDrawnStroke
                    ? isSignatureSaved
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] shadow-md shadow-[#D6A84F]/10'
                    : 'bg-[#222229] text-[#555555] cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isSignatureSaved ? 'İmza Onaylandı' : 'İmzayı Kaydet'}</span>
              </button>
            </div>
          </div>

          {/* Validation Feedback Warning if disabled */}
          {!isFormValid && (
            <div className="p-3 rounded-xl bg-[#222229] border border-[#303036] text-[11px] text-[#999999] space-y-1">
              <span className="font-bold text-white block">Teslimatın tamamlanması için:</span>
              {receiverName.trim().length < 2 && (
                <div className="flex items-center gap-1.5 text-amber-400">
                  <span>•</span>
                  <span>Teslim alan kişinin adını giriniz.</span>
                </div>
              )}
              {!hasDrawnStroke && (
                <div className="flex items-center gap-1.5 text-amber-400">
                  <span>•</span>
                  <span>Dijital imza alanına imza attırınız.</span>
                </div>
              )}
              {isPhotoRequired && !deliveryPhoto && (
                <div className="flex items-center gap-1.5 text-amber-400">
                  <span>•</span>
                  <span>Teslimat fotoğrafı yükleyiniz (Admin ayarlarında zorunlu kılınmıştır).</span>
                </div>
              )}
            </div>
          )}

          {/* TESLİMATI TAMAMLA BUTTON */}
          <div className="pt-2 sticky bottom-0 bg-[#141418] pb-1">
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`w-full min-h-[54px] py-3.5 px-5 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all shadow-xl cursor-pointer ${
                isFormValid && !isSubmitting
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-emerald-500/20 active:scale-98'
                  : 'bg-[#222229] text-[#666666] border border-[#303036] cursor-not-allowed opacity-70'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Teslimat Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Teslimatı Tamamla</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
