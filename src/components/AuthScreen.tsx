import React, { useState } from "react";

import { loginWithGoogle } from "../services/auth";

interface AuthScreenProps {
  onLogin?: () => void;
}

const TRUSTLINE_LOGO =
  "https://i.ibb.co/wZpW2m4v/3-E0-E545-B-ADD8-46-F8-A01-F-83-D5-D61-E6-DA5.png";

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
    clearMessages();
    setLoading(true);

    try {
      console.log("🟡 GOOGLE GİRİŞ BAŞLADI");

      const profile = await loginWithGoogle();

      if (profile) {
        console.log("🟢 GOOGLE GİRİŞ BAŞARILI", profile);

        setSuccess(
          "Google hesabınızla giriş başarılı."
        );

        onLogin?.();
      }
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

      if (
        code === "auth/google-redirect-started"
      ) {
        setSuccess(
          "Google hesabınız seçildi. Trustline Express'e giriş yapılıyor..."
        );

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
      {/* ARKA PLAN */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[120px]" />

        <div className="absolute -bottom-48 -right-40 h-[600px] w-[600px] rounded-full bg-amber-400/10 blur-[140px]" />

        <div className="absolute left-1/2 top-1/2 h-[450px] w-[450px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500/5 blur-[100px]" />

        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "70px 70px",
          }}
        />

        <div className="absolute left-[-10%] top-[24%] h-px w-[120%] rotate-[8deg] bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />

        <div className="absolute left-[-10%] top-[65%] h-px w-[120%] rotate-[-7deg] bg-gradient-to-r from-transparent via-amber-400/10 to-transparent" />

        <div className="absolute left-[10%] top-[40%] h-[1px] w-[80%] rotate-[25deg] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="absolute left-[-20%] top-[28%] h-[2px] w-[35%] rotate-[8deg] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-70 blur-[1px] animate-[routeMove_6s_linear_infinite]" />

        <div className="absolute right-[-20%] top-[67%] h-[2px] w-[35%] rotate-[-7deg] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-60 blur-[1px] animate-[routeMoveReverse_8s_linear_infinite]" />

        <div className="absolute left-[9%] top-[23%] h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.8)] animate-pulse" />

        <div className="absolute right-[14%] top-[31%] h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.8)] animate-pulse [animation-delay:1s]" />

        <div className="absolute left-[18%] bottom-[25%] h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.8)] animate-pulse [animation-delay:2s]" />

        <div className="absolute right-[8%] bottom-[20%] h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.8)] animate-pulse [animation-delay:3s]" />

        <div className="absolute left-[7%] top-[48%] text-4xl opacity-[0.08] animate-bounce">
          📦
        </div>

        <div className="absolute right-[8%] top-[56%] text-4xl opacity-[0.08] animate-bounce [animation-delay:1.5s]">
          📍
        </div>

        <div className="absolute bottom-[12%] left-[43%] text-3xl opacity-[0.06] animate-pulse">
          🛵
        </div>

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(5,7,10,0.35)_45%,rgba(5,7,10,0.95)_100%)]" />
      </div>

      {/* ANA İÇERİK */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[470px]">

          {/* LOGO */}
          <div className="mb-6 text-center">
            <div className="relative mx-auto mb-5 h-24 w-24">
              <div className="absolute inset-[-15px] rounded-[35px] bg-amber-400/10 blur-2xl" />

              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-white/15 bg-white p-2 shadow-[0_0_50px_rgba(245,158,11,0.18)]">
                <img
                  src={TRUSTLINE_LOGO}
                  alt="Trustline Express"
                  className="h-full w-full object-contain"
                  loading="eager"
                  draggable={false}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";

                    const fallback =
                      event.currentTarget
                        .nextElementSibling as HTMLElement | null;

                    if (fallback) {
                      fallback.style.display = "flex";
                    }
                  }}
                />

                <span
                  className="hidden h-full w-full items-center justify-center rounded-2xl bg-slate-950 text-4xl font-black text-amber-400"
                  aria-hidden="true"
                >
                  T
                </span>
              </div>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Trustline{" "}
              <span className="text-amber-400">
                Express
              </span>
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Teslimatın güvenilir adresi
            </p>
          </div>

          {/* SİSTEM DURUMU */}
          <div className="mb-4 flex justify-center">
            <div className="flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2 text-xs font-semibold text-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.05)] backdrop-blur">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />

                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>

              Sistem aktif • Güvenli bağlantı
            </div>
          </div>

          {/* GİRİŞ KARTI */}
          <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.97] shadow-[0_35px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />

            <div className="relative p-6 sm:p-9">

              <div className="mb-8 text-center">
                <div className="mb-2 flex items-center justify-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />

                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-600">
                    Hesap erişimi
                  </p>

                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                </div>

                <h2 className="text-2xl font-black tracking-tight text-slate-950">
                  Trustline Express'e Hoş Geldin
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Hızlı ve güvenli giriş için Google hesabınızla devam edin.
                </p>
              </div>

              {/* HATA */}
              {error && (
                <div
                  role="alert"
                  className="mb-5 whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-5 text-red-700 shadow-sm"
                >
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 font-black">
                      !
                    </span>

                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* BAŞARI */}
              {success && (
                <div
                  role="status"
                  className="mb-5 whitespace-pre-line rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm leading-6 text-emerald-700 shadow-sm"
                >
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-black">
                      ✓
                    </span>

                    <span>{success}</span>
                  </div>
                </div>
              )}

              {/* GOOGLE BUTONU */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-slate-700 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <span className="absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-slate-100/80 to-transparent transition-transform duration-700 group-hover:translate-x-[150%]" />

                {loading ? (
                  <>
                    <span className="relative h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />

                    <span className="relative">
                      Google ile bağlanılıyor...
                    </span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-black shadow-sm">
                      <span className="text-[#4285F4]">
                        G
                      </span>
                    </span>

                    <span className="relative">
                      Google ile devam et
                    </span>
                  </>
                )}
              </button>

              <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-amber-400 shadow-sm">
                    ✓
                  </div>

                  <div>
                    <p className="text-xs font-black text-slate-700">
                      Güvenli Google girişi
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      Google hesabınız ile güvenli şekilde giriş
                      yapabilir ve Trustline Express hesabınıza
                      erişebilirsiniz.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 text-center">
                <p className="text-[11px] leading-5 text-slate-400">
                  Google ile devam ederek Trustline Express
                  hesabınıza güvenli giriş yaparsınız.
                </p>
              </div>
            </div>
          </div>

          {/* ÖZELLİKLER */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center backdrop-blur">
              <div className="text-lg">
                📦
              </div>

              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                Sipariş
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center backdrop-blur">
              <div className="text-lg">
                🛵
              </div>

              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                Kurye
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center backdrop-blur">
              <div className="text-lg">
                📍
              </div>

              <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                Teslimat
              </p>
            </div>
          </div>

          {/* ALT */}
          <div className="mt-6 pb-2 text-center">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} Trustline Express
            </p>

            <p className="mt-1 text-[10px] tracking-wide text-slate-600">
              GÜVENLİ • HIZLI • PROFESYONEL
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes routeMove {
          0% {
            transform: translateX(-30vw) rotate(8deg);
            opacity: 0;
          }

          15% {
            opacity: 0.7;
          }

          70% {
            opacity: 0.45;
          }

          100% {
            transform: translateX(130vw) rotate(8deg);
            opacity: 0;
          }
        }

        @keyframes routeMoveReverse {
          0% {
            transform: translateX(30vw) rotate(-7deg);
            opacity: 0;
          }

          15% {
            opacity: 0.6;
          }

          70% {
            opacity: 0.4;
          }

          100% {
            transform: translateX(-130vw) rotate(-7deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export { AuthScreen };

export default AuthScreen;