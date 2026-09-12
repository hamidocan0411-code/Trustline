import React, { useState } from "react";

import { loginWithGoogle } from "../services/auth";

import type { UserProfile } from "../types";

interface AuthScreenProps {
  onLogin?: (profile: UserProfile) => void;
}

function getErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    const value = Reflect.get(error, "code");

    return typeof value === "string" ? value : "";
  }

  return "";
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const value = Reflect.get(error, "message");

    return typeof value === "string" ? value : "";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "";
}

function getAuthErrorMessage(error: unknown): string {
  const code = getErrorCode(error);

  switch (code) {
    case "auth/popup-closed-by-user":
      return "Google giriş penceresi kapatıldı.";

    case "auth/popup-blocked":
      return "Google giriş penceresi tarayıcı tarafından engellendi. Lütfen tekrar deneyin.";

    case "auth/cancelled-popup-request":
      return "Google giriş işlemi iptal edildi. Lütfen tekrar deneyin.";

    case "auth/account-exists-with-different-credential":
      return "Bu e-posta adresi başka bir giriş yöntemiyle zaten kayıtlı.";

    case "auth/operation-not-allowed":
      return "Google ile giriş Firebase Console'da etkin değil.";

    case "auth/operation-not-supported-in-this-environment":
      return "Bu tarayıcıda Google popup kullanılamıyor. Güvenli giriş sayfasına yönlendiriliyorsunuz.";

    case "auth/network-request-failed":
      return "Firebase bağlantısı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";

    case "auth/unauthorized-domain":
      return "Bu site Firebase tarafından yetkilendirilmemiş. Firebase Authentication Authorized Domains bölümünü kontrol edin.";

    case "auth/internal-error":
      return "Firebase'de geçici bir hata oluştu. Lütfen tekrar deneyin.";

    case "auth/too-many-requests":
      return "Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.";

    case "auth/google-redirect-started":
      return "Google hesabınız seçildi. Trustline Express'e giriş yapılıyor...";

    case "auth/invalid-api-key":
      return "Firebase API anahtarı geçersiz.";

    case "auth/app-not-authorized":
      return "Bu uygulama Firebase tarafından yetkilendirilmemiş.";

    case "auth/invalid-app-credential":
      return "Firebase uygulama doğrulaması başarısız oldu.";

    case "auth/quota-exceeded":
      return "Firebase kullanım kotası aşıldı.";

    case "auth/user-disabled":
      return "Bu Google hesabı devre dışı bırakılmış.";

    default:
      return (
        getErrorMessage(error) ||
        "Google ile giriş sırasında bir hata oluştu. Lütfen tekrar deneyin."
      );
  }
}

function getDetailedFirebaseError(error: unknown): string {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  if (!code && !message) {
    return "";
  }

  const details: string[] = [];

  if (code) {
    details.push(`Firebase hata kodu: ${code}`);
  }

  if (message && message !== code) {
    details.push(`Firebase mesajı: ${message}`);
  }

  return details.join("\n");
}

