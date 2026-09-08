import React, {
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

/**
 * Trustline Express logo
 */
const TRUSTLINE_LOGO =
  "https://i.ibb.co/wZpW2m4v/3-E0-E545-B-ADD8-46-F8-A01-F-83-D5-D61-E6-DA5.png";

function getAuthErrorMessage(
  error: unknown
): string {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error
      ? String(
          (
            error as {
              code?: unknown;
            }
          ).code ?? ""
        )
      : "";

  switch (code) {
    case "auth/email-verification-required":
      return "Hesabınız oluşturuldu. E-posta adresinize bir doğrulama bağlantısı gönderdik. E-postanızı doğruladıktan sonra giriş yapabilirsiniz.";

    case "auth/email-not-verified":
      return "E-posta adresiniz henüz doğrulanmamış. E-postanıza gönderilen doğrulama bağlantısına tıklayın.";

    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-posta veya şifre hatalı.";

    case "auth/email-already-in-use":
      return "Bu e-posta adresi zaten kayıtlı.";

    case "auth/invalid-email":
      return "Geçerli bir e-posta adresi girin.";

    case "auth/weak-password":
      return "Şifre en az 6 karakter olmalıdır.";

    case "auth/popup-closed-by-user":
      return "Google giriş penceresi kapatıldı.";

    case "auth/popup-blocked":
      return "Google giriş penceresi engellendi.";

    case "auth/cancelled-popup-request":
      return "Google giriş işlemi iptal edildi.";

    case "auth/account-exists-with-different-credential":
      return "Bu e-posta başka bir giriş yöntemiyle zaten kayıtlı.";

    case "auth/operation-not-allowed":
      return "Bu giriş yöntemi Firebase Console'da etkin değil.";

    case "auth/network-request-failed":
      return "İnternet bağlantınızı kontrol edin.";

    case "auth/too-many-requests":
      return "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.";

    default:
      if (
        error instanceof Error &&
        error.message
      ) {
        return error.message;
      }

      return "Bir hata oluştu. Lütfen tekrar deneyin.";
  }
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

  const [
    googleLoading,
    setGoogleLoading,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const isLoading =
    loading ||
    googleLoading;

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    clearMessages();

    const cleanName =
      name.trim();

    const cleanEmail =
      email.trim().toLowerCase();

    const cleanPhone =
      phone.trim();

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
        await registerUser({
          name: cleanName,
          email: cleanEmail,
          password,
          phone: cleanPhone,
        });

        /*
         * registerUser doğrulama gerektiğinde
         * özel hata döndürür.
         *
         * Normalde buraya ulaşılmaz.
         */
        setSuccess(
          "Hesabınız oluşturuldu. E-posta adresinizi doğrulayın."
        );

        return;
      }

      await loginUser(
        cleanEmail,
        password
      );

      setSuccess(
        "Giriş başarılı."
      );

      onLogin?.();
    } catch (err) {
      console.error(
        "Authentication error:",
        err
      );

      const code =
        typeof err === "object" &&
        err !== null &&
        "code" in err
          ? String(
              (
                err as {
                  code?: unknown;
                }
              ).code ?? ""
            )
          : "";

      if (
        code ===
        "auth/email-verification-required"
      ) {
        setIsRegister(
          false
        );

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
        getAuthErrorMessage(err)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    clearMessages();

    setGoogleLoading(true);

    try {
      await loginWithGoogle();

      setSuccess(
        "Google hesabınızla giriş başarılı."
      );

      onLogin?.();
    } catch (err) {
      console.error(
        "Google authentication error:",
        err
      );

      setError(
        getAuthErrorMessage(err)
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">

        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">

          {/* LOGO / HEADER */}

          <div className="bg-slate-900 px-6 py-8 text-center">

            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-white p-2 shadow-[0_0_35px_rgba(214,168,79,0.22)] ring-1 ring-white/10">

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
                className="hidden h-full w-full items-center justify-center rounded-2xl bg-slate-900 text-4xl font-black text-white"
                aria-hidden="true"
              >
                T
              </span>
            </div>

            <h1 className="text-2xl font-bold text-white">
              Trustline Express
            </h1>

            <p className="mt-2 text-sm text-slate-300">
              Güvenli ve hızlı teslimat
            </p>
          </div>

          {/* CONTENT */}

          <div className="p-6 sm:p-8">

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                {isRegister
                  ? "Hesap Oluştur"
                  : "Hoş Geldiniz"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {isRegister
                  ? "Trustline Express'e ücretsiz kayıt olun."
                  : "Hesabınıza giriş yapın."}
              </p>
            </div>

            {/* ERROR */}

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* SUCCESS */}

            {success && (
              <div
                role="status"
                className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm leading-6 text-green-700"
              >
                {success}
              </div>
            )}

            {/* GOOGLE */}

            <button
              type="button"
              onClick={handleGoogle}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {googleLoading ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />

                  Google ile bağlanılıyor...
                </>
              ) : (
                <>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-sm font-bold">
                    G
                  </span>

                  Google ile devam et
                </>
              )}
            </button>

            {/* DIVIDER */}

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />

              <span className="text-xs font-medium text-slate-400">
                VEYA
              </span>

              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >

              {/* NAME */}

              {isRegister && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
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
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
                  />
                </div>
              )}

              {/* PHONE */}

              {isRegister && (
                <div>
                  <label
                    htmlFor="auth-phone"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    Telefon

                    <span className="ml-1 text-slate-400">
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
                    disabled={isLoading}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
                  />
                </div>
              )}

              {/* EMAIL */}

              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
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
                  disabled={isLoading}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
                />
              </div>

              {/* PASSWORD */}

              <div>
                <label
                  htmlFor="auth-password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
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
                  disabled={isLoading}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
                />
              </div>

              {/* SUBMIT */}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                    İşleniyor...
                  </span>
                ) : isRegister ? (
                  "Hesap Oluştur"
                ) : (
                  "Giriş Yap"
                )}
              </button>
            </form>

            {/* SWITCH */}

            <div className="mt-6 text-center text-sm text-slate-500">
              {isRegister
                ? "Zaten hesabınız var mı?"
                : "Henüz hesabınız yok mu?"}

              <button
                type="button"
                onClick={toggleMode}
                disabled={isLoading}
                className="ml-1 font-bold text-slate-900 hover:underline disabled:opacity-50"
              >
                {isRegister
                  ? "Giriş Yap"
                  : "Kayıt Ol"}
              </button>
            </div>

            {/* INFO */}

            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
              Hesap bilgileriniz güvenli şekilde
              Firebase Authentication ve Firestore
              üzerinde saklanır.

              <div className="mt-2 font-semibold text-slate-600">
                E-posta ve şifre ile kayıt olan
                kullanıcıların e-posta adreslerini
                doğrulaması zorunludur.
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Trustline Express
        </p>
      </div>
    </div>
  );
}

export {
  AuthScreen,
};

export default AuthScreen;