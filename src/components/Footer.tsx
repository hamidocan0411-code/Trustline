import React from "react";
import { COMPANY_INFO, ADDRESS_PLACEHOLDER, EMAIL_PLACEHOLDER, HOURS_PLACEHOLDER } from "../config/companyInfo";

const TRUSTLINE_LOGO = "https://i.ibb.co/wZpW2m4v/3-E0-E545-B-ADD8-46-F8-A01-F-83-D5-D61-E6-DA5.png";

interface FooterProps { compact?: boolean; }

export function Footer({ compact = false }: FooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/[0.06] bg-[#070708]">
      <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${compact ? "py-8" : "py-10 lg:py-12"}`}>
        <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr_1fr_1.15fr]">
          <div>
            <a href="/#top" aria-label="TrustLine Express ana sayfa" className="inline-flex">
              <img src={TRUSTLINE_LOGO} alt="TrustLine Express" className="h-10 w-auto object-contain" loading="lazy" decoding="async" />
            </a>
            <p className="mt-4 max-w-sm text-xs leading-6 text-slate-500">Belgeleriniz ve gönderileriniz için hızlı, güvenilir ve şeffaf teslimat çözümleri.</p>
            <p className="mt-4 text-[11px] text-slate-600">© {year} TrustLine Express. Tüm hakları saklıdır.</p>
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Hızlı Menü</h3>
            <nav className="mt-4 grid gap-2.5 text-xs font-semibold text-slate-400" aria-label="Footer hızlı menü">
              <a href="/#top" className="transition hover:text-orange-200">Ana Sayfa</a>
              <a href="/#services" className="transition hover:text-orange-200">Hizmetlerimiz</a>
              <a href="/#how-it-works" className="transition hover:text-orange-200">Nasıl Çalışır?</a>
              <a href="/#login" className="transition hover:text-orange-200">Gönderi Takibi</a>
              <a href="/biz-kimiz" className="transition hover:text-orange-200">Biz Kimiz?</a>
              <a href="/#contact" className="transition hover:text-orange-200">İletişim</a>
            </nav>
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Hizmetler</h3>
            <nav className="mt-4 grid gap-2.5 text-xs font-semibold text-slate-400" aria-label="Footer hizmet menüsü">
              <a href="/#services" className="transition hover:text-orange-200">Standart Gönderi</a>
              <a href="/#services" className="transition hover:text-orange-200">Acil Teslimat</a>
              <a href="/#services" className="transition hover:text-orange-200">Eczane Teslimatı</a>
              <a href="/#corporate" className="transition hover:text-orange-200">Kurumsal Çözümler</a>
            </nav>
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-orange-300">Kurumsal & İletişim</h3>
            <nav className="mt-4 grid gap-2.5 text-xs font-semibold text-slate-400">
              <a href="/biz-kimiz" className="transition hover:text-orange-200">Biz Kimiz?</a>
              <a href="/sirket-bilgileri" className="transition hover:text-orange-200">Şirket Bilgileri</a>
              <a href={COMPANY_INFO.phoneHref} className="transition hover:text-orange-200">{COMPANY_INFO.phone}</a>
              <a href={COMPANY_INFO.email ? `mailto:${COMPANY_INFO.email}` : "/sirket-bilgileri"} className="break-words transition hover:text-orange-200">{COMPANY_INFO.email || EMAIL_PLACEHOLDER}</a>
              <span>{COMPANY_INFO.address || ADDRESS_PLACEHOLDER}</span>
              <span>{COMPANY_INFO.workingHours || HOURS_PLACEHOLDER}</span>
            </nav>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-600">Bu web sitesi TrustLine Express tarafından işletilmektedir.</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-500" aria-label="Yasal bağlantılar">
            <a href="/kvkk" className="transition hover:text-orange-200">KVKK</a>
            <a href="/gizlilik" className="transition hover:text-orange-200">Gizlilik Politikası</a>
            <a href="/kullanim-kosullari" className="transition hover:text-orange-200">Kullanım Koşulları</a>
            <a href="/cerez-politikasi" className="transition hover:text-orange-200">Çerez Politikası</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
export default Footer;
