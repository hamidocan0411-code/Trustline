import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Gemini SDK with User-Agent header as required by skill
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Distance & Geographic Coordinates for Istanbul Districts and Key Hubs
interface LocationCoord {
  name: string;
  lat: number;
  lng: number;
  side: 'europe' | 'asia';
}

const ISTANBUL_LOCATIONS: Record<string, LocationCoord> = {
  avcılar: { name: 'Avcılar', lat: 40.9801, lng: 28.7175, side: 'europe' },
  beşiktaş: { name: 'Beşiktaş', lat: 41.0428, lng: 29.0077, side: 'europe' },
  kadıköy: { name: 'Kadıköy', lat: 40.9927, lng: 29.0277, side: 'asia' },
  şişli: { name: 'Şişli', lat: 41.0602, lng: 28.9877, side: 'europe' },
  levent: { name: 'Levent', lat: 41.0822, lng: 29.0125, side: 'europe' },
  maslak: { name: 'Maslak', lat: 41.1105, lng: 29.0210, side: 'europe' },
  bakırköy: { name: 'Bakırköy', lat: 40.9744, lng: 28.8728, side: 'europe' },
  üsküdar: { name: 'Üsküdar', lat: 41.0267, lng: 29.0153, side: 'asia' },
  ataşehir: { name: 'Ataşehir', lat: 40.9934, lng: 29.1134, side: 'asia' },
  sarıyer: { name: 'Sarıyer', lat: 41.1663, lng: 29.0498, side: 'europe' },
  maltepe: { name: 'Maltepe', lat: 40.9247, lng: 29.1311, side: 'asia' },
  kartal: { name: 'Kartal', lat: 40.8886, lng: 29.1856, side: 'asia' },
  pendik: { name: 'Pendik', lat: 40.8744, lng: 29.2341, side: 'asia' },
  başakşehir: { name: 'Başakşehir', lat: 41.0945, lng: 28.8021, side: 'europe' },
  beyoğlu: { name: 'Beyoğlu', lat: 41.0370, lng: 28.9850, side: 'europe' },
  taksim: { name: 'Taksim', lat: 41.0370, lng: 28.9850, side: 'europe' },
  fatih: { name: 'Fatih', lat: 41.0182, lng: 28.9497, side: 'europe' },
  beylikdüzü: { name: 'Beylikdüzü', lat: 40.9902, lng: 28.6414, side: 'europe' },
  esenyurt: { name: 'Esenyurt', lat: 41.0343, lng: 28.6801, side: 'europe' },
  ümraniye: { name: 'Ümraniye', lat: 41.0256, lng: 29.0963, side: 'asia' },
  zeytinburnu: { name: 'Zeytinburnu', lat: 40.9912, lng: 28.9038, side: 'europe' },
  bağcılar: { name: 'Bağcılar', lat: 41.0344, lng: 28.8572, side: 'europe' },
  kağıthane: { name: 'Kağıthane', lat: 41.0812, lng: 28.9731, side: 'europe' },
  eyüpsultan: { name: 'Eyüpsultan', lat: 41.0478, lng: 28.9341, side: 'europe' },
  eyüp: { name: 'Eyüp', lat: 41.0478, lng: 28.9341, side: 'europe' },
  gaziosmanpaşa: { name: 'Gaziosmanpaşa', lat: 41.0577, lng: 28.9157, side: 'europe' },
  sultanbeyli: { name: 'Sultanbeyli', lat: 40.9669, lng: 29.2635, side: 'asia' },
  tuzla: { name: 'Tuzla', lat: 40.8164, lng: 29.3033, side: 'asia' },
  sancaktepe: { name: 'Sancaktepe', lat: 41.0024, lng: 29.2274, side: 'asia' },
  çekmeköy: { name: 'Çekmeköy', lat: 41.0352, lng: 29.1764, side: 'asia' },
  küçükçekmece: { name: 'Küçükçekmece', lat: 40.9918, lng: 28.7712, side: 'europe' },
  büyükçekmece: { name: 'Büyükçekmece', lat: 41.0214, lng: 28.5833, side: 'europe' },
  güngören: { name: 'Güngören', lat: 41.0189, lng: 28.8722, side: 'europe' },
  esenler: { name: 'Esenler', lat: 41.0402, lng: 28.8872, side: 'europe' },
  bayrampaşa: { name: 'Bayrampaşa', lat: 41.0450, lng: 28.9056, side: 'europe' },
  arnavutköy: { name: 'Arnavutköy', lat: 41.1847, lng: 28.7408, side: 'europe' },
  silivri: { name: 'Silivri', lat: 41.0734, lng: 28.2464, side: 'europe' },
  şile: { name: 'Şile', lat: 41.1767, lng: 29.6133, side: 'asia' },
};

