import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const App = lazy(() => import('./App.tsx'));
const PublicInfoPage = lazy(() => import('./components/PublicInfoPage.tsx'));

const PUBLIC_INFO_PAGES = {
  "/biz-kimiz": "about",
  "/sirket-bilgileri": "company",
  "/kvkk": "kvkk",
  "/gizlilik": "privacy",
  "/kullanim-kosullari": "terms",
  "/cerez-politikasi": "cookies",
} as const;

const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
const publicInfoPage = PUBLIC_INFO_PAGES[normalizedPath as keyof typeof PUBLIC_INFO_PAGES];

const BootScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D6A84F]">
        <span className="text-3xl font-black text-[#050505]">T</span>
      </div>
      <div className="text-sm font-black tracking-[0.2em] text-[#D6A84F]">
        TRUSTLINE
      </div>
      <div className="mt-1 text-[10px] tracking-[0.3em] text-white/45">
        EXPRESS
      </div>
    </div>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<BootScreen />}>
      {publicInfoPage ? <PublicInfoPage page={publicInfoPage} /> : <App />}
    </Suspense>
  </StrictMode>,
);
