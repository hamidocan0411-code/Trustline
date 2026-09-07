import React, { useState } from 'react';
import {
  loginUser,
  registerUser,
} from '../services/auth';
type AuthMode = 'login' | 'register';
interface AuthScreenProps {
  onAuthenticated?: () => void;
}
export function AuthScreen({
  onAuthenticated,
}: AuthScreenProps) {
  const [mode, setMode] =
    useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const isRegister = mode === 'register';
  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setSuccess('');
    if (isRegister && !name.trim()) {
      setError('Ad soyad alanı zorunludur.');
      return;
    }
    if (isRegister && !phone.trim()) {
      setError('Telefon numarası zorunludur.');
      return;
    }
    if (!email.trim()) {
      setError('E-posta adresi zorunludur.');
      return;
    }
    if (!password) {
      setError('Şifre zorunludur.');
      return;
    }
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        await registerUser(
          email.trim(),
          password,
          name.trim(),
          phone.trim()
        );
        setSuccess(
          'Hesabınız başarıyla oluşturuldu.'
        );
        onAuthenticated?.();
      } else {
        await loginUser(
          email.trim(),
          password
        );
        onAuthenticated?.();
      }
    } catch (err: any) {
      console.error(
        'Auth işlemi başarısız:',
        err
      );
      let message =
        'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
      switch (err?.code) {
        case 'auth/email-already-in-use':
          message =
            'Bu e-posta adresi zaten kayıtlı.';
          break;
        case 'auth/invalid-email':
          message =
            'Geçerli bir e-posta adresi girin.';
          break;
        case 'auth/weak-password':
          message =
            'Şifre en az 6 karakter olmalıdır.';
          break;
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          message =
            'E-posta veya şifre hatalı.';
          break;
        case 'auth/operation-not-allowed':
          message =
            'E-posta/şifre ile giriş Firebase üzerinde etkin değil.';
          break;
        case 'auth/network-request-failed':
          message =
            'İnternet bağlantısı kurulamadı.';
          break;
        default:
          if (err?.message) {
            message = err.message;
          }
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };
  const switchMode = (
    nextMode: AuthMode
  ) => {
    setMode(nextMode);
    setError('');
    setSuccess('');
  };
  return (
    <div className="min-h-screen bg-[#0B0B0D] text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-[26px] bg-[#D6A84F] flex items-center justify-center mx-auto shadow-[0_0_45px_rgba(214,168,79,0.18)]">
            <span className="text-[#0B0B0D] text-4xl font-black">
              T
            </span>
          </div>
          <h1 className="text-2xl font-black mt-5 tracking-tight">
            TRUSTLINE
          </h1>
          <p className="text-[#D6A84F] text-[11px] font-bold tracking-[0.3em] mt-1">
            EXPRESS
          </p>
          <p className="text-[#777777] text-sm mt-4">
            Profesyonel şehir içi kurye hizmeti
          </p>
        </div>
        <div className="bg-[#19191E] border border-[#303036] rounded-[28px] p-5 sm:p-7 shadow-2xl">
          <div className="grid grid-cols-2 gap-1 bg-[#0F0F12] rounded-2xl p-1 mb-6">
            <button
              type="button"
              onClick={() =>
                switchMode('login')
              }
              className={`rounded-xl py-3 text-sm font-bold transition ${
                mode === 'login'
                  ? 'bg-[#D6A84F] text-[#0B0B0D]'
                  : 'text-[#888888] hover:text-white'
              }`}
            >
              Giriş Yap
            </button>
            <button
              type="button"
              onClick={() =>
                switchMode('register')
              }
              className={`rounded-xl py-3 text-sm font-bold transition ${
                mode === 'register'
                  ? 'bg-[#D6A84F] text-[#0B0B0D]'
                  : 'text-[#888888] hover:text-white'
              }`}
            >
              Kayıt Ol
            </button>
          </div>
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {isRegister && (
              <div>
                <label className="block text-xs text-[#999999] mb-2">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value
                    )
                  }
                  placeholder="Adınız Soyadınız"
                  autoComplete="name"
                  className="w-full h-12 rounded-xl bg-[#222229] border border-[#303036] px-4 text-sm text-white placeholder:text-[#555555] outline-none focus:border-[#D6A84F] transition"
                />
              </div>
            )}
            {isRegister && (
              <div>
                <label className="block text-xs text-[#999999] mb-2">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value
                    )
                  }
                  placeholder="05XX XXX XX XX"
                  autoComplete="tel"
                  className="w-full h-12 rounded-xl bg-[#222229] border border-[#303036] px-4 text-sm text-white placeholder:text-[#555555] outline-none focus:border-[#D6A84F] transition"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-[#999999] mb-2">
                E-posta
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                placeholder="ornek@mail.com"
                autoComplete="email"
                className="w-full h-12 rounded-xl bg-[#222229] border border-[#303036] px-4 text-sm text-white placeholder:text-[#555555] outline-none focus:border-[#D6A84F] transition"
              />
            </div>
            <div>
              <label className="block text-xs text-[#999999] mb-2">
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="En az 6 karakter"
                autoComplete={
                  isRegister
                    ? 'new-password'
                    : 'current-password'
                }
                className="w-full h-12 rounded-xl bg-[#222229] border border-[#303036] px-4 text-sm text-white placeholder:text-[#555555] outline-none focus:border-[#D6A84F] transition"
              />
            </div>
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                <p className="text-red-300 text-xs leading-relaxed">
                  {error}
                </p>
              </div>
            )}
            {success && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                <p className="text-emerald-300 text-xs leading-relaxed">
                  {success}
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 rounded-xl bg-[#D6A84F] text-[#0B0B0D] font-black text-sm hover:brightness-105 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading
                ? 'Lütfen bekleyin...'
                : isRegister
                ? 'Hesap Oluştur'
                : 'Giriş Yap'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-[#555555] text-[10px] leading-relaxed">
              Trustline Express V1
            </p>
            <p className="text-[#444444] text-[10px] mt-1">
              Güvenli Firebase Authentication
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-[#555555]">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path
              d="M12 3l7 4v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V7l7-4z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[10px]">
            Güvenli hesap sistemi
          </span>
        </div>
      </div>
    </div>
  );
}
export default AuthScreen;