const ISTANBUL_DISTRICT_DISTANCES: Record<string, Record<string, number>> = {
  avcılar: { beşiktaş: 32, kadıköy: 38, şişli: 28, levent: 30, bakırköy: 16, üsküdar: 36, fatih: 24, beyoğlu: 27, ataşehir: 42, sarıyer: 38, başakşehir: 18 },
  beşiktaş: { avcılar: 32, kadıköy: 16, şişli: 4, levent: 5, bakırköy: 18, üsküdar: 12, fatih: 9, beyoğlu: 3, ataşehir: 18, sarıyer: 15, başakşehir: 24 },
  kadıköy: { avcılar: 38, beşiktaş: 16, şişli: 18, levent: 20, bakırköy: 26, üsküdar: 6, fatih: 20, beyoğlu: 17, ataşehir: 8, maltepe: 14, pendik: 26, kartal: 20 },
  şişli: { avcılar: 28, beşiktaş: 4, kadıköy: 18, levent: 4, bakırköy: 16, üsküdar: 14, fatih: 8, beyoğlu: 3, ataşehir: 20, sarıyer: 14, maslak: 8 },
  levent: { avcılar: 30, beşiktaş: 5, kadıköy: 20, şişli: 4, bakırköy: 19, üsküdar: 15, fatih: 11, maslak: 4, sarıyer: 12, ataşehir: 22 },
  bakırköy: { avcılar: 16, beşiktaş: 18, kadıköy: 26, şişli: 16, levent: 19, fatih: 10, beyoğlu: 15, üsküdar: 22 },
  üsküdar: { avcılar: 36, beşiktaş: 12, kadıköy: 6, şişli: 14, levent: 15, ataşehir: 10, fatih: 14, beyoğlu: 13 },
  ataşehir: { avcılar: 42, beşiktaş: 18, kadıköy: 8, şişli: 20, levent: 22, üsküdar: 10, maltepe: 10, pendik: 22 },
  sarıyer: { avcılar: 38, beşiktaş: 15, kadıköy: 28, şişli: 14, levent: 12, maslak: 8 },
  maslak: { avcılar: 32, beşiktaş: 9, kadıköy: 22, şişli: 8, levent: 4, sarıyer: 8 },
  fatih: { avcılar: 24, beşiktaş: 9, kadıköy: 20, şişli: 8, bakırköy: 10, beyoğlu: 5 },
};

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function resolveAddressToCoordinates(address: string): Promise<LocationCoord | null> {
  if (!address || address.trim().length < 2) return null;
  const normalized = address.toLowerCase().replace(/[^a-zçğıöşü0-9\s]/g, ' ');

  // 1. Google Maps Geocoding if secret API key is provided
  if (process.env.GOOGLE_MAPS_API_KEY) {
    try {
      const query = encodeURIComponent(`${address}, Istanbul, Turkey`);
      const resp = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      );
      const data = (await resp.json()) as any;
      if (data.status === 'OK' && data.results && data.results[0]) {
        const loc = data.results[0].geometry.location;
        return {
          name: data.results[0].formatted_address || address,
          lat: loc.lat,
          lng: loc.lng,
          side: loc.lng > 29.05 ? 'asia' : 'europe',
        };
      }
    } catch (e) {
      // Fallback
    }
  }

  // 2. High-precision Istanbul District / Neighborhood local resolver
  for (const [key, loc] of Object.entries(ISTANBUL_LOCATIONS)) {
    if (normalized.includes(key)) {
      return loc;
    }
  }

  return null;
}

