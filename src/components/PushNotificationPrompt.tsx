import { useEffect, useState } from "react";
import {
  enablePushNotifications,
  getPushPermission,
  isPushSupported,
} from "../services/pushNotifications";

interface PushNotificationPromptProps {
  userId: string;
}

export function PushNotificationPrompt({
  userId,
}: PushNotificationPromptProps) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    let mounted = true;

    void isPushSupported().then((supported) => {
      if (!mounted) return;

      setUnsupported(!supported);
      setVisible(
        supported && getPushPermission() === "default"
      );
    });

    return () => {
      mounted = false;
    };
  }, [userId]);

  if (!visible || unsupported) {
    return null;
  }

  const handleEnable = async () => {
    if (busy) return;

    setBusy(true);

    try {
      const token = await enablePushNotifications(userId);
      if (token) {
        setVisible(false);
      } else if (getPushPermission() === "denied") {
        setVisible(false);
      }
    } catch (error) {
      console.error("FCM bildirimleri aktifleştirilemedi:", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-50 mx-auto max-w-md lg:bottom-5 lg:left-auto lg:right-5">
      <div className="rounded-2xl border border-[#D6A84F]/30 bg-[#17171C]/95 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D6A84F]/25 bg-[#D6A84F]/10 text-[#D6A84F]">
            <span className="text-lg">🔔</span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-white">
              Bildirimleri Aç
            </p>
            <p className="mt-1 text-xs leading-5 text-[#A4A4AD]">
              Yeni siparişler, sipariş durumları ve önemli gelişmelerden
              anında haberdar olun.
            </p>

            <button
              type="button"
              onClick={() => void handleEnable()}
              disabled={busy}
              className="mt-3 rounded-xl bg-[#D6A84F] px-4 py-2 text-xs font-black text-[#0B0B0D] transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? "Aktifleştiriliyor..." : "Şimdi Aktifleştir"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setVisible(false)}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-[#777780] hover:text-white"
            aria-label="Bildirim isteğini kapat"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
