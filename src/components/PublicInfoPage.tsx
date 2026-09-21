import React, { useEffect } from "react";
import { COMPANY_INFO, ADDRESS_PLACEHOLDER, EMAIL_PLACEHOLDER, COMPANY_PLACEHOLDER } from "../config/companyInfo";
import { Footer } from "./Footer";

export type PageKey = "about" | "company" | "kvkk" | "privacy" | "terms" | "cookies";

const PAGE_CONFIG: Record<PageKey, { title: string; description: string; path: string }> = {
  about: { title: "Biz Kimiz?", description: "TrustLine Express hakkında, çalışma yaklaşımımız ve hizmet anlayışımız.", path: "/biz-kimiz" },
  company: { title: "Şirket Bilgileri", description: "TrustLine Express şirket ve iletişim bilgileri.", path: "/sirket-bilgileri" },
  kvkk: { title: "KVKK Aydınlatma Metni", description: "TrustLine Express kişisel verilerin işlenmesine ilişkin genel bilgilendirme.", path: "/kvkk" },
  privacy: { title: "Gizlilik Politikası", description: "TrustLine Express gizlilik ve veri güvenliği hakkında genel bilgilendirme.", path: "/gizlilik" },
  terms: { title: "Kullanım Koşulları", description: "TrustLine Express web sitesi ve hizmet kullanım koşulları hakkında genel bilgilendirme.", path: "/kullanim-kosullari" },
  cookies: { title: "Çerez Politikası", description: "TrustLine Express çerez ve tarayıcı depolama teknolojileri hakkında bilgilendirme.", path: "/cerez-politikasi" },
};

const LEGAL_NOTE = "Bu metin genel bilgilendirme amacıyla hazırlanmıştır. Şirketin gerçek veri işleme süreçlerine ve hukuki yapısına göre yetkili hukuk danışmanı tarafından kontrol edilmelidir.";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-7"><h2 className="text-lg font-black text-white sm:text-xl">{title}</h2><div className="mt-3 text-sm leading-7 text-slate-400">{children}</div></section>;
}

function AboutPage() {
  const values = [["Güven","Sürecin mümkün olduğunca şeffaf ilerlemesi."],["Şeffaflık","Kullanıcının gönderisinin hangi aşamada olduğunu anlayabilmesi."],["Hız","Teslimat süreçlerini mümkün olduğunca verimli yürütmek."],["Müşteri Odaklılık","Kullanıcıların ihtiyaçlarını merkeze alan bir hizmet deneyimi."]];
  const steps = [["01","Gönderini Oluştur","Gönderi bilgilerini gir ve teslimat detaylarını oluştur."],["02","Kurye Süreci","Gönderin uygun teslimat sürecine alınır."],["03","Gönderini Takip Et","Mevcut takip sistemi üzerinden gönderinin durumunu takip et."],["04","Teslimat","Gönderi teslimat sürecinin tamamlanmasıyla sonuçlandırılır."]];
  return <div className="grid gap-5">
    <Section title="TrustLine Express"><p>TrustLine Express; belgeler, paketler ve işletmelerin günlük teslimat ihtiyaçları için kurye ve teslimat çözümleri sunmayı hedefleyen bir markadır.</p><p className="mt-3">Amacımız, gönderi oluşturma sürecinden teslimata kadar kullanıcıya mümkün olduğunca açık ve anlaşılır bir deneyim sunmaktır.</p></Section>
    <div className="grid gap-5 md:grid-cols-2"><Section title="Vizyonumuz">Teslimat süreçlerinde güven, hız ve şeffaflığı bir araya getiren modern bir hizmet deneyimi oluşturmak.</Section><Section title="Misyonumuz">Gönderilerin doğru şekilde oluşturulmasını, takip edilebilmesini ve teslimat sürecinin mümkün olduğunca anlaşılır olmasını sağlayan kullanıcı odaklı bir teslimat deneyimi sunmak.</Section></div>
    <Section title="Değerlerimiz"><div className="grid gap-3 sm:grid-cols-2">{values.map(([title,text])=><div key={title} className="rounded-2xl border border-white/[0.06] bg-black/20 p-4"><h3 className="font-black text-orange-200">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>)}</div></Section>
    <Section title="Nasıl Çalışır?"><div className="grid gap-3 sm:grid-cols-2">{steps.map(([num,title,text])=><div key={num} className="rounded-2xl border border-white/[0.06] bg-black/20 p-4"><span className="text-[10px] font-black tracking-[0.2em] text-orange-300">{num}</span><h3 className="mt-2 font-black text-white">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>)}</div></Section>
  </div>;
}