function generateRoutePolyline(p1: LocationCoord, p2: LocationCoord): [number, number][] {
  const points: [number, number][] = [[p1.lat, p1.lng]];

  // If route crosses between Europe and Asia, add Bosphorus Bridge waypoints
  if (p1.side !== p2.side) {
    const bridgeCoord: [number, number] = [41.0456, 29.0344]; // 15 Temmuz Şehitler Köprüsü
    // Midpoint to bridge
    points.push([(p1.lat + bridgeCoord[0]) / 2, (p1.lng + bridgeCoord[1]) / 2]);
    points.push(bridgeCoord);
    // Bridge to destination midpoint
    points.push([(bridgeCoord[0] + p2.lat) / 2, (bridgeCoord[1] + p2.lng) / 2]);
  } else {
    // Interpolate realistic road curvature
    const midLat = (p1.lat + p2.lat) / 2 + 0.005;
    const midLng = (p1.lng + p2.lng) / 2 - 0.004;
    points.push([midLat, midLng]);
  }

  points.push([p2.lat, p2.lng]);
  return points;
}

function getCalculatedDistance(fromRaw: string, toRaw: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-zçğıöşü]/g, '');
  const from = normalize(fromRaw);
  const to = normalize(toRaw);

  for (const [d1, targets] of Object.entries(ISTANBUL_DISTRICT_DISTANCES)) {
    if (from.includes(d1)) {
      for (const [d2, dist] of Object.entries(targets)) {
        if (to.includes(d2)) {
          return dist;
        }
      }
    }
  }
  return 12; // Realistic average city distance
}

function calculateOrderPrice(distanceKm: number, courierType: string = 'Standart Kurye') {
  const perKmPrice = 50;
  const minPrice = 250;
  const rawBase = distanceKm * perKmPrice;
  const basePrice = Math.max(minPrice, rawBase);
  const multiplier = courierType === 'VIP Kurye' ? 1.6 : courierType === 'Acil Kurye' ? 1.3 : 1.0;
  const finalPrice = Math.round(basePrice * multiplier);
  return { distanceKm, basePrice, multiplier, finalPrice };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', brand: 'Trustline Express', timestamp: new Date().toISOString() });
});

