import React, { useEffect } from "react";

const WHATSAPP_URL =
  "https://wa.me/905514931184?text=Merhaba%20TrustLine%20Express%2C%20kurumsal%20teklif%20hakkında%20bilgi%20almak%20istiyorum.";

export function CorporateOfferModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 backdrop-blur-md motion-safe:animate-[trustlineModalFadeIn_0.2s_ease-out_both] sm:p-5"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="corporate-offer-title"
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[30px] border border-orange-300/20 bg-[#0D0D0F] shadow-[0_35px_120px_rgba(0,0,0,0.65)] motion-safe:animate-[trustlineModalScaleIn_0.2s_ease-out_both]"
      >
        <div className="shrink-0 border-b border-white/[0.07] bg-gradient-to-r from-orange-500/[0.08] via-transparent to-orange-500/[0.04] px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-300">Trustline Express</p>
              <h2 id="corporate-offer-title" className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Kurumsal Çözümler
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                İşletmenizin günlük teslimat süreçlerini daha düzenli, hızlı ve profesyonel şekilde yönetmenize yardımcı oluyoruz.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kurumsal teklif bilgilendirmesini kapat"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xl text-slate-400 transition hover:border-orange-300/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <section>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-orange-300">Kurumsal firmalara özel çözümler</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "Düzenli kurye ihtiyaçları",
                "Günlük ve yoğun teslimat operasyonları",
                "Evrak, paket ve ürün teslimatları",
                "İşletmelere özel sipariş yönetimi",
                "Gönderi takibi",
                "Aktif teslimatların takibi",
                "Kurumsal panel üzerinden sipariş yönetimi",
                "İşletmeye uygun operasyon planlaması",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                  <span className="mt-0.5 text-xs font-black text-orange-300">✓</span>
                  <span className="text-xs font-semibold leading-5 text-slate-300">{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-7 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-orange-300">Kurumsal müşteriler için özel panel</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "Sipariş oluşturma",
                "Siparişleri takip etme",
                "Aktif teslimatları görüntüleme",
                "Tamamlanan siparişleri takip etme",
                "Firma bilgilerini yönetme",
                "Bildirimleri görüntüleme",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-xs font-semibold text-slate-300">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-400/10 text-orange-300">✓</span>
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-7">
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-orange-300">Kimler için?</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                "E-ticaret işletmeleri",
                "Mağazalar",
                "Ofisler",
                "Kurumsal firmalar",
                "Düzenli kurye ihtiyacı olan işletmeler",
                "Evrak / ürün / paket gönderimi yapan işletmeler",
              ].map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/[0.035] px-3.5 py-2 text-[11px] font-bold text-slate-300">
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className="mt-7">
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-orange-300">Teklif süreci</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {[
                ["01", "İhtiyacınızı paylaşın"],
                ["02", "Teslimat ihtiyaçlarını değerlendirelim"],
                ["03", "Uygun kurumsal çözümü görüşelim"],
                ["04", "WhatsApp üzerinden iletişime geçin"],
              ].map(([number, text]) => (
                <div key={number} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                  <span className="text-[10px] font-black tracking-[0.2em] text-orange-300">{number}</span>
                  <p className="mt-2 text-xs font-bold leading-5 text-white">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-7 rounded-[26px] border border-orange-300/20 bg-gradient-to-br from-orange-500/[0.10] via-orange-500/[0.04] to-transparent p-5 sm:p-6">
            <p className="text-sm font-black text-white">Kurumsal iş birliği hakkında bilgi almak ister misiniz?</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              İşletmenize özel teslimat ihtiyaçlarını konuşmak ve kurumsal teklif oluşturmak için bizimle iletişime geçin.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3 text-xs font-black text-[#07130B] shadow-[0_15px_40px_rgba(37,211,102,0.16)] transition hover:-translate-y-0.5 hover:bg-[#3BE477] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/70"
              >
                <span aria-hidden="true">◉</span>
                WhatsApp'tan İletişime Geçin
              </a>
              <a
                href="tel:+905514931184"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-3 text-xs font-black text-white transition hover:border-orange-300/30 hover:text-orange-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60"
              >
                +90 551 493 11 84
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default CorporateOfferModal;
