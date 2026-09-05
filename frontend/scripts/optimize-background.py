"""Generate WebP variants of the login page background."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "src" / "assets"
SOURCE = ASSETS / "background.png"


def main() -> None:
    im = Image.open(SOURCE)
    im.save(ASSETS / "background.webp", "WEBP", quality=92, method=6)
    upscaled = im.resize((im.width * 2, im.height * 2), Image.Resampling.LANCZOS)
    upscaled.save(ASSETS / "background@2x.webp", "WEBP", quality=90, method=6)
    print(f"Wrote background.webp and background@2x.webp from {SOURCE.name} ({im.size[0]}x{im.size[1]})")


if __name__ == "__main__":
    main()
