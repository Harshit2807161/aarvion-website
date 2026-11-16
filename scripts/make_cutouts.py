"""Transparent cutouts (WebP with alpha) of each product's hero photo, for placing packs on coloured grounds.
Usage: python3 -I make_cutouts.py <project_root>"""
import sys, json, pathlib
from PIL import Image, ImageDraw, ImageFilter, ImageChops
P = pathlib.Path(sys.argv[1]); out = P/"assets/products/cutout"; out.mkdir(parents=True, exist_ok=True)
def cutout(path):
    im = Image.open(path).convert("RGB"); W, H = im.size; marked = im.copy()
    for xy in [(0,0),(W-1,0),(0,H-1),(W-1,H-1),(W//2,0),(W//2,H-1),(0,H//2),(W-1,H//2)]:
        ImageDraw.floodfill(marked, xy, (255,0,255), thresh=14)
    fg = ImageChops.difference(marked, Image.new("RGB", marked.size, (255,0,255))).convert("L").point(lambda v: 255 if v > 8 else 0)
    alpha = fg.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0))
    rgba = im.convert("RGBA"); rgba.putalpha(alpha); return rgba.crop(alpha.getbbox())
data = json.load(open(P/"data/products.json"))
for p in data["products"]:
    c = cutout(P/p["heroImage"]); c.thumbnail((900, 900))
    c.save(out/f"{p['slug']}.webp", quality=88, method=6)
    print(p["slug"], c.size)
