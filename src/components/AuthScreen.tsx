import React, { useState } from "react";
import {
  loginUser,
  loginWithGoogle,
  registerUser,
} from "../services/auth";

interface AuthScreenProps {
  onLogin?: () => void;
}

function getAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error
      ? String(
          (error as { code?: unknown }).code ?? ""
        )
      : "";

  switch (code) {
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
      return "Google giriş penceresi tarayıcı tarafından engellendi.";

    case "auth/cancelled-popup-request":
      return "Google giriş işlemi iptal edildi.";

    case "auth/account-exists-with-different-credential":
      return "Bu e-posta başka bir giriş yöntemiyle zaten kayıtlı.";

    case "auth/operation-not-allowed":
      return "Bu giriş yöntemi Firebase Console'da etkinleştirilmemiş.";

    case "auth/network-request-failed":
      return "İnternet bağlantınızı kontrol edin.";

    case "auth/too-many-requests":
      return "Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.";

    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }

      return "Bir hata oluştu. Lütfen tekrar deneyin.";
  }
}

export default function AuthScreen({
  onLogin,
}: AuthScreenProps) {
  const [isRegister, setIsRegister] =
    useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleEmailAuth = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    resetMessages();

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (isRegister && !cleanName) {
      setError("Ad soyad alanını doldurun.");
      return;
    }

    if (!cleanEmail) {
      setError("E-posta adresinizi girin.");
      return;
    }

    if (!password) {
      setError("Şifrenizi girin.");
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

        setSuccess(
          "Hesabınız başarıyla oluşturuldu."
        );

        onLogin?.();
      } else {
        await loginUser(
          cleanEmail,
          password
        );

        setSuccess(
          "Giriş başarılı. Yönlendiriliyorsunuz..."
        );

        onLogin?.();
      }
    } catch (err) {
      console.error(
        "Email authentication error:",
        err
      );

      setError(
        getAuthErrorMessage(err)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    resetMessages();
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

  const switchMode = () => {
    resetMessages();
    setIsRegister((current) => !current);
    setPassword("");
  };

  const isLoading =
    loading || googleLoading;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 px-6 py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-slate-900">
              T
            </div>

            <h1 className="text-2xl font-bold text-white">
              Trustline Express
            </h1>

            <p className="mt-2 text-sm text-slate-300">
              Güvenli ve hızlı teslimat
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {/* Title */}
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

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* Success */}
            {success && (
              <div
                role="status"
                className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
              >
                {success}
              </div>
            )}

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
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
                  <span className="flex h-5 w-5 items-center justify-center text-base font-bold">
                    G
                  </span>
                  Google ile devam et
                </>
              )}
            </button>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />

              <span className="text-xs font-medium text-slate-400">
                VEYA
              </span>

              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Email form */}
            <form
              onSubmit={handleEmailAuth}
              className="space-y-4"
            >
              {isRegister && (
                <>
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Ad Soyad
                    </label>

                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) =>
                        setName(e.target.value)
                      }
                      placeholder="Adınız Soyadınız"
                      autoComplete="name"
                      disabled={isLoading}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Telefon
                      <span className="ml-1 text-slate-400">
                        (opsiyonel)
                      </span>
                    </label>

                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) =>
                        setPhone(e.target.value)
                      }
                      placeholder="05XX XXX XX XX"
                      autoComplete="tel"
                      disabled={isLoading}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
                    />
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  E-posta
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="ornek@email.com"
                  autoComplete="email"
                  disabled={isLoading}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Şifre
                </label>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
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

            {/* Switch */}
            <div className="mt-6 text-center text-sm text-slate-500">
              {isRegister
                ? "Zaten hesabınız var mı?"
                : "Henüz hesabınız yok mu?"}

              <button
                type="button"
                onClick={switchMode}
                disabled={isLoading}
                className="ml-1 font-bold text-slate-900 hover:underline disabled:opacity-50"
              >
                {isRegister
                  ? "Giriş Yap"
                  : "Kayıt Ol"}
              </button>
            </div>

            {/* Info */}
            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
              Hesap bilgileriniz güvenli şekilde
              Firebase Authentication ve Firestore
              üzerinde saklanır.
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Trustline Express
        </p>
      </div>
    </div>
  );
}