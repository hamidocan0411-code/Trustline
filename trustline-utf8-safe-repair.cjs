const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = process.cwd();

const EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".css", ".scss", ".html", ".md",
  ".txt", ".yml", ".yaml", ".rules",
]);

const DIRECT = [
  ["â˜…", "★"],
  ["â­", "⭐"],
  ["âœ“", "✓"],
  ["âœ…", "✅"],
  ["âœ—", "✗"],
  ["âŒ", "❌"],
  ["âš ï¸", "⚠️"],
  ["âš ", "⚠"],
  ["â„¹ï¸", "ℹ️"],
  ["â„¹", "ℹ"],
  ["âš¡", "⚡"],
  ["â†’", "→"],
  ["â†", "←"],
  ["â†‘", "↑"],
  ["â†“", "↓"],
  ["””", "—"],
  ["“”", "“”"],
];

const SPECIAL = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85,
  "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8A,
  "‹": 0x8B, "Œ": 0x8C, "Ž": 0x8E, "‘": 0x91, "’": 0x92,
  "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9A, "›": 0x9B, "œ": 0x9C,
  "ž": 0x9E, "Ÿ": 0x9F,
};

function mojibakeScore(text) {
  const hits = text.match(/[ÃÄÅÂâð]/g);
  let score = hits ? hits.length : 0;

  // Common leaked C1 control characters from bad UTF-8 conversion.
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x80 && cp <= 0x9F) score += 1;
  }

  return score;
}

function bytesFromWindows1252(text) {
  const bytes = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);

    if (cp <= 0x7F || (cp >= 0xA0 && cp <= 0xFF)) {
      bytes.push(cp);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(SPECIAL, ch)) {
      bytes.push(SPECIAL[ch]);
      continue;
    }

    return null;
  }

  return Buffer.from(bytes);
}

function genericRepair(text) {
  let current = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < 6; i += 1) {
    const beforeScore = mojibakeScore(current);
    if (beforeScore === 0) break;

    const bytes = bytesFromWindows1252(current);
    if (!bytes) break;

    const decoded = bytes.toString("utf8");

    if (decoded.includes("\uFFFD") || decoded === current) {
      break;
    }

    const afterScore = mojibakeScore(decoded);

    // Accept only when the text becomes strictly less mojibaked.
    if (afterScore < beforeScore) {
      current = decoded;
    } else {
      break;
    }
  }

  return current;
}

function directRepair(text) {
  let result = text;

  for (const [bad, good] of DIRECT) {
    result = result.split(bad).join(good);
  }

  return result;
}

function isTextFile(file) {
  return (
    EXTENSIONS.has(path.extname(file).toLowerCase()) ||
    file.endsWith(".firebaserc")
  );
}

function readTrackedFiles() {
  const output = execFileSync(
    "git",
    ["ls-files", "-z"],
    { encoding: "utf8" }
  );

  return output
    .split("\0")
    .filter(Boolean)
    .filter(isTextFile);
}

const tracked = readTrackedFiles();
const changed = [];

for (const file of tracked) {
  const absolute = path.join(ROOT, file);

  if (!fs.existsSync(absolute)) continue;

  const original = fs.readFileSync(absolute, "utf8");

  // First repair known visible symbols, then generic mojibake.
  let repaired = directRepair(original);
  repaired = genericRepair(repaired);

  // A second direct pass catches symbols exposed by generic decoding.
  repaired = directRepair(repaired);

  if (repaired !== original) {
    fs.writeFileSync(absolute, repaired, "utf8");
    changed.push(file);
    console.log(`FIXED: ${file}`);
  }
}

console.log("");
console.log(`Tarandı: ${tracked.length} metin dosyası`);
console.log(`Düzeltilen: ${changed.length} dosya`);

if (changed.length === 0) {
  console.log("Mojibake düzeltmesi gerektiren dosya bulunmadı.");
}

// Verify before build.
const verify = spawnSync(
  process.platform === "win32" ? "git.exe" : "git",
  [
    "grep",
    "-nE",
    "Ã|Â|â|Ä|Å|ðŸ|””",
    "--",
    ".",
    ":(exclude)node_modules",
    ":(exclude)dist",
  ],
  { encoding: "utf8" }
);

if (verify.status === 0) {
  console.error("");
  console.error("UYARI: Hâlâ bozuk UTF-8 kalıntıları var:");
  console.error(verify.stdout);
  process.exitCode = 2;
} else {
  console.log("✅ Kalan mojibake taraması temiz.");
}
