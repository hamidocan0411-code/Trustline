const fs = require("fs");

const replacements = {
  "src/components/AdminPanel.tsx": [
    ["SIPARIÅ", "SİPARİŞ"],
    ["Åu anda canlı GPS", "Şu anda canlı GPS"],
    ['"Ã‡evrimdÄ±ÅŸÄ±"', '"Çevrimdışı"'],
    ['KM Ã—', 'KM ×']
  ],

  "src/components/CourierPanel.tsx": [
    ['"Ã‡evrimdÄ±ÅŸÄ±"', '"Çevrimdışı"'],
    ['"ÇevrimdÄ±ÅŸÄ±"', '"Çevrimdışı"'],
    ['"MÃ¼sait"', '"Müsait"'],
    ['"MeÅŸgul"', '"Meşgul"']
  ],

  "src/components/RouteMap.tsx": [
    ["BAÅLAT", "BAŞLAT"],
    ["SIÄDIR", "SIĞDIR"],
    ["BOÅ", "BOŞ"]
  ],

  "src/services/storage.ts": [
    ['MÜÅTERİ', 'MÜŞTERİ'],
    ['"Åifre en az 6 karakter olmalıdır."', '"Şifre en az 6 karakter olmalıdır."']
  ]
};

let changed = 0;

for (const [file, pairs] of Object.entries(replacements)) {
  let text = fs.readFileSync(file, "utf8");
  const original = text;

  for (const [from, to] of pairs) {
    text = text.split(from).join(to);
  }

  if (text !== original) {
    fs.writeFileSync(file, text, "utf8");
    changed++;
    console.log("FIXED:", file);
  } else {
    console.log("UNCHANGED:", file);
  }
}

console.log("");
console.log("Düzeltilen dosya:", changed);
