import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const App = lazy(() => import('./App.tsx'));

const BootScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D] text-white">
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D6A84F]">
        <span className="text-3xl font-black text-[#0B0B0D]">T</span>
      </div>
      <div className="text-sm font-black tracking-[0.2em] text-[#D6A84F]">TRUSTLINE</div>
      <div className="mt-1 text-[10px] tracking-[0.3em] text-[#888888]">EXPRESS</div>
    </div>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<BootScreen />}>
      <App />
    </Suspense>
  </StrictMode>,
);