function AuthScreen({ onLogin }: AuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleGoogle = async () => {
    if (loading) {
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      console.log("🟡 GOOGLE GİRİŞ BAŞLADI");

      const profile = await loginWithGoogle();

      /*
       * MOBİL REDIRECT DURUMU
       *
       * signInWithRedirect() başladıktan sonra Firebase sayfayı
       * Google'a yönlendirir. Bu durumda profile dönmez.
       */
      if (!profile) {
        console.log(
          "🔄 Google redirect başlatıldı veya sonuç bekleniyor."
        );

        setSuccess(
          "Google hesabınızla giriş yapılıyor..."
        );

        /*
         * Burada onLogin çağırmıyoruz.
         *
         * Çünkü Firebase redirect işlemi devam ediyor.
         */
        return;
      }

      console.log(
        "🟢 GOOGLE GİRİŞ BAŞARILI",
        profile
      );

      setSuccess(
        "Google hesabınızla giriş başarılı."
      );

      onLogin?.(profile);
    } catch (err) {
      console.error(
        "❌ GOOGLE AUTHENTICATION ERROR",
        err
      );

      const code = getErrorCode(err);

      const friendlyMessage =
        getAuthErrorMessage(err);

      const technicalDetails =
        getDetailedFirebaseError(err);

      console.error(
        "❌ GOOGLE FIREBASE HATA KODU:",
        code || "YOK"
      );

      console.error(
        "❌ GOOGLE FIREBASE HATA MESAJI:",
        getErrorMessage(err) || "YOK"
      );

      /*
       * ÇOK ÖNEMLİ:
       *
       * Firebase redirect başladıysa bunu hata olarak
       * login ekranına göstermiyoruz.
       */
      if (
        code === "auth/google-redirect-started"
      ) {
        console.log(
          "🔄 GOOGLE REDIRECT BAŞLADI"
        );

        setSuccess(
          "Google hesabınız seçildi. Trustline Express'e giriş yapılıyor..."
        );

        /*
         * Redirect devam ederken loading'i hata gibi
         * göstermemek için burada çıkıyoruz.
         */
        return;
      }

      setError(
        technicalDetails
          ? `${friendlyMessage}\n\n${technicalDetails}`
          : friendlyMessage
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070a] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-amber-400/10 blur-[120px]" />
        <div className="absolute -bottom-48 -right-40 h-[620px] w-[620px] rounded-full bg-amber-500/10 blur-[140px]" />
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.025] blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div className="absolute left-[-15%] top-[23%] h-px w-[130%] rotate-[7deg] bg-gradient-to-r from-transparent via-amber-400/25 to-transparent" />
        <div className="absolute left-[-15%] top-[67%] h-px w-[130%] rotate-[-6deg] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute left-[-20%] top-[28%] h-[2px] w-[32%] rotate-[7deg] bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-70 blur-[1px] motion-safe:animate-[routeMove_7s_linear_infinite]" />
        <div className="absolute right-[-20%] top-[68%] h-[2px] w-[30%] rotate-[-6deg] bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-50 blur-[1px] motion-safe:animate-[routeMoveReverse_9s_linear_infinite]" />
        <span className="absolute left-[8%] top-[22%] h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.8)] motion-safe:animate-pulse" />
        <span className="absolute right-[11%] top-[33%] h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.8)] motion-safe:animate-pulse [animation-delay:1s]" />
        <span className="absolute left-[18%] bottom-[22%] h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.8)] motion-safe:animate-pulse [animation-delay:2s]" />
        <div className="absolute left-[6%] top-[48%] text-4xl opacity-[0.07] motion-safe:animate-bounce">📦</div>
        <div className="absolute right-[6%] top-[55%] text-4xl opacity-[0.07] motion-safe:animate-bounce [animation-delay:1.5s]">📍</div>
        <div className="absolute bottom-[10%] left-[44%] text-3xl opacity-[0.05] motion-safe:animate-pulse">🛵</div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,7,10,0.28)_42%,rgba(5,7,10,0.94)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1380px] items-center px-4 py-6 sm:px-6 lg:px-10">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,520px)] lg:gap-12 xl:gap-16">
          <section className="hidden min-h-[720px] flex-col justify-center lg:flex">
            <div className="max-w-[680px]">
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2.5 backdrop-blur-xl">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
                  TrustLine operasyon ağı
                </span>
              </div>

              <div className="mb-8 flex items-center gap-5">
                <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[24px] border border-white/15 bg-white p-2 shadow-[0_0_55px_rgba(245,158,11,0.18)]">
                  <div className="absolute inset-[-30px] bg-amber-400/10 blur-2xl" />
                  <div className="relative flex h-full w-full items-center justify-center rounded-2xl bg-white">
                    <span className="text-3xl font-black text-slate-950">T</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-300">
                    Trustline
                  </p>
                  <h1 className="mt-1 text-4xl font-black tracking-tight text-white xl:text-6xl">
                    Express
                  </h1>
                </div>
              </div>

              <h2 className="max-w-2xl text-4xl font-black leading-[1.05] tracking-tight text-white xl:text-6xl">
                Teslimatı daha hızlı,
                <span className="block text-amber-400">daha güvenli</span>
                ve daha profesyonel yönetin.
              </h2>

              <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 xl:text-lg">
                Kuryeler, işletmeler ve teslimat süreçleri için modern bir operasyon altyapısı.
                Tek girişten güvenli erişim, kontrollü operasyon ve sürdürülebilir teslimat deneyimi.
              </p>

              <div className="mt-9 grid max-w-xl grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                  <div className="text-xl">📦</div>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-wider text-slate-300">Sipariş</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">Merkezi operasyon</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                  <div className="text-xl">🛵</div>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-wider text-slate-300">Kurye</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">Akıllı yönlendirme</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
                  <div className="text-xl">📍</div>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-wider text-slate-300">Teslimat</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">Takip edilebilir süreç</p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5 text-[10px] font-bold text-emerald-300">Güvenli giriş</span>
                <span className="rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-3 py-1.5 text-[10px] font-bold text-amber-300">Canlı operasyon</span>
                <span className="rounded-full border border-sky-400/20 bg-sky-400/[0.06] px-3 py-1.5 text-[10px] font-bold text-sky-300">Kurumsal altyapı</span>
              </div>
            </div>
          </section>

          <section className="w-full">
            <div className="mb-4 text-center lg:hidden">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/15 bg-white p-2 shadow-[0_0_45px_rgba(245,158,11,0.16)]">
                <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-950">
                  <span className="text-3xl font-black text-amber-400">T</span>
                </div>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white">Trustline <span className="text-amber-400">Express</span></h1>
              <p className="mt-2 text-sm text-slate-400">Teslimatın güvenilir adresi</p>
            </div>

            <div className="mb-4 flex justify-center">
              <div className="flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2 text-[11px] font-bold text-amber-300 backdrop-blur-xl">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                Bakım çalışması sürüyor
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.97] shadow-[0_35px_100px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
              <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />

              <div className="relative p-5 sm:p-7 lg:p-8">
                <div className="mb-7 text-center">
                  <div className="mb-2 flex items-center justify-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-600">Hesap erişimi</p>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-950">Trustline Express'e Hoş Geldin</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">Güvenli erişim için Google hesabınızla devam edin.</p>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-lg text-red-700">⚠</div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-red-800">Önemli bakım duyurusu</p>
                        <p className="mt-1 text-xs leading-5 text-slate-700">
                          Sayfamız 24 saatlik güncelleme ve bakım çalışmasındadır. Siparişlerinizi verirken sorun yaşayabilirsiniz.
                        </p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-slate-800">
                          Buradan sipariş veremiyorsanız,{' '}
                          <a href="https://wa.me/905549515269" target="_blank" rel="noreferrer" className="font-black text-emerald-700 underline decoration-emerald-400 underline-offset-2 transition hover:text-emerald-900">
                            554 951 52 69
                          </a>{' '}
                          numaralı telefona WhatsApp üzerinden ulaşarak gönderinizi oluşturabilirsiniz.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-sm font-black text-amber-700">✦</div>
                      <div>
                        <p className="text-xs font-black text-slate-800">TrustLine Express gelişiyor.</p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">
                          Platformumuz yeni olduğu için zaman zaman küçük teknik aksaklıklarla karşılaşabilirsiniz. Sistemimizi sürekli geliştiriyor, güncelliyor ve sizden gelen geri bildirimlerle daha iyi hale getiriyoruz.
                        </p>
                        <p className="mt-2 text-[11px] font-semibold text-amber-700">Anlayışınız için teşekkür ederiz.</p>
                      </div>
                    </div>
                  </div>

                  <details className="group rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-amber-400">↗</span>
                        <span>
                          <span className="block text-xs font-black text-slate-800">Platformun amacı</span>
                          <span className="mt-0.5 block text-[10px] text-slate-500">TrustLine Express nasıl çalışır?</span>
                        </span>
                      </span>
                      <span className="text-slate-400 transition-transform duration-300 group-open:rotate-180">⌄</span>
                    </summary>
                    <div className="border-t border-slate-200 px-4 pb-4 pt-3">
                      <p className="text-[11px] leading-5 text-slate-500">
                        TrustLine Express'in amacı; kuryeler ile esnafları aynı dijital platform üzerinde buluşturan, güvenli, hızlı ve kurumsal bir teslimat ağı oluşturmaktır.
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        Esnafların ihtiyaç duyduğu güvenilir kurye hizmetine kolayca ulaşmasını, kuryelerin ise düzenli teslimat fırsatlarına erişmesini sağlayarak iki taraf arasında güçlü ve sürdürülebilir bir iş ağı oluşturmayı hedefliyoruz.
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        Gelecekte kurye yönetimi, işletme panelleri, canlı konum takibi ve teslimat süreçlerinin dijital yönetimi gibi birçok özelliği ekleyerek kapsamlı bir teslimat ekosistemi oluşturmayı hedefliyoruz.
                      </p>
                    </div>
                  </details>

                  <details className="group rounded-2xl border border-amber-200 bg-amber-50/70 shadow-sm">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/20 text-sm">🛵</span>
                        <span>
                          <span className="block text-xs font-black text-slate-800">Kuryeler için Çalış, Kazan</span>
                          <span className="mt-0.5 block text-[10px] text-slate-500">Kurye sistemi hakkında bilgi</span>
                        </span>
                      </span>
                      <span className="text-amber-700 transition-transform duration-300 group-open:rotate-180">⌄</span>
                    </summary>
                    <div className="border-t border-amber-200 px-4 pb-4 pt-3">
                      <p className="text-[11px] leading-5 text-slate-500">
                        TrustLine Express'te kurye olmak için platformumuza başvurmanız ve başvuru değerlendirme sürecinin tamamlanması gerekir.
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        Kurye olarak sisteme dahil olduktan sonra teslimatlarınızı kendiniz seçerek ilerlemezsiniz. İşletmeler tarafından oluşturulan teslimat talepleri, TrustLine Express operasyon sistemi tarafından değerlendirilir ve uygun görülen teslimatlar çalışma durumunuza ve operasyonel kriterlere göre yönlendirilir.
                      </p>
                      <p className="mt-2 text-[11px] leading-5 text-slate-500">
                        Amacımız kuryeleri ve esnafları merkezi bir operasyon sistemi içerisinde buluşturmak, kuryelere düzenli teslimat fırsatları sunmak ve gerçekleştirilen teslimatlar üzerinden kazanç elde edilebilen bir çalışma modeli oluşturmaktır.
                      </p>
                      <p className="mt-2 text-[11px] font-semibold leading-5 text-amber-700">Başvur → Değerlendirme → Sisteme Dahil Ol → Teslimatlarını TrustLine Express yönlendirsin.</p>
                    </div>
                  </details>

                  {error && (
                    <div role="alert" className="whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-5 text-red-700 shadow-sm motion-safe:animate-[shake_0.35s_ease-in-out]">
                      <div className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 font-black">!</span>
                        <span>{error}</span>
                      </div>
                    </div>
                  )}

                  {success && (
                    <div role="status" className="whitespace-pre-line rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm leading-6 text-emerald-700 shadow-sm motion-safe:animate-[popIn_0.35s_ease-out]">
                      <div className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-black">✓</span>
                        <span>{success}</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={loading}
                    className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    <span className="absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-slate-100/90 to-transparent transition-transform duration-700 group-hover:translate-x-[150%]" />
                    {loading ? (
                      <>
                        <span className="relative h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
                        <span className="relative">Google ile bağlanılıyor...</span>
                      </>
                    ) : (
                      <>
                        <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-black shadow-sm">
                          <span className="text-[#4285F4]">G</span>
                        </span>
                        <span className="relative">Google ile devam et</span>
                      </>
                    )}
                  </button>

                  <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-amber-400 shadow-sm">✓</div>
                      <div>
                        <p className="text-xs font-black text-slate-700">Güvenli Google girişi</p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">Google hesabınız ile güvenli şekilde giriş yapabilir ve Trustline Express hesabınıza erişebilirsiniz.</p>
                      </div>
                    </div>
                  </div>

                  <p className="pt-1 text-center text-[10px] leading-5 text-slate-400">
                    Google ile devam ederek Trustline Express hesabınıza güvenli giriş yaparsınız.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center backdrop-blur-xl">
                <div className="text-lg">📦</div>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">Sipariş</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center backdrop-blur-xl">
                <div className="text-lg">🛵</div>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">Kurye</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center backdrop-blur-xl">
                <div className="text-lg">📍</div>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">Teslimat</p>
              </div>
            </div>

            <div className="mt-5 pb-2 text-center">
              <p className="text-xs text-slate-500">© {new Date().getFullYear()} Trustline Express</p>
              <p className="mt-1 text-[10px] tracking-wide text-slate-600">GÜVENLİ • HIZLI • PROFESYONEL</p>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        @keyframes routeMove {
          0% { transform: translateX(-35vw) rotate(7deg); opacity: 0; }
          18% { opacity: 0.7; }
          75% { opacity: 0.45; }
          100% { transform: translateX(140vw) rotate(7deg); opacity: 0; }
        }
        @keyframes routeMoveReverse {
          0% { transform: translateX(35vw) rotate(-6deg); opacity: 0; }
          18% { opacity: 0.55; }
          75% { opacity: 0.35; }
          100% { transform: translateX(-140vw) rotate(-6deg); opacity: 0; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          50% { transform: translateX(4px); }
          75% { transform: translateX(-3px); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: translateY(6px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
        }
      `}</style>
    </div>
  );
}

export { AuthScreen };

export default AuthScreen;
