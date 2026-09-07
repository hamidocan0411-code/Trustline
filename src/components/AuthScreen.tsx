import React, { useState } from “react”;
import { loginUser, registerUser } from “../services/auth”;

interface AuthScreenProps {
onAuthenticated?: () => void;
}

const AuthScreen: React.FC = ({ onAuthenticated }) => {
const [isRegister, setIsRegister] = useState(false);

const [name, setName] = useState(””);
const [phone, setPhone] = useState(””);
const [email, setEmail] = useState(””);
const [password, setPassword] = useState(””);

const [error, setError] = useState(””);
const [success, setSuccess] = useState(””);
const [loading, setLoading] = useState(false);

const handleSubmit = async (
event: React.FormEvent
) => {
event.preventDefault();

setError("");
setSuccess("");
setLoading(true);
try {
  if (isRegister) {
    if (!name.trim()) {
      throw new Error("Ad soyad alanı zorunludur.");
    }
    if (!email.trim()) {
      throw new Error("E-posta adresi zorunludur.");
    }
    if (password.length < 6) {
      throw new Error(
        "Şifre en az 6 karakter olmalıdır."
      );
    }
    await registerUser(
      email.trim(),
      password,
      name.trim(),
      phone.trim()
    );
    setSuccess(
      "Hesabınız başarıyla oluşturuldu."
    );
    setPassword("");
    onAuthenticated?.();
  } else {
    if (!email.trim()) {
      throw new Error("E-posta adresi zorunludur.");
    }
    if (!password) {
      throw new Error("Şifre zorunludur.");
    }
    await loginUser(
      email.trim(),
      password
    );
    onAuthenticated?.();
  }
} catch (err: any) {
  console.error(
    "Trustline authentication error:",
    err
  );
  let message =
    "İşlem sırasında bir hata oluştu.";
  switch (err?.code) {
    case "auth/email-already-in-use":
      message =
        "Bu e-posta adresi zaten kayıtlı.";
      break;
    case "auth/invalid-email":
      message =
        "Geçerli bir e-posta adresi girin.";
      break;
    case "auth/weak-password":
      message =
        "Şifre en az 6 karakter olmalıdır.";
      break;
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      message =
        "E-posta veya şifre hatalı.";
      break;
    case "auth/operation-not-allowed":
      message =
        "E-posta/şifre ile giriş Firebase'de etkin değil.";
      break;
    case "auth/network-request-failed":
      message =
        "İnternet bağlantısı kurulamadı. Lütfen tekrar deneyin.";
      break;
    case "auth/too-many-requests":
      message =
        "Çok fazla başarısız deneme yapıldı. Lütfen biraz sonra tekrar deneyin.";
      break;
    default:
      if (err?.message) {
        message = err.message;
      } else if (typeof err === "string") {
        message = err;
      }
  }
  setError(message);
} finally {
  setLoading(false);
}

};

const switchMode = () => {
setIsRegister((current) => !current);
setError(””);
setSuccess(””);
};

return (
T
      <h1 className="text-3xl font-black tracking-tight">
        Trustline Express
      </h1>
      <p className="text-slate-400 mt-2">
        Güvenli ve hızlı kurye yönetimi
      </p>
    </div>
    <div className="bg-white text-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">
          {isRegister
            ? "Hesap Oluştur"
            : "Giriş Yap"}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {isRegister
            ? "Trustline Express hesabınızı oluşturun."
            : "Hesabınıza devam etmek için giriş yapın."}
        </p>
      </div>
      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {isRegister && (
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-slate-700 mb-1.5"
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
              disabled={loading}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
            />
          </div>
        )}
        {isRegister && (
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-semibold text-slate-700 mb-1.5"
            >
              Telefon
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
              disabled={loading}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
            />
          </div>
        )}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-slate-700 mb-1.5"
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
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-semibold text-slate-700 mb-1.5"
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
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-100"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-950 text-white font-bold py-3.5 transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading
            ? "Lütfen bekleyin..."
            : isRegister
            ? "Hesap Oluştur"
            : "Giriş Yap"}
        </button>
      </form>
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={switchMode}
          disabled={loading}
          className="text-sm font-semibold text-slate-700 hover:text-slate-950 disabled:opacity-50"
        >
          {isRegister
            ? "Zaten hesabınız var mı? Giriş yapın"
            : "Hesabınız yok mu? Kayıt olun"}
        </button>
      </div>
    </div>
    <p className="text-center text-xs text-slate-500 mt-6">
      Trustline Express V1
    </p>
  </div>
</div>

);
};

export default AuthScreen; 