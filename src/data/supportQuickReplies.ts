export type SupportQuickReplyCategory = "genel" | "siparis" | "teslimat" | "kapanis";

export interface SupportQuickReply {
  id: string;
  label: string;
  message: string;
  category: SupportQuickReplyCategory;
  icon: string;
}

export const supportQuickReplies: SupportQuickReply[] = [
  {
    id: "welcome",
    label: "Hoş geldiniz",
    message: "Merhaba, TrustLine Express'e hoş geldiniz. Size nasıl yardımcı olabiliriz?",
    category: "genel",
    icon: "👋",
  },
  {
    id: "received",
    label: "Talebinizi aldık",
    message: "Merhaba, mesajınızı aldık. Memnuniyetle yardımcı olalım. Nasıl destek olabiliriz?",
    category: "genel",
    icon: "💬",
  },
  {
    id: "checking-request",
    label: "Talebinizi kontrol ediyoruz",
    message: "Merhaba, talebinizi hemen kontrol edelim. Birkaç dakika içinde size bilgi vereceğiz.",
    category: "genel",
    icon: "🔎",
  },
  {
    id: "order-check",
    label: "Siparişinizi kontrol ediyoruz",
    message: "Elbette, size yardımcı olabiliriz. Siparişinizle ilgili bilgileri kontrol edelim.",
    category: "siparis",
    icon: "📦",
  },
  {
    id: "order-status",
    label: "Sipariş durumunu inceliyoruz",
    message: "Siparişinizle ilgili kontrol sağlıyoruz. Güncel durumu sizin için hemen inceleyelim.",
    category: "siparis",
    icon: "📋",
  },
  {
    id: "address",
    label: "Adresinizi kontrol edelim",
    message: "Adres bilginizi kontrol edelim. Doğru teslimat için gerekli bilgileri birlikte tamamlayabiliriz.",
    category: "teslimat",
    icon: "📍",
  },
  {
    id: "courier-assignment",
    label: "Kurye atamasını kontrol ediyoruz",
    message: "Kurye atamanızı kontrol ediyoruz. Güncel durumu kısa süre içerisinde sizinle paylaşacağız.",
    category: "teslimat",
    icon: "🚚",
  },
  {
    id: "handoff",
    label: "Ekibe iletiyoruz",
    message: "Anlayışınız için teşekkür ederiz. Talebinizi ilgili ekibimize iletiyoruz.",
    category: "genel",
    icon: "🤝",
  },
  {
    id: "anything-else",
    label: "Başka bir konuda?",
    message: "Başka bir konuda da desteğe ihtiyacınız olursa bize buradan ulaşabilirsiniz.",
    category: "kapanis",
    icon: "💡",
  },
  {
    id: "goodbye",
    label: "İyi günler",
    message: "Size yardımcı olabildiysek ne mutlu. Başka bir konuda desteğe ihtiyacınız varsa bize her zaman ulaşabilirsiniz. İyi günler dileriz.",
    category: "kapanis",
    icon: "✨",
  },
];
