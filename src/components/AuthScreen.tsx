import React, { useEffect, useRef, useState } from "react";

import { loginWithGoogle } from "../services/auth";

import type { UserProfile } from "../types";

interface AuthScreenProps {
  onLogin?: (profile: UserProfile) => void;
}

function getErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const value = Reflect.get(error, "code");
    return typeof value === "string" ? value : "";
  }
  return "";
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const value = Reflect.get(error, "message");
    return typeof value === "string" ? value : "";
  }
  if (error instanceof Error) return error.message;
  return "";
}

function getAuthErrorMessage(error: unknown): string {
  const code = getErrorCode(error);
  switch (code) {
    case "auth/popup-closed-by-user": return "Google giriş penceresi kapatıldı.";
    case "auth/popup-blocked": return "Google giriş penceresi tarayıcı tarafından engellendi. Lütfen tekrar deneyin.";
    case "auth/cancelled-popup-request": return "Google giriş işlemi iptal edildi. Lütfen tekrar deneyin.";
    case "auth/account-exists-with-different-credential": return "Bu e-posta adresi başka bir giriş yöntemiyle zaten kayıtlı.";
    case "auth/operation-not-allowed": return "Google ile giriş Firebase Console'da etkin değil.";
    case "auth/operation-not-supported-in-this-environment": return "Bu tarayıcıda Google popup kullanılamıyor. Güvenli giriş sayfasına yönlendiriliyorsunuz.";
    case "auth/network-request-failed": return "Firebase bağlantısı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";
    case "auth/unauthorized-domain": return "Bu site Firebase tarafından yetkilendirilmemiş. Firebase Authentication Authorized Domains bölümünü kontrol edin.";
    case "auth/internal-error": return "Firebase'de geçici bir hata oluştu. Lütfen tekrar deneyin.";
    case "auth/too-many-requests": return "Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.";
    case "auth/google-redirect-started": return "Google hesabınız seçildi. Trustline Express'e giriş yapılıyor...";
    case "auth/invalid-api-key": return "Firebase API anahtarı geçersiz.";
    case "auth/app-not-authorized": return "Bu uygulama Firebase tarafından yetkilendirilmemiş.";
    case "auth/invalid-app-credential": return "Firebase uygulama doğrulaması başarısız oldu.";
    case "auth/quota-exceeded": return "Firebase kullanım kotası aşıldı.";
    case "auth/user-disabled": return "Bu Google hesabı devre dışı bırakılmış.";
    default: return getErrorMessage(error) || "Google ile giriş sırasında bir hata oluştu. Lütfen tekrar deneyin.";
  }
}

function getDetailedFirebaseError(error: unknown): string {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);
  if (!code && !message) return "";
  const details: string[] = [];
  if (code) details.push(`Firebase hata kodu: ${code}`);
  if (message && message !== code) details.push(`Firebase mesajı: ${message}`);
  return details.join("\n");
}

const LOGIN_MUSIC_STORAGE_KEY = "trustline_music_enabled";
const LOGIN_MUSIC_SRC = "/audio/trustline-login.mp3";


type ServiceDetail = {
  id: "standard" | "urgent" | "pharmacy" | "corporate";
  icon: string;
  title: string;
  description: string;
  body: string;
  details: string[];
  cta: string;
  ctaHref: string;
};

