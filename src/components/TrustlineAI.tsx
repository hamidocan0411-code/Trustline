import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  Clock,
  CornerDownLeft,
  MapPin,
  MessageSquare,
  Navigation,
  Package,
  RotateCcw,
  Send,
  Sparkles,
  Truck,
  User,
  Zap,
} from 'lucide-react';
import { AIChatMessage, Order, PricingConfig } from '../types';
import { calculateOrderPrice, estimateDistanceBetweenAddresses } from '../utils/pricing';

interface Props {
  onTransferToOrder: (draft: Partial<Order>) => void;
  orders?: Order[];
  pricing: PricingConfig;
}

function money(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency', currency: 'TRY', maximumFractionDigits: 0,
  }).format(value || 0);
}

function getSmartFallback(
  request: string,
  orders: Order[],
  pricing: PricingConfig,
): { text: string; extractedDraft?: Partial<Order> } {
  const normalized = request.toLocaleLowerCase('tr-TR');
  const orderId = request.match(/#?([a-z0-9][a-z0-9_-]{4,})/i)?.[1];
  const matchedOrder = orderId
    ? orders.find((order) => order.id.toLowerCase() === orderId.toLowerCase())
    : undefined;

  if (normalized.includes('sipariş') && (normalized.includes('nerede') || normalized.includes('durum'))) {
    const order = matchedOrder || orders[0];
    if (!order) {
      return { text: 'Henüz görüntüleyebileceğim bir siparişiniz yok. Yeni gönderi için alım ve teslimat adresini yazmanız yeterli.' };
    }
    return {
      text: `#${order.id} numaralı siparişinizin durumu: **${order.status}**.\nAlım: ${order.pickupAddress}\nTeslimat: ${order.deliveryAddress}${order.courierName ? `\nAtanan kurye: ${order.courierName}` : '\nHenüz kurye ataması bekleniyor.'}`,
    };
  }

  const route = request.match(/(.+?)(?:'|’)?(?:dan|den)\s+(.+?)(?:'|’)?(?:a|e)(?:\s|$|,|\.)/i);
  const packageType = normalized.includes('evrak')
    ? 'Evrak'
    : normalized.includes('büyük')
    ? 'Büyük Paket'
    : normalized.includes('orta')
    ? 'Orta Paket'
    : normalized.includes('küçük')
    ? 'Küçük Paket'
    : 'Evrak';
  const count = Number(request.match(/\b(\d+)\s*(?:adet|tane)?/i)?.[1] || 1);
  const courierType = normalized.includes('vip')
    ? 'VIP Kurye'
    : normalized.includes('acil')
    ? 'Acil Kurye'
    : 'Standart Kurye';

  if (route) {
    const pickupAddress = route[1].trim();
    const deliveryAddress = route[2].trim();
    const distanceKm = estimateDistanceBetweenAddresses(pickupAddress, deliveryAddress);
    const price = calculateOrderPrice(distanceKm, courierType, pricing).finalPrice;
    const draft: Partial<Order> = {
      pickupAddress, deliveryAddress, packageType, packageCount: Math.max(1, count),
      courierType, urgency: courierType === 'VIP Kurye' ? 'Çok Acil' : courierType === 'Acil Kurye' ? 'Acil' : 'Normal',
      distanceKm, price,
    };
    return {
      extractedDraft: draft,
      text: `Gönderinizi hazırladım.\n• Alım: ${pickupAddress}\n• Teslimat: ${deliveryAddress}\n• Tahmini mesafe: ${distanceKm} km\n• Hizmet: ${courierType}\n• Tahmini ücret: **${money(price)}**\n\nBilgileri kontrol edip “Siparişe Aktar” ile devam edebilirsiniz.`,
    };
  }

  if (normalized.includes('fiyat') || normalized.includes('ne kadar')) {
    return { text: `Güncel başlangıç ücretimiz ${money(pricing.minPrice)}, kilometre ücretimiz ${money(pricing.perKmPrice)}. Acil hizmet çarpanı x${pricing.urgentMultiplier}, VIP hizmet çarpanı x${pricing.vipMultiplier}. Alım ve teslimat adresini yazarsanız hemen kişiselleştirilmiş tahmin hazırlayabilirim.` };
  }

  return { text: 'Size üç konuda yardımcı olabilirim: adreslerden otomatik sipariş taslağı ve fiyat çıkarma, mevcut sipariş durumunu açıklama ve kurye hizmetlerini karşılaştırma. Örneğin “Kadıköy’den Levent’e küçük paket, acil” yazabilirsiniz.' };
}

export const TrustlineAI: React.FC<Props> = ({ onTransferToOrder, orders = [], pricing }) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'assistant',
      text: 'Merhaba! Ben Trustline AI asistanınız. Nereden nereye kurye göndermek istediğinizi doğal dille yazabilirsiniz.\n\nÖrnek: *"Avcılar\'dan Beşiktaş\'a 2 tane evrak göndereceğim, acil."*\n\nSize anında rota mesafesi ve net fiyat bilgisi çıkarıp sipariş formunu otomatik doldurabilirim.',
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeDraft, setActiveDraft] = useState<Partial<Order> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || loading) return;

    const userMessage: AIChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
          userOrders: orders.map((o) => ({
            id: o.id,
            status: o.status,
            pickupAddress: o.pickupAddress,
            deliveryAddress: o.deliveryAddress,
            courierName: o.courierName,
            courierPhone: o.courierPhone,
            price: o.price,
            courierType: o.courierType,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error('AI servisi kullanılamıyor');
      }

      const data = await res.json();

      const botMessage: AIChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: data.text || 'Talebinizi aldım.',
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        extractedDraft: data.extractedDraft,
      };

      setMessages((prev) => [...prev, botMessage]);

      if (data.extractedDraft && Object.keys(data.extractedDraft).length > 0) {
        setActiveDraft((prev) => ({
          ...(prev || {}),
          ...data.extractedDraft,
        }));
      }
    } catch (e) {
      const smartReply = getSmartFallback(messageText, orders, pricing);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          text: smartReply.text,
          timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          extractedDraft: smartReply.extractedDraft,
        },
      ]);

      if (smartReply.extractedDraft) {
        setActiveDraft(smartReply.extractedDraft);
      }
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    'Avcılar’dan Beşiktaş’a 2 tane evrak göndereceğim, acil.',
    'Kadıköy’den Levent’e küçük paket teslimatı ne kadar tutar?',
    'Siparişim nerede? (#TL-8941)',
    'Acil Kurye ve VIP Kurye arasındaki fark nedir?',
    'Hangi paket türlerini taşıyorsunuz?',
  ];

  const handleResetChat = () => {
    setMessages([
      {
        id: 'msg-init',
        sender: 'assistant',
        text: 'Sohbet sıfırlandı. Size nasıl yardımcı olabilirim? Yeni bir kurye talebini veya fiyat sorusunu iletebilirsiniz.',
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setActiveDraft(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-h-[780px] bg-[#19191E] border border-[#303036] rounded-3xl shadow-2xl overflow-hidden mb-20">
      {/* Header - Elegant Dark */}
      <div className="p-4 border-b border-[#303036] bg-[#0B0B0D] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#D6A84F] animate-pulse shadow-[0_0_8px_rgba(214,168,79,0.8)]" />
          <div>
            <h3 className="text-sm font-bold text-[#D6A84F] tracking-wide font-['Space_Grotesk'] flex items-center gap-2">
              <span>Trustline AI Asistan</span>
              <span className="text-[10px] bg-[#D6A84F]/10 text-[#D6A84F] px-2 py-0.5 rounded border border-[#D6A84F]/20 font-bold uppercase">
                Operasyon Asistanı
              </span>
            </h3>
            <p className="text-[11px] text-[#999999]">
              Doğal dille kurye çağırma, anlık fiyat hesabı ve sipariş durumu
            </p>
          </div>
        </div>

        <button
          onClick={handleResetChat}
          title="Sohbeti Temizle"
          className="p-2 rounded-xl text-[#999999] hover:text-white hover:bg-[#222229] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Active AI Extracted Draft Card (if ready) */}
      {activeDraft && (activeDraft.pickupAddress || activeDraft.deliveryAddress) && (
        <div className="bg-[#222229] border-b border-[#303036] p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slideDown">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-[#D6A84F] font-bold text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Algılanan Gönderi Detayları</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-300">
              {activeDraft.pickupAddress && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#D6A84F]" />
                  <b>Alım:</b> {activeDraft.pickupAddress}
                </span>
              )}
              {activeDraft.deliveryAddress && (
                <span className="flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-emerald-400" />
                  <b>Teslimat:</b> {activeDraft.deliveryAddress}
                </span>
              )}
              {activeDraft.packageType && (
                <span className="bg-[#19191E] px-2 py-0.5 rounded border border-[#303036]">
                  {activeDraft.packageCount ? `${activeDraft.packageCount} Adet ` : ''}{activeDraft.packageType}
                </span>
              )}
              {activeDraft.courierType && (
                <span className="bg-[#19191E] px-2 py-0.5 rounded border border-[#303036] text-[#D6A84F]">
                  {activeDraft.courierType}
                </span>
              )}
              {activeDraft.price && (
                <span className="bg-[#D6A84F]/15 text-[#D6A84F] font-bold font-mono px-2 py-0.5 rounded border border-[#D6A84F]/30">
                  {activeDraft.price} TL {activeDraft.distanceKm ? `(${activeDraft.distanceKm} KM)` : ''}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => onTransferToOrder(activeDraft)}
            className="self-end sm:self-auto bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-[#D6A84F]/10 cursor-pointer shrink-0 transition-transform active:scale-95"
          >
            <span>Siparişe Aktar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 max-w-[90%] sm:max-w-[82%] ${
                isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                  isUser
                    ? 'bg-sky-500 text-white'
                    : 'bg-[#D6A84F] text-[#0B0B0D]'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`p-3.5 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-[#D6A84F] text-[#0B0B0D] font-medium rounded-tl-xl rounded-bl-xl rounded-br-xl self-end max-w-[85%] shadow-md shadow-[#D6A84F]/15'
                    : 'bg-[#222229] text-[#FFFFFF] p-3.5 rounded-tr-xl rounded-bl-xl rounded-br-xl border border-[#303036] whitespace-pre-line'
                }`}
              >
                {msg.text}

                {/* If message contained draft, show transfer action directly inside message */}
                {msg.extractedDraft && (msg.extractedDraft.pickupAddress || msg.extractedDraft.deliveryAddress) && (
                  <div className="mt-3 pt-2.5 border-t border-[#303036]/60 flex flex-wrap items-center justify-between gap-2 bg-[#19191E]/60 -mx-2 -mb-1 p-2 rounded-lg">
                    <div className="text-[11px] text-[#D6A84F] font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>
                        {msg.extractedDraft.price ? `${msg.extractedDraft.price} TL • ` : ''}
                        Sipariş bilgileri hazırlandı
                      </span>
                    </div>
                    <button
                      onClick={() => onTransferToOrder(msg.extractedDraft!)}
                      className="bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] font-bold px-3 py-1 rounded-lg text-[11px] flex items-center gap-1 shadow-sm cursor-pointer ml-auto"
                    >
                      <span>Siparişe Aktar</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div
                  className={`text-[9px] mt-1.5 ${
                    isUser ? 'text-[#0B0B0D]/70 text-right' : 'text-[#999999]'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-2.5 max-w-[80%] mr-auto items-center text-xs text-[#999999]">
            <div className="w-7 h-7 rounded-lg bg-[#D6A84F] text-[#0B0B0D] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-[#222229] border border-[#303036] p-3 rounded-tr-xl rounded-bl-xl rounded-br-xl flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D6A84F] animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#D6A84F] animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#D6A84F] animate-bounce [animation-delay:0.4s]" />
              <span className="text-[11px] text-[#999999] ml-1 font-medium">Trustline AI yanıt hazırlıyor...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="p-2 px-4 border-t border-[#303036]/60 bg-[#0B0B0D] flex gap-1.5 overflow-x-auto scrollbar-none">
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            className="text-[11px] bg-[#19191E] hover:bg-[#222229] text-[#999999] hover:text-white px-2.5 py-1.5 rounded-lg border border-[#303036] whitespace-nowrap transition-colors shrink-0 cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Box - Elegant Dark */}
      <div className="p-3 bg-[#19191E] border-t border-[#303036]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            placeholder="Kurye talebinizi doğal dille yazın (Örn: Avcılar'dan Beşiktaş'a 2 evrak, acil)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="w-full bg-[#0B0B0D] border border-[#303036] focus:border-[#D6A84F] rounded-xl py-2.5 pl-4 pr-12 text-xs text-white placeholder:text-[#999999] focus:outline-hidden transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#D6A84F] hover:text-[#ffd782] disabled:opacity-30 transition-all cursor-pointer"
            title="Gönder"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
