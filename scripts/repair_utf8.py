from pathlib import Path
import subprocess
import sys

try:
    from ftfy import fix_text
except ImportError:
    print("ftfy bulunamadı")
    sys.exit(1)

EXCLUDED_PARTS = {
    ".git",
    "node_modules",
    "dist",
    ".firebase",
}

TEXT_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".json", ".md", ".html", ".css", ".scss",
    ".yml", ".yaml", ".rules", ".txt",
}

SPECIAL_NAMES = {
    ".env.example",
    ".firebaserc",
    "firebase.json",
}


def tracked_files():
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        check=True,
        stdout=subprocess.PIPE,
    )
    return [Path(item) for item in result.stdout.decode("utf-8").split("\0") if item]


def should_scan(path: Path) -> bool:
    if any(part in EXCLUDED_PARTS for part in path.parts):
        return False
    return path.name in SPECIAL_NAMES or path.suffix.lower() in TEXT_EXTENSIONS


def main() -> int:
    changed = []

    for path in tracked_files():
        if not should_scan(path) or not path.is_file():
            continue

        raw = path.read_bytes()
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            continue

        fixed = fix_text(text)
        if fixed.startswith("\ufeff"):
            fixed = fixed.lstrip("\ufeff")

        if fixed != text:
            path.write_text(fixed, encoding="utf-8", newline="")
            changed.append(str(path))
            print(f"FIXED: {path}")

    print(f"TOPLAM DÜZELTİLEN DOSYA: {len(changed)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
