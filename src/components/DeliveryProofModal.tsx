import React, {
  useRef,
  useState,
} from "react";

import {
  Camera,
  Check,
  Eraser,
  Image as ImageIcon,
  Loader2,
  PenLine,
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

export const DeliveryProofModal: React.FC<
  Props
> = ({
  order,
  onClose,
  onSubmit,
}) => {
  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [receiverName, setReceiverName] =
    useState("");

  const [deliveryNote, setDeliveryNote] =
    useState("");

  const [photoFile, setPhotoFile] =
    useState<File | undefined>();

  const [photoPreview, setPhotoPreview] =
    useState<string | null>(null);

  const [isSaving, setIsSaving] =
    useState(false);

  const [isDrawing, setIsDrawing] =
    useState(false);

  const [hasSignature, setHasSignature] =
    useState(false);

  const getCanvasPoint = (
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect =
      canvas.getBoundingClientRect();

    if (
      "touches" in event &&
      event.touches.length > 0
    ) {
      return {
        x:
          event.touches[0].clientX -
          rect.left,
        y:
          event.touches[0].clientY -
          rect.top,
      };
    }

    if (
      "changedTouches" in event &&
      event.changedTouches.length > 0
    ) {
      return {
        x:
          event.changedTouches[0].clientX -
          rect.left,
        y:
          event.changedTouches[0].clientY -
          rect.top,
      };
    }

    return {
      x:
        (event as React.MouseEvent)
          .clientX - rect.left,
      y:
        (event as React.MouseEvent)
          .clientY - rect.top,
    };
  };

  const startDrawing = (
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    event.preventDefault();

    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const point =
      getCanvasPoint(event);

    const context =
      canvas.getContext("2d");

    if (!context) return;

    context.beginPath();
    context.moveTo(
      point.x,
      point.y
    );

    setIsDrawing(true);
  };

  const draw = (
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    event.preventDefault();

    if (!isDrawing) return;

    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const point =
      getCanvasPoint(event);

    const context =
      canvas.getContext("2d");

    if (!context) return;

    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111111";

    context.lineTo(
      point.x,
      point.y
    );

    context.stroke();

    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const context =
      canvas.getContext("2d");

    if (!context) return;

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    setHasSignature(false);
  };

  const handlePhotoChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      window.alert(
        "Lütfen geçerli bir fotoğraf seçin."
      );

      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      window.alert(
        "Fotoğraf boyutu en fazla 10 MB olabilir."
      );

      return;
    }

    setPhotoFile(file);

    const reader =
      new FileReader();

    reader.onload = () => {
      setPhotoPreview(
        typeof reader.result ===
          "string"
          ? reader.result
          : null
      );
    };

    reader.readAsDataURL(file);
  };

  const getSignatureData = () => {
    const canvas =
      canvasRef.current;

    if (
      !canvas ||
      !hasSignature
    ) {
      return "";
    }

    return canvas.toDataURL(
      "image/png"
    );
  };

  const handleSubmit = async () => {
    if (!receiverName.trim()) {
      window.alert(
        "Lütfen teslim alan kişinin adını girin."
      );

      return;
    }

    if (!hasSignature) {
      window.alert(
        "Lütfen alıcı imzasını alın."
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
        signature:
          getSignatureData(),
        photoFile,
      });
    } catch (error) {
      console.error(
        "Teslimat kanıtı kaydedilemedi:",
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
          <div className="rounded-xl border border-[#D6A84F]/20 bg-[#D6A84F]/10 p-3">
            <div className="flex items-start gap-2">
              <Check
                size={16}
                className="mt-0.5 shrink-0 text-[#D6A84F]"
              />

              <div>
                <p className="text-xs font-bold text-[#D6A84F]">
                  Teslimat doğrulaması
                </p>

                <p className="mt-1 text-[10px] leading-relaxed text-[#BBBBBB]">
                  Teslimatı kapatmak için
                  alıcı adı ve imza
                  zorunludur. Fotoğraf
                  eklemek isteğe bağlıdır.
                </p>
              </div>
            </div>
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
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#999999]">
                Alıcı İmzası
              </label>

              <button
                type="button"
                onClick={clearSignature}
                disabled={!hasSignature}
                className="flex items-center gap-1 text-[10px] text-[#999999] transition hover:text-white disabled:opacity-30"
              >
                <Eraser size={12} />
                Temizle
              </button>
            </div>

            <div className="pointer-events-none overflow-hidden rounded-xl border border-[#303036] bg-white opacity-50">
              <canvas
                ref={canvasRef}
                width={800}
                height={260}
                className="h-36 w-full touch-none"
                onMouseDown={
                  startDrawing
                }
                onMouseMove={draw}
                onMouseUp={
                  stopDrawing
                }
                onMouseLeave={
                  stopDrawing
                }
                onTouchStart={
                  startDrawing
                }
                onTouchMove={draw}
                onTouchEnd={
                  stopDrawing
                }
              />
            </div>

            {!hasSignature && (
              <p className="mt-1.5 flex items-center gap-1 text-[9px] text-[#777777]">
                <PenLine size={11} />
                Parmağınızla veya
                mouse ile imza atın.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#999999]">
              Teslimat Fotoğrafı
              <span className="ml-1 font-normal normal-case text-[#666666]">
                (İsteğe bağlı)
              </span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={
                handlePhotoChange
              }
              className="hidden"
            />

            {photoPreview ? (
              <div className="relative overflow-hidden rounded-xl border border-[#303036] bg-[#0F0F12]">
                <img
                  src={photoPreview}
                  alt="Teslimat fotoğrafı"
                  className="max-h-56 w-full object-contain"
                />

                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(
                      undefined
                    );
                    setPhotoPreview(
                      null
                    );

                    if (
                      fileInputRef.current
                    ) {
                      fileInputRef.current.value =
                        "";
                    }
                  }}
                  className="absolute right-2 top-2 rounded-lg bg-black/70 p-2 text-white backdrop-blur-sm"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                className="pointer-events-none flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#404047] bg-[#0F0F12] py-6 text-xs font-semibold text-[#999999] opacity-50"
              >
                <Camera size={18} />
                Fotoğraf Çek / Seç
              </button>
            )}
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

          {photoFile && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-[10px] text-emerald-400">
              <ImageIcon size={15} />

              <span className="truncate">
                {photoFile.name}
              </span>

              <span className="ml-auto shrink-0 text-[#777777]">
                {(
                  photoFile.size /
                  1024 /
                  1024
                ).toFixed(1)}{" "}
                MB
              </span>
            </div>
          )}
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
