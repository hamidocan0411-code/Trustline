import { StrictMode, lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const App = lazy(() => import('./App.tsx'));

const BootScreen = () => (
  <div className="flex min-h-screen flex-col bg-[#050505] text-white">
    <header className="flex h-16 items-center justify-between border-b border-white/10 px-5 sm:px-8">
      <div className="flex items-center gap-3">
        <img
          src="https://i.ibb.co/wZpW2m4v/3-E0-E545-B-ADD8-46-F8-A01-F-83-D5-D61-E6-DA5.png"
          alt="TrustLine Express"
          className="h-9 w-auto object-contain"
          width="54"
          height="36"
          fetchPriority="high"
          decoding="async"
        />
        <span className="text-sm font-extrabold tracking-[0.16em] text-white">
          TRUSTLINE <span className="text-[#D6A84F]">EXPRESS</span>
        </span>
      </div>
      <span className="hidden text-xs font-medium text-white/45 sm:block">
        Güvenli teslimat ağı
      </span>
    </header>

    <main className="flex flex-1 items-center px-5 py-12 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="max-w-2xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#D6A84F]">
            İstanbul&apos;un profesyonel kurye ağı
          </p>
          <h1 className="text-4xl font-black leading-[1.02] tracking-[-0.04em] sm:text-6xl">
            Hızlı. Güvenilir. Profesyonel.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/55 sm:text-lg">
            Gönderileriniz için güvenilir teslimat çözümü.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            {[
              ['01', 'Hızlı Teslimat'],
              ['02', 'Güvenli Taşıma'],
              ['03', 'Takip Edilebilir'],
            ].map(([number, label]) => (
              <div
                key={number}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
              >
                <div className="text-[10px] font-bold tracking-[0.18em] text-[#D6A84F]">
                  {number}
                </div>
                <div className="mt-2 text-xs font-bold leading-5 text-white/80">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  </div>
);

function Root() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const startApp = () => {
      if (!cancelled) {
        setAppReady(true);
      }
    };

    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(startApp, 0);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!appReady) {
    return <BootScreen />;
  }

  return (
    <Suspense fallback={<BootScreen />}>
      <App />
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