// Trustline AI Assistant Chat Endpoint
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, userOrders, userContext } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Geçersiz mesaj formatı' });
    }

    const latestMessage = messages[messages.length - 1]?.text || '';

    // Build context about existing orders if provided
    let ordersContextText = '';
    if (userOrders && Array.isArray(userOrders) && userOrders.length > 0) {
      ordersContextText = `
MÜŞTERİNİN SİSTEMDEKİ AKTİF/GEÇMİŞ SİPARİŞLERİ:
${userOrders
  .map(
    (o: any) =>
      `• Sipariş No: ${o.id} | Durum: "${o.status}" | Alım: ${o.pickupAddress} | Teslimat: ${o.deliveryAddress} | Kurye: ${o.courierName || 'Henüz atanmadı'} (${o.courierPhone || '-'}) | Fiyat: ${o.price} TL | Tür: ${o.courierType}`
  )
  .join('\n')}
(Müşteri siparişim nerede veya sipariş numarasını sorduğunda bu gerçek sipariş verilerini kullan, uydurma yapma!)
`;
    }

    const systemInstruction = `
Sen Trustline Express'in resmi ve yapay zeka destekli profesyonel müşteri asistanı "Trustline AI"sın.
Tamamen Türkçe konuşursun.
Karakterin: Nazik, kurumsal, son derece hızlı, çözüm odaklı ve güven veren bir kurye uzmanı.
Slogan: "Trustline Express — Kurye hizmetinde güvenin yeni adresi."

GÖREVLERİN:
1. DOĞAL DİLLE KURYEYE DÖNÜŞTÜRME:
   Müşterinin doğal Türkçe ile yazdığı gönderi taleplerini analiz et.
   Örnek: "Avcılar’dan Beşiktaş’a 2 tane evrak göndereceğim, acil."
   Bu mesajdan şu bilgileri çıkar:
   - pickupAddress: "Avcılar" (veya "Avcılar / İstanbul")
   - deliveryAddress: "Beşiktaş" (veya "Beşiktaş / İstanbul")
   - packageType: "Evrak" (Evrak | Küçük Paket | Orta Paket | Büyük Paket | Diğer)
   - courierType: "Acil Kurye" (Standart Kurye | Acil Kurye | VIP Kurye)
   - urgency: "Acil" (Normal | Acil | Çok Acil)
   - packageCount: 2 (sayı olarak)
   - distanceKm: 32 (Avcılar - Beşiktaş yaklaşık 32 km)
   - price: 2080 (32 km * 50 TL = 1600 TL * 1.30 = 2080 TL)

2. EKSİK BİLGİ VARSA DOĞAL VE KİBARCA SOR:
   - Alış adresi eksikse: "Paketin alınacağı adresi veya ilçeyi de öğrenebilir miyim?"
   - Teslimat adresi eksikse: "Teslimat adresini de paylaşır mısınız?"
   - Paket türü belirsizse: "Gönderinizin içeriği evrak mı yoksa koli/paket mi?"
   Eksik olan bilgiyi tek ve net bir cümleyle kibarca sor. Tüm bilgiler tam ise doğrudan özetle ve sipariş oluşturmaya hazır olduğunu belirt.

3. FİYAT HESAPLAMA (KESİNLİKLE UYDURMA, FORMÜLÜ UYGULA!):
   Tarifemiz:
   • Taban / Minimum Açılış: 250 TL
   • Kilometre Başı: 50 TL
   • Çarpanlar: Standart Kurye = 1.00× (90-120 dk) | Acil Kurye = 1.30× (30-60 dk) | VIP Kurye = 1.60× (20-40 dk)
   • Fiyat Formülü: Maksimum(250, Mesafe_KM * 50) * Çarpan
   Örnek Mesafeler:
   - Avcılar - Beşiktaş: 32 KM -> Standart: 1600 TL, Acil: 2080 TL, VIP: 2560 TL
   - Kadıköy - Levent: 20 KM -> Standart: 1000 TL, Acil: 1300 TL, VIP: 1600 TL
   - Kadıköy - Beşiktaş: 16 KM -> Standart: 800 TL, Acil: 1040 TL, VIP: 1280 TL
   - Şişli - Beşiktaş: 4 KM -> Taban 250 TL, Acil: 325 TL, VIP: 400 TL
   - Bakırköy - Beşiktaş: 18 KM -> Standart: 900 TL, Acil: 1170 TL, VIP: 1440 TL
   Müşteri "Ne kadar tutar?" dediğinde bu formülle açık ve net hesapla.

4. SİPARİŞ DURUMU SORGULAMA:
   Müşteri siparişinin nerede olduğunu veya durumunu sorduğunda yukarıda verilen gerçek sipariş listesine bak.
   Eğer numara vermişse (örn: "TL-8941 nerede?"), doğrudan o siparişin durumunu ve kurye bilgisini söyle.
   Eğer listede yoksa "Belirttiğiniz sipariş numarasına ait bir kayıt bulamadım, kontrol edip tekrar iletebilir misiniz?" de.

5. HİZMET VE PAKET REHBERLİĞİ:
   • Kurye Türleri:
     - Standart Kurye: 90-120 dk teslimat, gün içi ekonomik teslimat.
     - Acil Kurye: 30-60 dk teslimat, en yakın kurye anında yönlendirilir.
     - VIP Kurye: 20-40 dk teslimat, doğrudan kişiye özel tahsisli tek yön kurye, araya başka paket alınmaz.
   • Paket Türleri:
     - Evrak: dosya, sözleşme, pasaport, anahtar, tapu belgesi
     - Küçük Paket: 0-2 kg arası kutular, telefon, aksesuar
     - Orta Paket: 2-7 kg koli, kıyafet, numune
     - Büyük Paket: 7-15 kg geniş kutular
   • Trustline Express Kalitesi: Canlı GPS takibi, fotoğraflı teslim teyidi, %100 sigortalı taşımacılık.

6. SİPARİŞ AKTARMA (JSON ÇIKTISI):
   Eğer kullanıcının mesajından herhangi bir gönderi detayı (alış/teslimat adresi, paket türü, kurye türü, adet vb.) tespit ettiysen, yanıtının EN SONUNA aşağıdaki blok yapısını MUTLAKA ekle. Bu JSON bloğu kullanıcının ekranında "Siparişe Aktar" butonunu tetikler ve sipariş formunu anında doldurur:
\`\`\`trustline_draft
{
  "pickupAddress": "...",
  "deliveryAddress": "...",
  "packageType": "Evrak | Küçük Paket | Orta Paket | Büyük Paket | Diğer",
  "courierType": "Standart Kurye | Acil Kurye | VIP Kurye",
  "urgency": "Normal | Acil | Çok Acil",
  "packageCount": 2,
  "distanceKm": 32,
  "price": 2080,
  "note": "..."
}
\`\`\`
Tespit edemediğin alanları boş string veya null bırak. Sayısal alanları sayı olarak ver.
Metin kısmında bu JSON'dan bahsetme; sadece doğal Türkçe ile dostane, net yanıtını ver.
${ordersContextText}
`;

    const ai = getAIClient();
    let replyText = '';

    if (ai) {
      try {
        const contents = messages.map((m: { sender: string; text: string }) => ({
          role: m.sender === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.text }],
        }));

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: contents,
          config: {
            systemInstruction,
            temperature: 0.6,
          },
        });

        replyText = response.text || '';
      } catch (geminiErr: any) {
        console.warn('Gemini API call warning, falling back to smart local NLP engine:', geminiErr?.message);
      }
    }

    // High-precision local fallback engine
    if (!replyText) {
      replyText = generateSmartFallbackResponse(latestMessage, userOrders);
    }

    // Extract draft if present in response
    let extractedDraft: any = null;
    const match = replyText.match(/```trustline_draft\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        extractedDraft = JSON.parse(match[1]);
      } catch (e) {
        // parse error ignored
      }
    }

    // Clean markdown block from display text for pristine chat bubble
    const cleanText = replyText.replace(/```trustline_draft[\s\S]*?```/g, '').trim();

    return res.json({
      text: cleanText,
      raw: replyText,
      extractedDraft,
    });
  } catch (error: any) {
    console.error('AI chat endpoint error:', error);
    res.status(500).json({ error: 'Yapay zeka asistanına bağlanırken bir hata oluştu.' });
  }
});

// Intelligent fallback rules engine for 100% reliability
function generateSmartFallbackResponse(input: string, userOrders?: any[]): string {
  const lower = input.toLowerCase();
  const draft: Record<string, any> = {};

  // 1. Order Status Check
  const orderIdMatch = input.match(/(?:TL-?|tl-?)(\d{4})/i);
  if (orderIdMatch || lower.includes('siparişim') || lower.includes('sipariş nerede') || lower.includes('durumu')) {
    const idToFind = orderIdMatch ? `TL-${orderIdMatch[1]}` : null;
    if (userOrders && userOrders.length > 0) {
      const found = idToFind
        ? userOrders.find((o) => o.id.toUpperCase() === idToFind.toUpperCase())
        : userOrders[0];

      if (found) {
        return `📦 **Sipariş Durumunuz (${found.id})**:\n\n• **Durum:** ${found.status}\n• **Alım:** ${found.pickupAddress}\n• **Teslimat:** ${found.deliveryAddress}\n• **Kurye:** ${found.courierName || 'Atama bekleniyor'}${found.courierPhone ? ` (${found.courierPhone})` : ''}\n• **Tutar:** ${found.price} TL\n\nKuryeniz siparişinizi güvenle taşımaktadır. Başka bir işlem için yardımcı olabilir miyim?`;
      }
    }
  }

  // 2. Package Count detection (e.g. "2 tane evrak", "3 adet koli", "1 dosya")
  const countMatch = lower.match(/(\d+)\s*(?:tane|adet|parça|kutu|dosya|evrak)/);
  if (countMatch && countMatch[1]) {
    draft.packageCount = parseInt(countMatch[1], 10);
  }

  // 3. Location Detection
  const districts = [
    'avcılar', 'beşiktaş', 'kadıköy', 'şişli', 'levent', 'maslak',
    'üsküdar', 'bakırköy', 'taksim', 'ataşehir', 'sarıyer', 'kartal',
    'beyoğlu', 'maltepe', 'pendik', 'başakşehir', 'fatih'
  ];

  let detectedDistricts: string[] = [];
  for (const d of districts) {
    if (lower.includes(d)) {
      const formatted = d.charAt(0).toUpperCase() + d.slice(1);
      detectedDistricts.push(formatted);
    }
  }

  if (detectedDistricts.length >= 2) {
    draft.pickupAddress = `${detectedDistricts[0]} / İstanbul`;
    draft.deliveryAddress = `${detectedDistricts[1]} / İstanbul`;
  } else if (detectedDistricts.length === 1) {
    if (lower.includes('dan') || lower.includes('den') || lower.includes('tan') || lower.includes('ten') || lower.includes('alın')) {
      draft.pickupAddress = `${detectedDistricts[0]} / İstanbul`;
    } else {
      draft.deliveryAddress = `${detectedDistricts[0]} / İstanbul`;
    }
  }

  // 4. Package Type Detection
  if (lower.includes('evrak') || lower.includes('dosya') || lower.includes('sözleşme') || lower.includes('pasaport') || lower.includes('anahtar')) {
    draft.packageType = 'Evrak';
  } else if (lower.includes('küçük') || lower.includes('telefon') || lower.includes('kutu')) {
    draft.packageType = 'Küçük Paket';
  } else if (lower.includes('orta') || lower.includes('numune')) {
    draft.packageType = 'Orta Paket';
  } else if (lower.includes('büyük') || lower.includes('koli')) {
    draft.packageType = 'Büyük Paket';
  } else {
    draft.packageType = 'Evrak';
  }

  // 5. Urgency & Courier Type Detection
  if (lower.includes('vip') || lower.includes('özel')) {
    draft.courierType = 'VIP Kurye';
    draft.urgency = 'Çok Acil';
  } else if (lower.includes('acil') || lower.includes('hızlı') || lower.includes('çabuk') || lower.includes('hemen')) {
    draft.courierType = 'Acil Kurye';
    draft.urgency = 'Acil';
  } else {
    draft.courierType = 'Standart Kurye';
    draft.urgency = 'Normal';
  }

  // 6. Pricing Calculation
  let distanceKm = 10;
  if (draft.pickupAddress && draft.deliveryAddress) {
    distanceKm = getCalculatedDistance(draft.pickupAddress, draft.deliveryAddress);
    const { finalPrice } = calculateOrderPrice(distanceKm, draft.courierType);
    draft.distanceKm = distanceKm;
    draft.price = finalPrice;
  }

  // Response Text generation
  let text = '';
  if (lower.includes('kaç para') || lower.includes('ne kadar') || lower.includes('fiyat') || lower.includes('ücret')) {
    if (draft.pickupAddress && draft.deliveryAddress && draft.price) {
      text = `📍 **${draft.pickupAddress} ➔ ${draft.deliveryAddress}** rotası için tahmini mesafe **${draft.distanceKm} km**'dir.\n\n• **Seçilen Hizmet:** ${draft.courierType}\n• **Tarife Detayı:** ${draft.distanceKm} km × 50 TL${draft.courierType === 'Acil Kurye' ? ' × 1.30 (Acil Çarpanı)' : draft.courierType === 'VIP Kurye' ? ' × 1.60 (VIP Çarpanı)' : ''}\n• **Toplam Ücret:** **${draft.price} TL**\n\nAşağıdaki **"Siparişe Aktar"** butonuna basarak kuryenizi tek tıkla çağırabilirsiniz! 🚀`;
    } else {
      text = `Trustline Express şeffaf fiyatlandırma politikası:\n\n• **Kilometre Başı:** 50 TL\n• **Minimum / Açılış Tutar:** 250 TL\n• **Acil Kurye (30-60 dk):** 1.30× çarpan\n• **VIP Kurye (20-40 dk):** 1.60× çarpan\n\nNereden nereye göndermek istediğinizi belirtirseniz (örn: "Kadıköy'den Beşiktaş'a acil evrak"), net tutarı hemen hesaplayabilirim.`;
    }
  } else if (draft.pickupAddress && draft.deliveryAddress) {
    const countInfo = draft.packageCount ? `${draft.packageCount} adet ` : '';
    text = `Harika, gönderi detaylarınızı eksiksiz aldım! 🚀\n\n• **Alınacak Adres:** ${draft.pickupAddress}\n• **Teslimat Adresi:** ${draft.deliveryAddress}\n• **Gönderi:** ${countInfo}${draft.packageType}\n• **Kurye Türü:** ${draft.courierType} (${draft.urgency})\n• **Mesafe:** Yaklaşık ${draft.distanceKm} km\n• **Hesaplanan Ücret:** **${draft.price} TL**\n\nAşağıdaki **"Siparişe Aktar"** butonuna dokunarak sipariş formunu otomatik doldurabilir ve kuryenizi anında çağırabilirsiniz.`;
  } else if (draft.pickupAddress && !draft.deliveryAddress) {
    text = `Alım adresinizi (**${draft.pickupAddress}**) not ettim. Teslimat adresini de paylaşır mısınız?`;
  } else if (!draft.pickupAddress && draft.deliveryAddress) {
    text = `Teslimat adresinizi (**${draft.deliveryAddress}**) not ettim. Paketin alınacağı adresi veya ilçeyi de öğrenebilir miyim?`;
  } else {
    text = `Merhaba! Ben Trustline AI asistanınız. Kurye çağırma, anlık fiyat öğrenme ve sipariş takibi konularında size yardımcı olabilirim.\n\nÖrnek: *"Avcılar'dan Beşiktaş'a 2 tane evrak göndereceğim, acil"* şeklinde yazabilirsiniz.`;
  }

  if (Object.keys(draft).length > 0) {
    text += `\n\n\`\`\`trustline_draft\n${JSON.stringify(draft, null, 2)}\n\`\`\``;
  }

  return text;
}