function CompanyPage() {
  const fields = [["Ticari Unvan",COMPANY_PLACEHOLDER],["Marka",COMPANY_INFO.brand],["Vergi Dairesi",COMPANY_PLACEHOLDER],["Vergi Numarası",COMPANY_PLACEHOLDER],["MERSİS No",COMPANY_PLACEHOLDER],["Adres",COMPANY_INFO.address||ADDRESS_PLACEHOLDER],["Telefon",COMPANY_INFO.phone],["E-posta",COMPANY_INFO.email||EMAIL_PLACEHOLDER],["Web","trustlineexpress.com.tr"]];
  return <Section title="Şirket Bilgileri"><div className="grid gap-3 sm:grid-cols-2">{fields.map(([label,value])=><div key={label} className="rounded-2xl border border-white/[0.06] bg-black/20 p-4"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-bold text-slate-200">{value}</p></div>)}</div></Section>;
}

function KvkkPage() {
  return <div className="grid gap-5">
    <Section title="1. Veri Sorumlusu">Resmi veri sorumlusu ve ticari unvan bilgileri şirketin gerçek tüzel kişilik bilgileri doğrulandıktan sonra tamamlanmalıdır. Marka adı: TrustLine Express.</Section>
    <Section title="2. İşlenen Kişisel Veriler">Mevcut uygulama akışlarında kullanıcı hesabı ve sipariş süreçlerinde kullanılan bilgiler kapsamında ad soyad, telefon, e-posta, teslimat adresleri, gönderici/alıcı bilgileri, sipariş bilgileri ve kullanıcı hesabı bilgileri işlenebilir. Teknik/log verileri gerçek altyapı ve kayıt mekanizmaları doğrulanarak kesinleştirilmelidir.</Section>
    <Section title="3. Kişisel Verilerin İşlenme Amaçları">Hesap oluşturma ve doğrulama, sipariş oluşturma ve teslimat sürecinin yürütülmesi, gönderi takibi, kullanıcı desteği, güvenlik ve hizmetin teknik olarak işletilmesi.</Section>
    <Section title="4. Kişisel Verilerin Aktarılması">Aktarım kapsamı, gerçek operasyon ve hizmet sağlayıcı ilişkileri doğrulanarak belirlenmelidir. Firebase altyapısına ilişkin veri işleme ve aktarım ayrıntıları üretim yapılandırması üzerinden ayrıca doğrulanmalıdır.</Section>
    <Section title="5. Veri Toplama Yöntemi ve Hukuki Sebebi">Veriler; kullanıcı hesabı, sipariş formları, destek iletişimi ve hizmetin teknik işleyişi sırasında elektronik ortamda alınabilir. Hukuki sebep ve saklama süreleri gerçek süreçlere göre netleştirilmelidir.</Section>
    <Section title="6. Kişisel Veri Sahibinin Hakları">İlgili kişinin KVKK kapsamındaki hakları ve başvuru usulleri, şirketin gerçek veri sorumlusu bilgileri ve başvuru kanalları doğrulandıktan sonra nihai metinde açıkça belirtilmelidir.</Section>
    <Section title="7. Başvuru Yöntemi">Resmi başvuru e-postası henüz doğrulanmadığı için uydurma iletişim bilgisi kullanılmamıştır: {EMAIL_PLACEHOLDER}</Section>
    <Section title="8. İletişim"><a href={COMPANY_INFO.phoneHref} className="text-orange-200 hover:text-orange-100">{COMPANY_INFO.phone}</a><br />{COMPANY_INFO.email||EMAIL_PLACEHOLDER}<br />{COMPANY_INFO.address||ADDRESS_PLACEHOLDER}</Section>
    <p className="rounded-2xl border border-orange-300/15 bg-orange-400/[0.05] p-4 text-xs leading-6 text-orange-100/80">{LEGAL_NOTE}</p>
  </div>;
}

function PrivacyPage() {
  return <div className="grid gap-5">
    <Section title="Genel Bilgilendirme">TrustLine Express, kullanıcı hesabı, sipariş ve teslimat süreçlerinin yürütülmesi için gerekli bilgileri hizmet amaçları doğrultusunda kullanmayı hedefler.</Section>
    <Section title="Hangi Bilgileri Topluyoruz?">Mevcut uygulama akışlarında kullanıcı profili ve sipariş işlemleri için kullanılan ad soyad, telefon, e-posta, teslimat/gönderi bilgileri ve sipariş verileri gibi alanlar bulunabilir. Kapsam gerçek veri akışları doğrulanarak kesinleştirilmelidir.</Section>
    <Section title="Bilgileri Neden Kullanıyoruz?">Hesap yönetimi, sipariş oluşturma, teslimat operasyonu, gönderi takibi, destek, güvenlik ve hizmetin teknik olarak çalıştırılması.</Section>
    <Section title="Hesap ve Sipariş Bilgileri">Hesap ve sipariş bilgileri ilgili hizmetlerin sunulabilmesi için Firebase tabanlı veri altyapısında işlenebilir.</Section>
    <Section title="Firebase / Teknik Altyapı">Proje Firebase Authentication, Firestore ve Firebase Storage servislerini kullanmaktadır. Analytics veya Google Analytics gibi ek takip servisleri bu metinde varsayılmamıştır.</Section>
    <Section title="Verilerin Güvenliği">Uygulamada Firebase Authentication, Firestore ve Storage güvenlik kuralları ile sunucu tarafında güvenlik başlıkları kullanılmaktadır. Teknik önlemler hukuki güvenlik garantisi anlamına gelmez.</Section>
    <Section title="Verilerin Saklanması">Saklama süreleri veri türü ve yasal yükümlülüklere göre belirlenmelidir. Nihai süreler gerçek süreçlere göre tamamlanmalıdır.</Section>
    <Section title="Üçüncü Taraf Hizmetler">Kullanılan üçüncü taraf hizmetlerin güncel listesi ve veri aktarım kapsamı üretim yapılandırması üzerinden doğrulanmalıdır.</Section>
    <Section title="Kullanıcı Hakları">Kullanıcılar yürürlükteki mevzuat kapsamındaki hakları için doğrulanmış resmi iletişim kanallarından başvurabilir.</Section>
    <Section title="Politika Değişiklikleri">Bu bilgilendirme hizmet ve teknik altyapı değiştikçe güncellenebilir.</Section>
    <Section title="İletişim"><a href={COMPANY_INFO.phoneHref} className="text-orange-200 hover:text-orange-100">{COMPANY_INFO.phone}</a><br />{COMPANY_INFO.email||EMAIL_PLACEHOLDER}</Section>
  </div>;
}

function TermsPage() {
  const sections = [
    ["1. Genel Hükümler","TrustLine Express web sitesini ve hizmetlerini kullanırken yürürlükteki mevzuata ve hizmet kullanım kurallarına uygun davranılması beklenir."],
    ["2. Hizmetin Kullanımı","Kullanıcılar gönderi oluşturma ve takip özelliklerini doğru bilgiler sağlayarak kullanmalıdır."],
    ["3. Kullanıcı Sorumlulukları","Hesap bilgilerinin doğruluğu, iletişim bilgilerinin güncel tutulması ve gönderi bilgilerinin eksiksiz girilmesi kullanıcı sorumluluğundadır."],
    ["4. Gönderi Bilgilerinin Doğruluğu","Gönderici/alıcı bilgileri ve paket detayları mümkün olduğunca doğru girilmelidir. Yanlış veya eksik bilgi teslimat sürecini etkileyebilir."],
    ["5. Yasaklı / Kabul Edilmeyen Gönderiler","Kabul edilmeyen gönderiler ilgili mevzuat ve TrustLine Express operasyonel kuralları doğrultusunda belirlenmelidir."],
    ["6. Teslimat Süreci","Gönderi oluşturma, kurye atama, teslim alma, takip ve teslimat adımları mevcut uygulamadaki süreç üzerinden yürütülür."],
    ["7. Ücretlendirme ve Ödeme","Mevcut sürümde sunulan ödeme seçeneği sipariş oluşturma sırasında gösterilir. Güncel uygulama akışında nakit ödeme kullanılmaktadır."],
    ["8. İptal / Değişiklik","İptal ve değişiklik imkanları mevcut sipariş akışında sunulan seçeneklere ve operasyonel duruma göre uygulanır."],
    ["9. Sorumluluklar","Hizmet kapsamı, gönderinin niteliği ve kullanıcı tarafından sağlanan bilgilerin doğruluğu teslimat sürecini etkileyebilir."],
    ["10. Hizmette Değişiklik Yapılması","Teknik altyapı, hizmet kapsamı ve kullanıcı arayüzü zaman içinde güncellenebilir."],
    ["11. Fikri Mülkiyet","Site üzerindeki marka, tasarım, metin ve yazılım unsurlarının kullanım hakları ilgili hak sahiplerine aittir."],
    ["12. İletişim",COMPANY_INFO.phone+" — "+(COMPANY_INFO.email||EMAIL_PLACEHOLDER)],
  ];
  return <div className="grid gap-5">{sections.map(([title,text])=><Section key={title} title={title}>{text}</Section>)}<p className="rounded-2xl border border-orange-300/15 bg-orange-400/[0.05] p-4 text-xs leading-6 text-orange-100/80">{LEGAL_NOTE}</p></div>;
}

function CookiesPage() {
  return <div className="grid gap-5">
    <Section title="Çerez Nedir?">Çerezler ve benzeri tarayıcı teknolojileri, kullanıcı tercihlerini veya oturumla ilgili bilgileri cihaz üzerinde saklamaya yardımcı olabilir.</Section>
    <Section title="Hangi Teknolojiler Kullanılıyor?">Mevcut proje kodunda localStorage ve sessionStorage kullanımları bulunmaktadır. Firebase Authentication gibi servislerin kendi teknik çalışma mekanizmaları ayrıca sağlayıcı dokümantasyonu ve üretim yapılandırması üzerinden değerlendirilmelidir.</Section>
    <Section title="Zorunlu Teknolojiler">Oturum ve uygulama işleyişinin sürdürülebilmesi için gerekli tarayıcı depolama mekanizmaları kullanılabilir.</Section>
    <Section title="Tercih / Oturum Teknolojileri">Login ekranındaki müzik tercihi localStorage üzerinde trustline_music_enabled anahtarıyla tutulmaktadır. Google yönlendirme akışında geçici sessionStorage kullanımı bulunmaktadır.</Section>
    <Section title="Analitik Teknolojiler">Bu metinde Google Analytics veya Firebase Analytics kullanıldığı varsayılmamıştır. Böyle bir servis eklenirse politika buna göre güncellenmelidir.</Section>
    <Section title="Kullanıcı Tercihleri">Tarayıcı ayarları üzerinden depolama teknolojileri sınırlandırılabilir; bunun bazı uygulama özelliklerini etkileyebileceği unutulmamalıdır.</Section>
    <Section title="İletişim"><a href={COMPANY_INFO.phoneHref} className="text-orange-200 hover:text-orange-100">{COMPANY_INFO.phone}</a><br />{COMPANY_INFO.email||EMAIL_PLACEHOLDER}</Section>
  </div>;
}

export function PublicInfoPage({ page }: { page: PageKey }) {
  const config = PAGE_CONFIG[page];
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "TrustLine Express | " + config.title;
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const created = !canonical;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = "https://trustlineexpress.com.tr" + config.path;
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!description) { description = document.createElement("meta"); description.name = "description"; document.head.appendChild(description); }
    description.content = config.description;
    return () => { document.title = previousTitle; if (created) canonical?.remove(); };
  }, [config]);

  const content = page === "about" ? <AboutPage /> : page === "company" ? <CompanyPage /> : page === "kvkk" ? <KvkkPage /> : page === "privacy" ? <PrivacyPage /> : page === "terms" ? <TermsPage /> : <CookiesPage />;

  return <div className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
    <header className="border-b border-white/[0.06] bg-[#050505]/95">
      <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="/#top" className="flex items-center gap-3" aria-label="TrustLine Express ana sayfa">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-300/20 bg-orange-400/10 text-sm font-black text-orange-200">T</span>
          <span className="text-sm font-black tracking-[0.12em] text-white">TRUSTLINE <span className="text-orange-300">EXPRESS</span></span>
        </a>
        <a href="/#top" className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-black text-slate-300 transition hover:border-orange-300/30 hover:text-white">← Geri</a>
      </div>
    </header>
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
      <div className="mb-8"><span className="inline-flex h-1 w-12 rounded-full bg-orange-300" /><p className="mt-5 text-xs font-black uppercase tracking-[0.28em] text-orange-300">TrustLine Express</p><h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">{config.title}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">{config.description}</p></div>
      {content}
    </main>
    <Footer />
  </div>;
}
export default PublicInfoPage;
