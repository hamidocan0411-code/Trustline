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
        {
          command: "py",
          prefix: ["-3"],
        },
        {
          command: "python",
          prefix: [],
        },
        {
          command: "python3",
          prefix: [],
        },
      ]
    : [
        {
          command: "python3",
          prefix: [],
        },
        {
          command: "python",
          prefix: [],
        },
      ];

let python = null;

for (const candidate of candidates) {
  const check =
    spawnSync(
      candidate.command,
      [
        ...candidate.prefix,
        "-c",
        "import sys; print(sys.version)",
      ],
      {
        stdio: "pipe",
        encoding: "utf8",
        windowsHide: true,
      }
    );

  if (
    check.status === 0
  ) {
    python = candidate;
    break;
  }
}

if (!python) {
  console.error(
    "[address-index] Python 3 is required to generate the OSM index. Install Python 3.13+ and run the build again."
  );
  process.exit(1);
}

const hasPyrosm =
  spawnSync(
    python.command,
    [
      ...python.prefix,
      "-c",
      "import pyrosm",
    ],
    {
      stdio: "pipe",
      encoding: "utf8",
      windowsHide: true,
    }
  );

if (
  hasPyrosm.status !== 0
) {
  console.log(
    "[address-index] pyrosm not installed. Installing pyrosm==0.13.1..."
  );

  const install =
    spawnSync(
      python.command,
      [
        ...python.prefix,
        "-m",
        "pip",
        "install",
        "pyrosm==0.13.1",
      ],
      {
        stdio: "inherit",
        windowsHide: true,
      }
    );

  if (
    install.status !== 0
  ) {
    console.error(
      "[address-index] pyrosm installation failed."
    );
    process.exit(
      install.status ?? 1
    );
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