const SERVICE_DETAILS: ServiceDetail[] = [
  {
    id: "standard",
    icon: "📦",
    title: "Standart Gönderi",
    description: "Günlük gönderileriniz için güvenilir teslimat çözümü.",
    body: "Belge, küçük paket, evrak ve günlük gönderilerinizi güvenli ve planlı şekilde teslim ediyoruz.",
    details: ["Belge ve paket gönderileri", "Günlük bireysel gönderiler", "Adresten teslim alma", "Belirtilen adrese teslimat", "Gönderi takip imkanı", "Güvenli teslimat süreci"],
    cta: "Sipariş Oluştur →",
    ctaHref: "#login",
  },
  {
    id: "urgent",
    icon: "⚡",
    title: "Acil Teslimat",
    description: "Zaman kritik gönderileriniz için hızlı teslimat çözümü.",
    body: "Acil ulaştırılması gereken belge ve paketler için öncelikli teslimat hizmeti sunuyoruz.",
    details: ["Zaman kritik gönderiler", "Öncelikli teslimat", "Hızlı kurye yönlendirmesi", "Belge ve paket gönderileri", "Teslimat süreci takibi", "Hızlı iletişim ve destek"],
    cta: "Acil Teslimat Talebi →",
    ctaHref: "#login",
  },
  {
    id: "pharmacy",
    icon: "💊",
    title: "Eczane Teslimatı",
    description: "Eczane ürünleri için hızlı ve güvenilir teslimat desteği.",
    body: "Eczanelerin müşterilerine ulaştırması gereken uygun gönderiler için hızlı teslimat operasyonu sunuyoruz.",
    details: ["Eczane kaynaklı gönderiler", "Hızlı teslimat", "7/24 operasyon desteği", "Adresten teslim alma", "Belirtilen adrese teslimat", "Teslimat süreci takibi"],
    cta: "Eczane Teslimatı Talebi →",
    ctaHref: "#login",
  },
  {
    id: "corporate",
    icon: "🏢",
    title: "Kurumsal Çözümler",
    description: "İşletmelerin düzenli kurye ihtiyaçları için operasyonel teslimat çözümleri.",
    body: "Düzenli gönderim yapan işletmeler için planlı, takip edilebilir ve işletme ihtiyaçlarına göre şekillendirilebilen kurye hizmetleri sunuyoruz.",
    details: ["Düzenli işletme gönderileri", "Kurumsal kurye desteği", "Planlı teslimatlar", "Çoklu gönderi operasyonları", "Gönderi takibi", "İşletmeye özel operasyon yaklaşımı"],
    cta: "Kurumsal İletişim →",
    ctaHref: "#contact",
  },
];

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<ServiceDetail["id"] | null>(null);
  const selectedService = selectedServiceId ? SERVICE_DETAILS.find((service) => service.id === selectedServiceId) ?? null : null;


  useEffect(() => {
    if (!selectedServiceId) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedServiceId(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [selectedServiceId]);

  useEffect(() => {
    const stored = window.localStorage.getItem(LOGIN_MUSIC_STORAGE_KEY);
    if (stored === "false") setMusicEnabled(false);

    const audio = new Audio(LOGIN_MUSIC_SRC);
    audio.loop = true;
    audio.preload = "none";
    audio.volume = 0;
    audioRef.current = audio;

    const startMusic = () => {
      if (!audioRef.current || !musicEnabled || window.localStorage.getItem(LOGIN_MUSIC_STORAGE_KEY) === "false") return;
      const player = audioRef.current;
      if (!player.paused) return;

      player.volume = 0;
      void player.play().then(() => {
        if (fadeTimerRef.current !== null) window.clearInterval(fadeTimerRef.current);
        const target = 0.1;
        const step = target / 8;
        let volume = 0;
        fadeTimerRef.current = window.setInterval(() => {
          volume = Math.min(target, volume + step);
          player.volume = volume;
          if (volume >= target && fadeTimerRef.current !== null) {
            window.clearInterval(fadeTimerRef.current);
            fadeTimerRef.current = null;
          }
        }, 75);
      }).catch(() => {
        // Browser autoplay policy may reject playback; retry on the next user interaction.
      });
    };

    const handleFirstInteraction = () => startMusic();
    window.addEventListener("pointerdown", handleFirstInteraction, { passive: true });
    window.addEventListener("keydown", handleFirstInteraction);
    window.addEventListener("focusin", handleFirstInteraction);

    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
      window.removeEventListener("focusin", handleFirstInteraction);
      if (fadeTimerRef.current !== null) window.clearInterval(fadeTimerRef.current);
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!musicEnabled) {
      if (fadeTimerRef.current !== null) window.clearInterval(fadeTimerRef.current);
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0;
      window.localStorage.setItem(LOGIN_MUSIC_STORAGE_KEY, "false");
    } else {
      window.localStorage.setItem(LOGIN_MUSIC_STORAGE_KEY, "true");
    }
  }, [musicEnabled]);

  const toggleMusic = () => setMusicEnabled((enabled) => !enabled);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleGoogle = async () => {
    if (loading) return;
    clearMessages();
    setLoading(true);

    try {
      const profile = await loginWithGoogle();
      if (!profile) {
        setSuccess("Google hesabınızla giriş yapılıyor...");
        return;
      }
      setSuccess("Google hesabınızla giriş başarılı.");
      onLogin?.(profile);
    } catch (err) {
      const code = getErrorCode(err);
      const friendlyMessage = getAuthErrorMessage(err);
      const technicalDetails = getDetailedFirebaseError(err);
      if (code === "auth/google-redirect-started") {
        setSuccess("Google hesabınız seçildi. Trustline Express'e giriş yapılıyor...");
        return;
      }
      setError(technicalDetails ? `${friendlyMessage}\n\n${technicalDetails}` : friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] text-white selection:bg-orange-400/30">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-orange-500/10 blur-[140px]" />
        <div className="absolute right-[-12rem] top-[18%] h-[30rem] w-[30rem] rounded-full bg-amber-400/10 blur-[140px]" />
        <div className="absolute bottom-[-12rem] left-[28%] h-[34rem] w-[34rem] rounded-full bg-orange-600/[0.08] blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.055]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.20) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.20) 1px, transparent 1px)", backgroundSize: "72px 72px" }} />
      </div>

      <button
        type="button"
        onClick={toggleMusic}
        aria-label={musicEnabled ? "Login müziğini kapat" : "Login müziğini aç"}
        aria-pressed={musicEnabled}
        className="fixed bottom-4 right-4 z-[60] flex h-9 w-9 items-center justify-center rounded-full border border-orange-300/20 bg-[#0b0b0b]/90 text-orange-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:border-orange-300/40 hover:bg-orange-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/50"
      >
        <span aria-hidden="true" className="text-sm">{musicEnabled ? "♪" : "×"}</span>
      </button>

      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050505]/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="TrustLine Express ana sayfa">
            <img src="https://i.ibb.co/wZpW2m4v/3-E0-E545-B-ADD8-46-F8-A01-F-83-D5-D61-E6-DA5.png" alt="TrustLine Express" className="h-10 w-auto object-contain" loading="eager" />
          </a>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Ana navigasyon">
            <a href="#services" className="text-sm font-semibold text-slate-300 transition hover:text-orange-300">Hizmetlerimiz</a>
            <a href="#how-it-works" className="text-sm font-semibold text-slate-300 transition hover:text-orange-300">Nasıl Çalışır?</a>
            <a href="#corporate" className="text-sm font-semibold text-slate-300 transition hover:text-orange-300">Kurumsal</a>
            <a href="#contact" className="text-sm font-semibold text-slate-300 transition hover:text-orange-300">İletişim</a>
          </nav>
          <div className="flex items-center gap-2">
            <a href="#login" className="hidden rounded-full border border-orange-400/50 px-4 py-2 text-xs font-black text-orange-200 transition hover:border-orange-300 hover:bg-orange-400/10 sm:inline-flex">Giriş Yap</a>
            <a href="#login" className="rounded-full bg-orange-500 px-4 py-2 text-xs font-black text-white shadow-[0_12px_35px_rgba(249,115,22,0.26)] transition hover:-translate-y-0.5 hover:bg-orange-400">Google ile Giriş Yap</a>
          </div>
        </div>
      </header>

      <main id="top" className="relative z-10">
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 backdrop-blur-xl motion-safe:animate-[fadeUp_0.7s_ease-out_both]"><span className="h-2.5 w-2.5 rounded-full bg-orange-400 shadow-[0_0_22px_rgba(251,146,60,0.8)]" /><span className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-200">Güvenli teslimat ağı</span></div>
            <p className="text-xs font-black uppercase tracking-[0.34em] text-orange-300/90">Daha fazla hareket · daha güçlü yarınlar</p>
            <h1 className="mt-5 text-5xl font-black leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">Hızlı.<br />Güvenilir.<br /><span className="text-orange-500">Profesyonel.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">İstanbul'un her noktasında gönderileriniz için güvenilir teslimat çözümü.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#why" className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-6 py-3.5 text-sm font-black text-white shadow-[0_14px_40px_rgba(249,115,22,0.30)] transition hover:-translate-y-0.5 hover:bg-orange-400">Keşfet <span aria-hidden="true">↓</span></a>
              <a href="#login" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-black text-white transition hover:border-orange-300/50 hover:bg-orange-400/10">Google ile Giriş Yap <span aria-hidden="true">→</span></a>
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              {[["01", "Hızlı Teslimat"], ["02", "Güvenli Taşıma"], ["03", "Takip Edilebilir Süreç"]].map(([num, label]) => <div key={num} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">{num}</p><p className="mt-2 text-xs font-bold leading-5 text-slate-200">{label}</p></div>)}
            </div>
          </div>
        </section>

        <section id="why" className="scroll-mt-20 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.3em] text-orange-300">Neden TrustLine Express?</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">Gönderiniz.<br />Bizim sorumluluğumuz.</h2></div><p className="max-w-2xl text-base leading-7 text-slate-400">Teslimat sürecini sadeleştiren, operasyonu merkezileştiren ve müşterinin gönderisini güvenle takip edebilmesini hedefleyen modern bir deneyim.</p></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">{[["⚡", "Hızlı Teslimat", "Gönderilerinizi mümkün olan en kısa sürede doğru noktaya ulaştırmaya odaklanan operasyon akışı."], ["🛡️", "Güvenli Taşıma", "Gönderiniz teslim edilene kadar kontrollü ve takip edilebilir bir teslimat süreci."], ["📍", "Anlık Takip", "Gönderinizin durumunu süreç boyunca daha kolay takip edebileceğiniz bir yapı."]].map(([icon, title, body]) => <article key={title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition duration-300 hover:-translate-y-1 hover:border-orange-400/30 hover:bg-white/[0.055]"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-2xl">{icon}</div><h3 className="mt-5 text-xl font-black text-white">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{body}</p></article>)}</div>
        </section>

        <section id="login" className="scroll-mt-20 border-y border-white/[0.06] bg-gradient-to-r from-orange-500/[0.04] via-transparent to-orange-500/[0.04]">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_520px] lg:items-center lg:px-8 lg:py-24">
            <div><p className="text-xs font-black uppercase tracking-[0.3em] text-orange-300">Devam etmek için giriş yapın</p><h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">Hesabınıza devam edin</h2><p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">TrustLine Express deneyimine devam etmek için Google hesabınızla güvenli şekilde giriş yapın.</p><div className="mt-8 grid gap-3 sm:grid-cols-3">{[["🔐", "Güvenli giriş"], ["🧭", "Kolay erişim"], ["⚡", "Hızlı başlangıç"]].map(([icon, label]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="text-xl">{icon}</div><p className="mt-2 text-xs font-bold text-slate-200">{label}</p></div>)}</div></div>

            <div className="rounded-[32px] border border-orange-400/20 bg-[#0b0b0b] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.48)] sm:p-7">
              <div className="mb-6 flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.24em] text-orange-300">Google ile giriş</p><h3 className="mt-2 text-2xl font-black text-white">Hoş geldin</h3></div><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 text-xl">T</div></div>
              <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm font-black text-slate-100">Tek giriş yöntemi: Google</p><p className="mt-1 text-xs leading-5 text-slate-500">E-posta veya şifre formu yok. Mevcut Google Authentication akışınız aynen korunur.</p></div>
              {error && <div role="alert" className="mb-4 whitespace-pre-line rounded-2xl border border-red-400/20 bg-red-500/[0.08] px-4 py-3.5 text-sm leading-5 text-red-200 motion-safe:animate-[shake_0.35s_ease-in-out]"><div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/15 font-black">!</span><span>{error}</span></div></div>}
              {success && <div role="status" className="mb-4 whitespace-pre-line rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] px-4 py-3.5 text-sm leading-6 text-emerald-200 motion-safe:animate-[popIn_0.35s_ease-out]"><div className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-black">✓</span><span>{success}</span></div></div>}
              <button type="button" onClick={handleGoogle} disabled={loading} className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-orange-400/30 bg-orange-500 px-5 py-4 text-sm font-black text-white shadow-[0_18px_45px_rgba(249,115,22,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-orange-400 hover:shadow-[0_22px_55px_rgba(249,115,22,0.34)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" aria-label="Google ile TrustLine Express'e güvenli giriş yap">
                <span className="absolute inset-0 -translate-x-full skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-[160%]" />
                {loading ? <><span className="relative h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /><span className="relative">Google ile bağlanılıyor...</span></> : <><svg viewBox="0 0 24 24" className="relative h-5 w-5" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.27c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.95 2.94v2.45h3.16c1.85-1.7 2.9-4.2 2.9-7.22Z"/><path fill="#34A853" d="M12 21.7c2.64 0 4.86-.87 6.48-2.36l-3.16-2.45c-.88.59-2 1-3.32 1-2.56 0-4.73-1.73-5.5-4.05H3.23v2.53A9.8 9.8 0 0 0 12 21.7Z"/><path fill="#FBBC05" d="M6.5 13.84A5.9 5.9 0 0 1 6.19 12c0-.64.11-1.27.31-1.84V7.63H3.23A9.8 9.8 0 0 0 2.2 12c0 1.58.38 3.08 1.03 4.37l3.27-2.53Z"/><path fill="#EA4335" d="M12 6.11c1.44 0 2.72.5 3.73 1.48l2.8-2.8C16.85 3.24 14.64 2.3 12 2.3a9.8 9.8 0 0 0-8.77 5.33l3.27 2.53C7.27 7.84 9.44 6.11 12 6.11Z"/></svg><span className="relative">Google ile Giriş Yap</span></>}
              </button>

              <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4"><p className="text-xs font-black text-emerald-200">Güvenli Google girişi</p><p className="mt-1 text-[11px] leading-5 text-emerald-100/60">Mevcut Google giriş akışınız, mobil redirect ve masaüstü popup davranışı değiştirilmeden kullanılır.</p></div>

              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 shadow-[0_12px_35px_rgba(16,185,129,0.06)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-200" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M20.5 3.5A11.9 11.9 0 0 0 12.05 0C5.48 0 .13 5.34.13 11.91c0 2.1.55 4.15 1.6 5.96L.03 24l6.27-1.64a11.9 11.9 0 0 0 5.75 1.47h.01c6.57 0 11.91-5.34 11.91-11.91 0-3.18-1.24-6.17-3.47-8.42ZM12.06 21.84h-.01a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.72.98.99-3.63-.23-.37a9.9 9.9 0 0 1-1.52-5.32C2.16 6.42 6.6 1.98 12.05 1.98c2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.9 7c0 5.45-4.43 9.89-9.88 9.96Zm5.42-7.42c-.3-.15-1.77-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.68-1.64-.93-2.24-.25-.59-.5-.51-.68-.52h-.58c-.2 0-.52.07-.8.37-.28.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z"/></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">TrustLine Express Destek</p>
                    <h4 className="mt-1 text-base font-black text-white">Yardıma mı ihtiyacınız var?</h4>
                    <p className="mt-2 text-xs leading-5 text-slate-400">Sitede bir sorun yaşarsanız veya online sipariş oluşturamazsanız WhatsApp üzerinden bize ulaşabilirsiniz.</p>
                    <p className="mt-2 text-xs leading-5 text-emerald-100/80">Web sitesinden sipariş veremezseniz WhatsApp üzerinden doğrudan destek alabilir ve sipariş verebilirsiniz.</p>
                    <a href="https://wa.me/905514931184?text=Merhaba%20TrustLine%20Express%2C%20web%20sitesi%20%C3%BCzerinden%20destek%20almak%20%2F%20sipari%C5%9F%20vermek%20istiyorum." target="_blank" rel="noopener noreferrer" aria-label="TrustLine Express WhatsApp üzerinden destek al ve sipariş ver" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-100 transition hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-emerald-400/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 sm:w-auto">WhatsApp'tan Destek Al <span aria-hidden="true">→</span></a>
                    <a href="tel:+905514931184" className="mt-2 block text-[11px] font-bold text-slate-500 transition hover:text-emerald-200 focus:outline-none focus-visible:underline" aria-label="TrustLine Express destek telefonunu ara">+90 551 493 11 84</a>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-300">🚚 Standart Kurye</p><p className="mt-1 text-sm font-black text-white">09:00 – 21:00</p></div><div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">💊 Eczane Ürünleri</p><p className="mt-1 text-sm font-black text-emerald-200">7/24</p></div></div>
            </div>
          </div>
        </section>

        <section id="services" className="scroll-mt-20 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.3em] text-orange-300">Hizmetlerimiz</p><h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">İhtiyacınıza uygun teslimat çözümü</h2></div><p className="max-w-xl text-sm leading-6 text-slate-400">Standart gönderiden eczane teslimatına kadar farklı teslimat ihtiyaçlarını aynı deneyimde buluşturuyoruz.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{SERVICE_DETAILS.map((service) => <article key={service.id} className="group rounded-3xl border border-white/10 bg-white/[0.035] p-5 transition duration-300 hover:-translate-y-1 hover:border-orange-400/30 hover:bg-orange-400/[0.04]"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-xl">{service.icon}</div><h3 className="mt-5 text-lg font-black text-white">{service.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{service.description}</p><button type="button" onClick={() => setSelectedServiceId(service.id)} className="mt-5 inline-flex min-h-9 items-center text-xs font-black text-orange-300 transition group-hover:translate-x-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]">Detaylar →</button></article>)}</div></section>

        <section id="brands" className="scroll-mt-20 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-300">Güvenilir iş birlikleri</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
                Çalıştığımız
                <span className="block text-orange-300">Markalar</span>
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">
                Güvenilir iş ortaklarımızla, daha hızlı ve daha güçlü bir teslimat deneyimi sunuyoruz.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  ["🤝", "Güvenilir İş Ortakları"],
                  ["🛡️", "Sürekli Destek"],
                  ["📈", "Daha Güçlü Teslimat Ağı"],
                ].map(([icon, label]) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                    <span aria-hidden="true" className="text-base">{icon}</span>
                    <span className="text-xs font-black leading-5 text-slate-300">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <article className="relative overflow-hidden rounded-[32px] border border-orange-300/20 bg-gradient-to-br from-white/[0.055] via-white/[0.025] to-orange-500/[0.07] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.38)] sm:p-7">
              <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-orange-400/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center rounded-full border border-orange-300/20 bg-orange-400/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-orange-200">
                    ★ İş Ortağımız
                  </span>
                </div>

                <div className="mt-5 flex min-h-[260px] items-center justify-center rounded-[26px] border border-white/10 bg-white p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:min-h-[300px] sm:p-8">
                  <img
                    src="/brands/mavi-reklam.png"
                    alt="Mavi Reklam"
                    loading="lazy"
                    decoding="async"
                    className="h-auto max-h-[210px] w-auto max-w-full object-contain sm:max-h-[240px]"
                  />
                </div>

                <div className="mt-5 flex items-end justify-between gap-5">
                  <div>
                    <h3 className="text-lg font-black text-white">Güçlü markalar, daha güçlü teslimatlar.</h3>
                    <p className="mt-2 max-w-md text-xs leading-5 text-slate-400">
                      İş ortaklarımızla kurduğumuz güçlü operasyon ağı, teslimat süreçlerimizin daha düzenli ilerlemesine katkı sağlar.
                    </p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-y border-white/[0.06] bg-[#080808]"><div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.3em] text-orange-300">Nasıl çalışır?</p><h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">Sadece birkaç adımda gönderiniz yola çıksın.</h2></div><div className="relative mt-14"><div className="absolute left-[8%] right-[8%] top-7 hidden h-px bg-gradient-to-r from-orange-500/10 via-orange-500 to-orange-500/10 lg:block"/><div className="grid gap-8 lg:grid-cols-5">{[["01", "Siparişini oluştur"], ["02", "Kurye atanır"], ["03", "Gönderin teslim alınır"], ["04", "Canlı takip"], ["05", "Güvenli teslimat"]].map(([num, label], index) => <div key={num} className="relative text-center lg:text-left"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-orange-400/40 bg-[#080808] text-sm font-black text-orange-300 shadow-[0_0_30px_rgba(249,115,22,0.12)] lg:mx-0">{index === 0 ? "✦" : num}</div><p className="mt-4 text-sm font-black text-white">{label}</p><p className="mt-2 text-xs leading-5 text-slate-500">Teslimat adımının sıradaki aşaması.</p></div>)}</div></div></div></section>

        <section id="corporate" className="scroll-mt-20 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24"><div className="rounded-[34px] border border-white/10 bg-gradient-to-br from-white/[0.045] via-white/[0.02] to-orange-500/[0.06] p-6 sm:p-8 lg:p-10"><div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.3em] text-orange-300">Kurumsal avantajlar</p><h2 className="mt-4 text-4xl font-black tracking-tight text-white">Güven, teslimatla büyür.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">İşletmelerin düzenli teslimat ihtiyaçlarını daha kontrollü ve izlenebilir bir operasyon deneyimiyle yönetmesine yardımcı olan bir yapı.</p></div><div className="grid gap-3 sm:grid-cols-2">{[["01", "Operasyon odaklı", "Teslimat akışını tek noktadan yönetmeye yardımcı olur."], ["02", "Takip edilebilir", "Süreç boyunca gönderi durumunun izlenmesini destekler."], ["03", "Eczane 7/24", "Eczane ürünleri için günün her saatinde teslimat hizmeti."], ["04", "Mobil uyumlu", "Farklı ekranlarda erişilebilir ve sade kullanım."]].map(([num, title, body]) => <div key={num} className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] font-black tracking-[0.2em] text-orange-300">{num}</p><p className="mt-2 text-sm font-black text-white">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{body}</p></div>)}</div></div></div></section>

        <section id="contact" className="scroll-mt-20 border-t border-white/[0.06] bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.14),transparent_48%)]"><div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28"><p className="text-xs font-black uppercase tracking-[0.3em] text-orange-300">TrustLine Express</p><h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">Gönderiniz hazır mı?</h2><p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">TrustLine Express ile güvenli ve hızlı teslimat deneyimine devam edin.</p><div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row"><a href="#login" className="inline-flex items-center justify-center rounded-full bg-orange-500 px-7 py-3.5 text-sm font-black text-white shadow-[0_18px_45px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-orange-400">Google ile Giriş Yap →</a><a href="#services" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-7 py-3.5 text-sm font-black text-white transition hover:border-orange-300/40 hover:bg-orange-400/10">Hizmetlerimizi Keşfet</a></div></div></section>

      {selectedService && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px] motion-safe:animate-[trustlineModalFadeIn_0.2s_ease-out_both]"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setSelectedServiceId(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-detail-title"
            className="w-full max-w-md overflow-hidden rounded-[28px] border border-orange-300/20 bg-[#0D0D0F] shadow-[0_30px_100px_rgba(0,0,0,0.55)] motion-safe:animate-[trustlineModalScaleIn_0.2s_ease-out_both]"
          >
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-300/15 bg-orange-400/10 text-xl">
                    {selectedService.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">Hizmet detayı</p>
                    <h3 id="service-detail-title" className="mt-1 text-xl font-black text-white">{selectedService.title}</h3>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedServiceId(null)} aria-label="Hizmet detayını kapat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-slate-400 transition hover:border-orange-300/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60">×</button>
              </div>

              <p className="mt-5 text-sm font-semibold leading-6 text-slate-200">{selectedService.description}</p>
              <p className="mt-3 text-xs leading-6 text-slate-400">{selectedService.body}</p>

              <div className="mt-5 space-y-2.5">
                {selectedService.details.map((detail) => (
                  <div key={detail} className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                    <span className="mt-0.5 text-xs font-black text-orange-300">✓</span>
                    <span className="text-xs font-semibold leading-5 text-slate-300">{detail}</span>
                  </div>
                ))}
              </div>

              <a href={selectedService.ctaHref} onClick={() => setSelectedServiceId(null)} className="mt-6 flex min-h-11 items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-xs font-black text-white shadow-[0_12px_30px_rgba(249,115,22,0.2)] transition hover:bg-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/70">
                {selectedService.cta}
              </a>
            </div>
          </div>
        </div>
      )}

      </main>

      <footer className="border-t border-white/[0.06] bg-black/40"><div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><div><img src="https://i.ibb.co/wZpW2m4v/3-E0-E545-B-ADD8-46-F8-A01-F-83-D5-D61-E6-DA5.png" alt="TrustLine Express" className="h-10 w-auto object-contain" loading="lazy"/><p className="mt-3 text-xs leading-5 text-slate-500">Profesyonel kurye ve teslimat hizmeti.</p></div><div className="flex flex-wrap gap-4 text-xs font-bold text-slate-500"><a href="#services" className="transition hover:text-orange-300">Hizmetler</a><a href="#how-it-works" className="transition hover:text-orange-300">Nasıl Çalışır?</a><a href="#corporate" className="transition hover:text-orange-300">Kurumsal</a><a href="#contact" className="transition hover:text-orange-300">İletişim</a></div></div></footer>
    </div>
  );
}
