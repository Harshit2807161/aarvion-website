"""Full-resolution cut-out of the Sacuwin 100 hero photo for Act 1's flyer, and its
blurred twin for the fly-through.

Same matte as make_cutouts.py (flood-fill the white backdrop from the edges,
erode 1 px, feather 1 px), but cropped to the alpha bounds with no downscale,
so the flyer keeps every source pixel. The largest source is the 1000 x 1000
owner photo; nothing larger exists.

The blurred twin (sacuwin-100-lg-blur.webp) is the same matte with a Gaussian
blur (sigma 10 px) applied in premultiplied alpha, so the edges fade instead of
haloing. Its canvas is padded by BLUR_PAD px on every side so the blur is not
clipped at the crop bounds; the page offsets it by the same amount, so the two
images register exactly. Act 1 crossfades to it as the carton passes the screen,
which also hides the upscaling of a 745 px source at 2.5x and beyond.

Usage (from the repository root):
  .tools/venv/bin/python -I scripts/make_flyer.py [--only sharp|blur]
"""
import json
import pathlib
import sys
from datetime import datetime, timezone

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/products/original/sacuwin-100--1--sacuwin-100-2.webp"
OUT = ROOT / "design/prototype/assets/products/sacuwin-100-lg.webp"
OUT_BLUR = ROOT / "design/prototype/assets/products/sacuwin-100-lg-blur.webp"
BLUR_SIGMA = 10.0
BLUR_PAD = 32  # > 3 sigma
BLUR_Q = 80


def cutout(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    marked = im.copy()
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        ImageDraw.floodfill(marked, xy, (255, 0, 255), thresh=14)
    fg = ImageChops.difference(marked, Image.new("RGB", marked.size, (255, 0, 255))).convert("L").point(lambda v: 255 if v > 8 else 0)
    alpha = fg.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0))
    rgba = im.convert("RGBA")
    rgba.putalpha(alpha)
    return rgba.crop(alpha.getbbox())


def gauss_blur_premultiplied(rgba, sigma, pad):
    """Separable Gaussian blur of an RGBA image in premultiplied space, on a canvas padded by `pad`."""
    a = np.asarray(rgba, dtype=np.float64) / 255.0
    h, w = a.shape[:2]
    pm = np.zeros((h + 2 * pad, w + 2 * pad, 4))
    pm[pad:pad + h, pad:pad + w, :3] = a[..., :3] * a[..., 3:4]
    pm[pad:pad + h, pad:pad + w, 3] = a[..., 3]
    r = int(np.ceil(3.5 * sigma))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    for axis in (0, 1):
        pm = np.apply_along_axis(lambda v: np.convolve(v, k, mode="same"), axis, pm)
    out = np.zeros_like(pm)
    al = pm[..., 3:4]
    out[..., :3] = np.where(al > 1e-6, pm[..., :3] / np.maximum(al, 1e-6), 0)
    out[..., 3:4] = al
    return Image.fromarray(np.round(np.clip(out, 0, 1) * 255).astype(np.uint8), "RGBA")


def sidecar(path, size, prompt, extra):
    side = {
        # "prompt" + "createdAt" are the keys `impeccable embed-prompt` reads for provenance.
        "prompt": prompt,
        "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "origin": "sourced",
        "aiGenerated": False,
        "source": str(SRC.relative_to(ROOT)),
        "generator": "scripts/make_flyer.py",
        "pixels": list(size),
        **extra,
    }
    path.with_suffix(".webp.json").write_text(json.dumps(side, indent=2) + "\n")
    print(path.name, size, f"{path.stat().st_size / 1024:.1f} KB")


def main():
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    c = cutout(SRC)
    if only in (None, "sharp"):
        c.save(OUT, quality=90, method=6)
        sidecar(OUT, c.size,
                f"Sourced, not generated: owner-supplied product photo {SRC.relative_to(ROOT)}, white backdrop removed by scripts/make_flyer.py (edge flood-fill, 1 px erode, 1 px feather) and cropped to its alpha bounds at full source resolution, {c.size[0]}x{c.size[1]}, no resampling. WebP q90 with alpha.",
                {})
    if only in (None, "blur"):
        b = gauss_blur_premultiplied(c, BLUR_SIGMA, BLUR_PAD)
        b.save(OUT_BLUR, quality=BLUR_Q, method=6)
        sidecar(OUT_BLUR, b.size,
                f"Sourced, not generated: the {c.size[0]}x{c.size[1]} Sacuwin 100 cut-out (sacuwin-100-lg.webp, from owner photo {SRC.relative_to(ROOT)}) with a Gaussian blur of sigma {BLUR_SIGMA:g} px in premultiplied alpha, on a canvas padded by {BLUR_PAD} px per side so the blur is not clipped ({b.size[0]}x{b.size[1]}). Act 1's fly-through crossfades to it. WebP q{BLUR_Q} with alpha.",
                {"derivedFrom": "design/prototype/assets/products/sacuwin-100-lg.webp", "blurSigma": BLUR_SIGMA, "pad": BLUR_PAD,
                 "command": ".tools/venv/bin/python -I scripts/make_flyer.py --only blur"})


if __name__ == "__main__":
    main()
