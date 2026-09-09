import React, {
  useEffect,
  useState,
} from "react";

import {
  loginUser,
  loginWithGoogle,
  registerUser,
} from "../services/auth";

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

    return typeof value === "string"
      ? value
      : "";
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

    return typeof value === "string"
      ? value
      : "";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "";
}

function getAuthErrorMessage(
  error: unknown
): string {
  const code = getErrorCode(error);

  switch (code) {
    case "auth/email-verification-required":
      return "Hesabınız oluşturuldu. E-posta adresinize bir doğrulama bağlantısı gönderdik. E-postanızı doğruladıktan sonra giriş yapabilirsiniz.";

    case "auth/email-not-verified":
      return "E-posta adresiniz henüz doğrulanmamış. E-postanıza gönderilen doğrulama bağlantısına tıklayın.";

    case "auth/invalid-credential":
      return "Firebase giriş bilgilerini kabul etmedi.";

    case "auth/wrong-password":
      return "Şifre hatalı.";

    case "auth/user-not-found":
      return "Bu e-posta adresiyle kayıtlı bir kullanıcı bulunamadı.";

    case "auth/email-already-in-use":
      return "Bu e-posta adresi zaten kayıtlı.";

    case "auth/invalid-email":
      return "Geçerli bir e-posta adresi girin.";

    case "auth/weak-password":
      return "Şifre en az 6 karakter olmalıdır.";

    case "auth/password-does-not-meet-requirements":
      return "Şifre Firebase güvenlik gereksinimlerini karşılamıyor.";

    case "auth/popup-closed-by-user":
      return "Google giriş penceresi kapatıldı.";

    case "auth/popup-blocked":
      return "Google giriş penceresi tarayıcı tarafından engellendi. Tekrar deneyin.";

    case "auth/cancelled-popup-request":
      return "Google giriş işlemi iptal edildi. Lütfen tekrar deneyin.";

    case "auth/account-exists-with-different-credential":
      return "Bu e-posta başka bir giriş yöntemiyle zaten kayıtlı.";

    case "auth/operation-not-allowed":
      return "Bu giriş yöntemi Firebase Console'da etkin değil.";

    case "auth/operation-not-supported-in-this-environment":
      return "Bu tarayıcıda Google popup kullanılamıyor. Güvenli giriş sayfasına yönlendiriliyorsunuz.";

    case "auth/network-request-failed":
      return "Firebase bağlantısı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.";

    case "auth/unauthorized-domain":
      return "Bu site Firebase tarafından yetkilendirilmemiş.";

    case "auth/internal-error":
      return "Firebase'de geçici bir hata oluştu.";

    case "auth/too-many-requests":
      return "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.";

    case "auth/google-redirect-started":
      return "Google giriş sayfasına yönlendiriliyorsunuz...";

    case "auth/invalid-api-key":
      return "Firebase API anahtarı geçersiz.";

    case "auth/app-not-authorized":
      return "Bu uygulama Firebase tarafından yetkilendirilmemiş.";

    case "auth/invalid-app-credential":
      return "Firebase uygulama doğrulaması başarısız oldu.";

    case "auth/quota-exceeded":
      return "Firebase kullanım kotası aşıldı.";

    case "auth/user-disabled":
      return "Bu kullanıcı hesabı devre dışı bırakılmış.";

    default:
      return (
        getErrorMessage(error) ||
        "Bir hata oluştu. Lütfen tekrar deneyin."
      );
  }
}

function getDetailedFirebaseError(
  error: unknown
): string {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  if (!code && !message) {
    return "";
  }

  const details: string[] = [];

  if (code) {
    details.push(
      `Firebase hata kodu: ${code}`
    );
  }

  if (message && message !== code) {
    details.push(
      `Firebase mesajı: ${message}`
    );
  }

  return details.join("\n");
}

