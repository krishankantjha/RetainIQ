"""Regenerate WebP + favicon icon from logo-dark.png and logo-light.png."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops

ASSETS = Path(__file__).resolve().parent.parent / "src" / "assets"
MAX_WIDTH = 680
BG_TOLERANCE = 30


def trim(im: Image.Image) -> Image.Image:
    bg = Image.new("RGBA", im.size, im.getpixel((0, 0)))
    diff = ImageChops.difference(im, bg)
    bbox = diff.getbbox()
    return im.crop(bbox) if bbox else im


def remove_corner_background(im: Image.Image, tolerance: int = BG_TOLERANCE) -> Image.Image:
    rgba = im.convert("RGBA")
    corner = rgba.getpixel((0, 0))[:3]
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if (
                abs(red - corner[0]) <= tolerance
                and abs(green - corner[1]) <= tolerance
                and abs(blue - corner[2]) <= tolerance
            ):
                pixels[x, y] = (red, green, blue, 0)
    return rgba


def resize_if_needed(im: Image.Image, max_w: int) -> Image.Image:
    w, h = im.size
    if w <= max_w:
        return im
    nh = round(h * max_w / w)
    return im.resize((max_w, nh), Image.Resampling.LANCZOS)


def save_pair(name: str, im: Image.Image) -> None:
    im = resize_if_needed(trim(remove_corner_background(im.convert("RGBA"))), MAX_WIDTH)
    png_path = ASSETS / f"{name}.png"
    webp_path = ASSETS / f"{name}.webp"
    im.save(png_path, "PNG", optimize=True, compress_level=9)
    im.save(webp_path, "WEBP", quality=88, method=6)
    print(f"{name}: {im.size[0]}x{im.size[1]} — png {png_path.stat().st_size // 1024}KB")


def main() -> None:
    dark_path = ASSETS / "logo-dark.png"
    light_path = ASSETS / "logo-light.png"
    if not dark_path.exists() or not light_path.exists():
        raise SystemExit(
            "Missing logo-dark.png or logo-light.png in frontend/src/assets/"
        )

    save_pair("logo-dark", Image.open(dark_path))
    save_pair("logo-light", Image.open(light_path))

    dark_rgba = Image.open(ASSETS / "logo-dark.png").convert("RGBA")
    dw, dh = dark_rgba.size
    icon = trim(dark_rgba.crop((0, 0, int(dw * 0.28), dh)))
    icon = icon.resize((128, 128), Image.Resampling.LANCZOS)
    icon.save(ASSETS / "logo-icon.png", "PNG", optimize=True, compress_level=9)
    icon.save(ASSETS / "logo-icon.webp", "WEBP", quality=88, method=6)
    print(f"logo-icon: 128x128 — png {(ASSETS / 'logo-icon.png').stat().st_size // 1024}KB")
    print("Done.")


if __name__ == "__main__":
    main()
