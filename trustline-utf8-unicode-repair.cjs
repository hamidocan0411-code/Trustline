const fs = require("fs");

const fixes = {
  "src/components/AdminPanel.tsx": [
    ["SİPARİŞ\u009e", "SİPARİŞ"],
    ["Şu anda canlı GPS", "Şu anda canlı GPS"],
    ["Å\u009e", "Ş"],
    ["Ä\u009e", "Ğ"],
    ["\u009e", ""]
  ],

  "src/components/RouteMap.tsx": [
    ["BAÅ\u009eLAT", "BAŞLAT"],
    ["SIÄ\u009eDIR", "SIĞDIR"],
    ["BOŞ\u009e", "BOŞ"],
    ["Å\u009e", "Ş"],
    ["Ä\u009e", "Ğ"],
    ["\u009e", ""]
  ],

  "src/services/storage.ts": [
    ["MÜÅ\u009eTERİ", "MÜŞTERİ"],
    ["Å\u009eifre", "Şifre"],
    ["Å\u009e", "Ş"],
    ["Ä\u009e", "Ğ"],
    ["\u009e", ""]
  ]
};

for (const [file, pairs] of Object.entries(fixes)) {
  let text = fs.readFileSync(file, "utf8");
  const original = text;

  for (const [from, to] of pairs) {
    text = text.split(from).join(to);
  }

  if (text !== original) {
    fs.writeFileSync(file, text, "utf8");
    console.log("FIXED:", file);
  } else {
    console.log("UNCHANGED:", file);
  }
}

console.log("");
console.log("Kontrol:");
for (const file of Object.keys(fixes)) {
  const text = fs.readFileSync(file, "utf8");
  const count009e = [...text].filter(ch => ch.charCodeAt(0) === 0x009e).length;

  if (count009e > 0) {
    console.log(`KALDI: ${file} -> U+009E: ${count009e}`);
  } else {
    console.log(`TEMİZ: ${file}`);
  }
}