function AuthScreen({
  onLogin,
}: AuthScreenProps) {
  const [isRegister, setIsRegister] =
    useState(false);

  const [name, setName] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [googleLoading, setGoogleLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  useEffect(() => {
    setError("");
  }, []);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    clearMessages();

    const cleanName =
      String(name).trim();

    const cleanEmail =
      String(email)
        .trim()
        .toLowerCase();

    const cleanPhone =
      String(phone).trim();

    if (
      isRegister &&
      !cleanName
    ) {
      setError(
        "Ad soyad alanını doldurun."
      );
      return;
    }

    if (!cleanEmail) {
      setError(
        "E-posta adresinizi girin."
      );
      return;
    }

    if (!password) {
      setError(
        "Şifrenizi girin."
      );
      return;
    }

    if (password.length < 6) {
      setError(
        "Şifre en az 6 karakter olmalıdır."
      );
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        console.log(
          "🟡 KAYIT BAŞLADI",
          {
            email: cleanEmail,
            name: cleanName,
          }
        );

        /**
         * ÖNEMLİ DÜZELTME:
         *
         * registerUser() auth.ts içinde
         * şu sırayla parametre bekliyor:
         *
         * registerUser(
         *   email,
         *   password,
         *   name,
         *   phone
         * )
         *
         * Obje göndermek yerine doğru sırada
         * değerleri gönderiyoruz.
         */
        await registerUser(
          cleanEmail,
          password,
          cleanName,
          cleanPhone
        );

        console.log(
          "🟢 KAYIT İŞLEMİ TAMAMLANDI"
        );

        setSuccess(
          "Hesabınız oluşturuldu. E-posta adresinizi doğrulayın."
        );

        setPassword("");

        return;
      }

      console.log(
        "🟡 GİRİŞ BAŞLADI",
        {
          email: cleanEmail,
        }
      );

      await loginUser(
        cleanEmail,
        password
      );

      console.log(
        "🟢 GİRİŞ BAŞARILI"
      );

      setSuccess(
        "Giriş başarılı."
      );

      onLogin?.();
    } catch (err) {
      console.error(
        "❌ AUTHENTICATION ERROR",
        err
      );

      const code =
        getErrorCode(err);

      const friendlyMessage =
        getAuthErrorMessage(err);

      const technicalDetails =
        getDetailedFirebaseError(err);

      console.error(
        "❌ FIREBASE HATA KODU:",
        code || "YOK"
      );

      console.error(
        "❌ FIREBASE HATA MESAJI:",
        getErrorMessage(err) || "YOK"
      );

      if (
        code ===
        "auth/email-verification-required"
      ) {
        setIsRegister(false);

        setEmail(
          cleanEmail
        );

        setPassword("");

        setSuccess(
          "Hesabınız oluşturuldu. E-posta adresinize doğrulama bağlantısı gönderildi. E-postanızı doğruladıktan sonra Giriş Yap bölümünden giriş yapabilirsiniz."
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

  const handleGoogle =
    async () => {
      clearMessages();

      setGoogleLoading(true);

      try {
        console.log(
          "🟡 GOOGLE GİRİŞ BAŞLADI"
        );

        const profile =
          await loginWithGoogle();

        if (profile) {
          console.log(
            "🟢 GOOGLE GİRİŞ BAŞARILI",
            profile
          );

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

        const code =
          getErrorCode(err);

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
          code ===
          "auth/google-redirect-started"
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
        setGoogleLoading(false);
      }
    };

  const toggleMode = () => {
    clearMessages();

    setIsRegister(
      (current) => !current
    );

    setPassword("");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070a] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[120px]" />

        <div className="absolute -bottom-48 -right-40 h-[600px] w-[600px] rounded-full bg-amber-400/10 blur-[140px]" />

        <div className="absolute left-1/2 top-1/2 h-[450px] w-[450px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-500/5 blur-[100px]" />

        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize:
              "70px 70px",
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

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[470px]">

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
                    event.currentTarget.style.display =
                      "none";

                    const fallback =
                      event.currentTarget
                        .nextElementSibling as HTMLElement | null;

                    if (fallback) {
                      fallback.style.display =
                        "flex";
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

          <div className="mb-4 flex justify-center">
            <div className="flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2 text-xs font-semibold text-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.05)] backdrop-blur">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />

                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>

              Sistem aktif • Güvenli bağlantı
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.97] shadow-[0_35px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />

            <div className="relative p-6 sm:p-9">

              <div className="mb-7">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />

                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-600">
                    {isRegister
                      ? "Yeni hesap"
                      : "Hesap erişimi"}
                  </p>
                </div>

                <h2 className="text-2xl font-black tracking-tight text-slate-950">
                  {isRegister
                    ? "Hesabını Oluştur"
                    : "Tekrar Hoş Geldin"}
                </h2>

                <p className="mt-1.5 text-sm text-slate-500">
                  {isRegister
                    ? "Trustline Express ile teslimatlarını kolayca yönet."
                    : "Teslimat yönetimine devam etmek için giriş yap."}
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mb-5 whitespace-pre-line rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm leading-5 text-red-700 shadow-sm"
                >
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 font-black">
                      !
                    </span>

                    <span>
                      {error}
                    </span>
                  </div>
                </div>
              )}

              {success && (
                <div
                  role="status"
                  className="mb-5 whitespace-pre-line rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm leading-6 text-emerald-700 shadow-sm"
                >
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-black">
                      ✓
                    </span>

                    <span>
                      {success}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogle}
                disabled={
                  loading ||
                  googleLoading
                }
                className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {googleLoading ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />

                    Google ile bağlanılıyor...
                  </>
                ) : (
                  <>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-black shadow-sm">
                      G
                    </span>

                    Google ile devam et
                  </>
                )}
              </button>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />

                <span className="text-[10px] font-black tracking-[0.2em] text-slate-400">
                  VEYA
                </span>

                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {isRegister && (
                  <div>
                    <label
                      htmlFor="auth-name"
                      className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600"
                    >
                      Ad Soyad
                    </label>

                    <input
                      id="auth-name"
                      type="text"
                      value={name}
                      onChange={(e) =>
                        setName(
                          e.target.value
                        )
                      }
                      placeholder="Adınız Soyadınız"
                      autoComplete="name"
                      disabled={
                        loading ||
                        googleLoading
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-400/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </div>
                )}

                {isRegister && (
                  <div>
                    <label
                      htmlFor="auth-phone"
                      className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600"
                    >
                      Telefon{" "}
                      <span className="normal-case font-medium tracking-normal text-slate-400">
                        (opsiyonel)
                      </span>
                    </label>

                    <input
                      id="auth-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) =>
                        setPhone(
                          e.target.value
                        )
                      }
                      placeholder="05XX XXX XX XX"
                      autoComplete="tel"
                      disabled={
                        loading ||
                        googleLoading
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-400/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600"
                  >
                    E-posta
                  </label>

                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(
                        e.target.value
                      )
                    }
                    placeholder="ornek@email.com"
                    autoComplete="email"
                    disabled={
                      loading ||
                      googleLoading
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-400/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600"
                  >
                    Şifre
                  </label>

                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) =>
                      setPassword(
                        e.target.value
                      )
                    }
                    placeholder="En az 6 karakter"
                    autoComplete={
                      isRegister
                        ? "new-password"
                        : "current-password"
                    }
                    disabled={
                      loading ||
                      googleLoading
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-400/10 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    googleLoading
                  }
                  className="group relative mt-2 w-full overflow-hidden rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white shadow-[0_12px_30px_rgba(2,6,23,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_35px_rgba(2,6,23,0.35)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <span className="absolute inset-0 -translate-x-full skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-[150%]" />

                  <span className="absolute inset-x-10 bottom-0 h-1 bg-amber-400/70 blur-md" />

                  <span className="relative flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                        İşleniyor...
                      </>
                    ) : isRegister ? (
                      <>
                        <span>
                          Hesap Oluştur
                        </span>

                        <span className="text-lg text-amber-400 transition-transform group-hover:translate-x-1">
                          →
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          Giriş Yap
                        </span>

                        <span className="text-lg text-amber-400 transition-transform group-hover:translate-x-1">
                          →
                        </span>
                      </>
                    )}
                  </span>
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-500">
                {isRegister
                  ? "Zaten hesabınız var mı?"
                  : "Henüz hesabınız yok mu?"}

                <button
                  type="button"
                  onClick={toggleMode}
                  disabled={
                    loading ||
                    googleLoading
                  }
                  className="ml-1.5 font-black text-amber-600 transition-colors hover:text-amber-700 hover:underline disabled:opacity-50"
                >
                  {isRegister
                    ? "Giriş Yap"
                    : "Kayıt Ol"}
                </button>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-amber-400 shadow-sm">
                    ✓
                  </div>

                  <div>
                    <p className="text-xs font-black text-slate-700">
                      Güvenli hesap sistemi
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      Hesap bilgileriniz Firebase Authentication
                      ve Firestore üzerinde güvenli şekilde
                      saklanır.
                    </p>
                  </div>
                </div>

                <div className="mt-3 border-t border-slate-200 pt-3 text-[11px] leading-5 text-slate-500">
                  E-posta ve şifre ile kayıt olan kullanıcıların
                  e-posta adreslerini doğrulaması zorunludur.
                </div>
              </div>
            </div>
          </div>

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