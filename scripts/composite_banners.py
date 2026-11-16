"""Round-1 banner composites: real Aarvion pack photos placed on AI-generated pedestal scenes.
Usage: python3 -I composite_banners.py <project_root>"""
import sys, pathlib
from PIL import Image, ImageDraw, ImageFilter, ImageChops
P = pathlib.Path(sys.argv[1]); R = P/"assets/banners/round1"; O = P/"assets/products/original"

def cutout(path):
    im = Image.open(path).convert("RGB")
    W, H = im.size
    marked = im.copy()
    for xy in [(0,0),(W-1,0),(0,H-1),(W-1,H-1),(W//2,0),(W//2,H-1),(0,H//2),(W-1,H//2)]:
        ImageDraw.floodfill(marked, xy, (255,0,255), thresh=14)
    bg = ImageChops.difference(marked, Image.new("RGB", marked.size, (255,0,255))).convert("L").point(lambda v: 255 if v > 8 else 0)
    alpha = bg.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    rgba = im.convert("RGBA"); rgba.putalpha(alpha)
    return rgba.crop(alpha.getbbox())

def place(scene, prod, cx, base_y, width):
    """cx/base_y as fractions of scene; width as fraction of scene width."""
    S = scene.size; w = int(S[0]*width); h = int(prod.height * w / prod.width)
    p = prod.resize((w, h), Image.LANCZOS)
    x = int(S[0]*cx - w/2); y = int(S[1]*base_y - h)
    sh = Image.new("L", S, 0); d = ImageDraw.Draw(sh)
    d.ellipse([x + w*0.06, y + h - h*0.035, x + w*0.94, y + h + h*0.045], fill=110)
    sh = sh.filter(ImageFilter.GaussianBlur(max(4, w//28)))
    dark = Image.new("RGBA", S, (20, 50, 35, 0)); dark.putalpha(sh)
    scene = Image.alpha_composite(scene, dark)
    scene.alpha_composite(p, (x, y))
    return scene

packs = {
 "s100": cutout(O/"sacuwin-100--1--sacuwin-100-2.webp"),
 "s200": cutout(O/"sacuwin-200--1--sacuwin-200-3.webp"),
 "s50":  cutout(O/"sacuwin-50--1--sacuwin-50-2.webp"),
}
# (scene, [(pack, cx, base_y, width)])
jobs = {
 "d1-pedestal--gemini": [("s200", 0.672, 0.585, 0.105), ("s100", 0.820, 0.690, 0.150)],
 "d1-pedestal--gpt":    [("s200", 0.700, 0.535, 0.100), ("s100", 0.805, 0.660, 0.150)],
 "d2-studio--gemini":   [("s50", 0.660, 0.715, 0.150), ("s100", 0.810, 0.720, 0.150)],
 "d2-studio--gpt":      [("s50", 0.680, 0.665, 0.140), ("s100", 0.820, 0.670, 0.140)],
}
for name, items in jobs.items():
    scene = Image.open(R/f"{name}.png").convert("RGBA")
    for key, cx, by, w in items: scene = place(scene, packs[key], cx, by, w)
    scene.convert("RGB").save(R/f"{name}--with-packs.webp", quality=84)
for f in R.glob("*.png"):
    Image.open(f).convert("RGB").save(f.with_suffix(".webp"), quality=84)
print(sorted(x.name for x in R.glob("*.webp")))
