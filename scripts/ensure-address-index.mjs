import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const manifest = join(
  root,
  "public",
  "address-data",
  "manifest.json"
);

const force = process.argv.includes(
  "--force"
);

if (
  existsSync(manifest) &&
  !force
) {
  console.log(
    "[address-index] Static Turkey address index already exists."
  );
  process.exit(0);
}

const candidates =
  process.platform === "win32"
    ? [
        { command: "py", prefix: ["-3"] },
        { command: "python", prefix: [] },
        { command: "python3", prefix: [] },
      ]
    : [
        { command: "python3", prefix: [] },
        { command: "python", prefix: [] },
      ];

function findPython(list) {
  for (const candidate of list) {
    const check = spawnSync(
      candidate.command,
      [...candidate.prefix, "-c", "import sys; print(sys.version)"],
      { stdio: "pipe", encoding: "utf8", windowsHide: true }
    );

    if (check.status === 0) return candidate;
  }

  return null;
}

let python = findPython(candidates);

if (!python && process.platform === "win32") {
  console.log(
    "[address-index] Python 3 bulunamadı. Python 3.13 otomatik kuruluyor..."
  );

  spawnSync(
    "winget",
    [
      "install",
      "--exact",
      "--id",
      "Python.Python.3.13",
      "--scope",
      "user",
      "--accept-source-agreements",
      "--accept-package-agreements",
    ],
    { stdio: "inherit", windowsHide: true }
  );

  /*
   * winget "already installed" durumunda 0 dışı kod döndürebilir.
   * Bu durumda Python kurulmuş olsa bile hata vermemek için
   * bilinen per-user kurulum yollarını mutlaka kontrol ediyoruz.
   */
  const appData = process.env.LOCALAPPDATA || "";
  const knownPaths = [
    appData + "\\Programs\\Python\\Python313\\python.exe",
    appData + "\\Programs\\Python\\Python313\\python3.exe",
    "C:\\Program Files\\Python313\\python.exe",
    "C:\\Python313\\python.exe",
  ];

  for (const executable of knownPaths) {
    const check = spawnSync(
      executable,
      ["-c", "import sys; print(sys.version)"],
      { stdio: "pipe", encoding: "utf8", windowsHide: true }
    );

    if (check.status === 0) {
      python = { command: executable, prefix: [] };
      console.log(
        "[address-index] Python bulundu: " + executable
      );
      break;
    }
  }
}

if (!python) {
  console.error(
    "[address-index] Python 3.13+ bulunamadı ve otomatik kurulum başarısız oldu."
  );
  process.exit(1);
}

const requirementsCheck = spawnSync(
  python.command,
  [
    ...python.prefix,
    "-c",
    "import geopandas, pyarrow, pyrosm",
  ],
  { stdio: "pipe", encoding: "utf8", windowsHide: true }
);

if (requirementsCheck.status !== 0) {
  if (process.platform === "win32") {
    console.log(
      "[address-index] Python paketlerinden cykhash derlemesi gerekebilir. MSVC C++ Build Tools otomatik kuruluyor..."
    );

    const buildTools = spawnSync(
      "winget",
      [
        "install",
        "--exact",
        "--id",
        "Microsoft.VisualStudio.2022.BuildTools",
        "--override",
        "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended",
        "--accept-source-agreements",
        "--accept-package-agreements",
      ],
      { stdio: "inherit", windowsHide: true }
    );

    if (
      buildTools.status !== 0 &&
      buildTools.status !== 3010 &&
      buildTools.status !== 1641
    ) {
      console.error(
        "[address-index] Visual Studio C++ Build Tools otomatik kurulamadı."
      );
      process.exit(
        buildTools.status ?? 1
      );
    }
  }

  console.log(
    "[address-index] GeoPandas, PyArrow ve pyrosm kuruluyor..."
  );

  const install = spawnSync(
    python.command,
    [
      ...python.prefix,
      "-m",
      "pip",
      "install",
      "--upgrade",
      "pip",
      "geopandas",
      "pyarrow",
      "pyrosm==0.13.1",
    ],
    { stdio: "inherit", windowsHide: true }
  );

  if (install.status !== 0) {
    console.error(
      "[address-index] OSM Python paketlerinin kurulumu başarısız."
    );
    process.exit(install.status ?? 1);
  }
}

const args = [
  "scripts/build-turkey-address-index.py",
];

if (force) {
  args.push("--force");
}

console.log(
  "[address-index] Building static Turkey OSM address data..."
);

const result =
  spawnSync(
    python.command,
    [
      ...python.prefix,
      ...args,
    ],
    {
      stdio: "inherit",
      windowsHide: true,
    }
  );

if (
  result.status !== 0
) {
  console.error(
    "[address-index] Address index generation failed."
  );
  process.exit(
    result.status ?? 1
  );
}