// Distance & Real Driving Route Calculation API (Server-Side)
app.post('/api/distance/calculate', async (req, res) => {
  try {
    const { pickup, delivery } = req.body;
    if (!pickup || !delivery || pickup.trim().length < 2 || delivery.trim().length < 2) {
      return res.json({
        success: false,
        isAutoCalculated: false,
        error: 'Mesafe otomatik hesaplanamadı. KM değerini manuel girebilirsiniz.',
      });
    }

    // 1. Google Maps Distance Matrix if API key provided in server environment
    if (process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const gUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
          pickup + ', Istanbul'
        )}&destinations=${encodeURIComponent(delivery + ', Istanbul')}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
        const gRes = await fetch(gUrl);
        const gData = (await gRes.json()) as any;
        if (gData.status === 'OK' && gData.rows?.[0]?.elements?.[0]?.status === 'OK') {
          const element = gData.rows[0].elements[0];
          const distKm = Math.max(1, Math.round((element.distance.value || 0) / 1000));
          const durationMin = Math.max(10, Math.round((element.duration.value || 0) / 60));
          const pickupCoord = await resolveAddressToCoordinates(pickup);
          const deliveryCoord = await resolveAddressToCoordinates(delivery);

          return res.json({
            success: true,
            isAutoCalculated: true,
            distanceKm: distKm,
            approximateDistanceText: `Yaklaşık mesafe: ${distKm} km`,
            durationMinutes: durationMin,
            pickupCoords: pickupCoord,
            deliveryCoords: deliveryCoord,
            routePoints:
              pickupCoord && deliveryCoord
                ? generateRoutePolyline(pickupCoord, deliveryCoord)
                : [],
            provider: 'Google Maps Platform (Server-Side)',
          });
        }
      } catch (err) {
        // Fall through to built-in high-precision engine
      }
    }

    // 2. Built-in high-precision coordinates resolver
    const pickupCoord = await resolveAddressToCoordinates(pickup);
    const deliveryCoord = await resolveAddressToCoordinates(delivery);

    if (!pickupCoord || !deliveryCoord) {
      return res.json({
        success: false,
        isAutoCalculated: false,
        error: 'Mesafe otomatik hesaplanamadı. KM değerini manuel girebilirsiniz.',
      });
    }

    // Calculate realistic driving route distance
    let distKm = getCalculatedDistance(pickup, delivery);
    // If fallback 12 km was returned, compute precise haversine with road winding factor
    if (distKm === 12) {
      const straightLineKm = calculateHaversineKm(
        pickupCoord.lat,
        pickupCoord.lng,
        deliveryCoord.lat,
        deliveryCoord.lng
      );
      const isIntercontinental = pickupCoord.side !== deliveryCoord.side;
      const roadFactor = isIntercontinental ? 1.45 : 1.30;
      distKm = Math.max(2, Math.round(straightLineKm * roadFactor));
    }

    const durationMin = Math.max(15, Math.round(distKm * 2.2));
    const routePoints = generateRoutePolyline(pickupCoord, deliveryCoord);

    return res.json({
      success: true,
      isAutoCalculated: true,
      distanceKm: distKm,
      approximateDistanceText: `Yaklaşık mesafe: ${distKm} km`,
      durationMinutes: durationMin,
      pickupCoords: pickupCoord,
      deliveryCoords: deliveryCoord,
      routePoints,
      provider: 'Trustline Routing Engine (Server-Side)',
    });
  } catch (error) {
    return res.json({
      success: false,
      isAutoCalculated: false,
      error: 'Mesafe otomatik hesaplanamadı. KM değerini manuel girebilirsiniz.',
    });
  }
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Trustline Express Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
