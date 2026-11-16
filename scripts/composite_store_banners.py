"""Store hero banners: real Aarvion pack cutouts composited onto the generated store scenes,
then cropped and encoded for the home page carousel.

Usage: python3 -I scripts/composite_store_banners.py <project_root> [--review <dir>]

Inputs  assets/banners/store/{sacuwin,eye,rx,delivery}-scene.png   (1792x768, no products or text)
        assets/products/cutout/<slug>.webp                        (transparent pack cutouts)
Outputs design/prototype/assets/banners/<scene>-{1792,1280,m}.webp  + <file>.json provenance sidecars
        --review <dir>: full-size PNG composites with no crop, for inspection at 1:1

Placement reuses the shadowed place() idea from scripts/composite_banners.py, with the shadow split in
two: a tight contact line where the carton base meets the pedestal (the occlusion that stops a pack
from floating) and a soft cast shadow thrown away from the scene's key light. Packs farther from the
camera take a little of the scene's haze so they sit in the same air as the pedestals.
Where a scene has dappled light (the eye scene's leaf shadows), the packs are relit by it: the
scene's own light map (its luminance at a fine blur over a broad local mean, taken from the bare
scene where each pack stands) is multiplied over the pack, scaled to the light level of the surface
it stands on and tinted by the scene's air, and the pack is softened to the scene's focus.
Text is never baked in: every headline stays live HTML.
"""
import sys, json, pathlib, hashlib, datetime
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageEnhance

ROOT = pathlib.Path(sys.argv[1]).resolve()
REVIEW = pathlib.Path(sys.argv[sys.argv.index("--review") + 1]) if "--review" in sys.argv else None
SCENES = ROOT / "assets/banners/store"
CUT = ROOT / "assets/products/cutout"
OUT = ROOT / "design/prototype/assets/banners"
SCRIPT = "scripts/composite_store_banners.py"

# Scene provenance, from assets/banners/store/PROVENANCE.md
ORIGIN = {
    "sacuwin": {"source": "assets/banners/store/sacuwin-scene.png", "generator": "GPT Image 2.5, run in Figma (round-1 direction d1-pedestal--gpt; see docs/review/style-round-1.html section 4)", "figmaFile": None, "node": "not recorded (round 1)"},
    "eye": {"source": "assets/banners/store/eye-scene.png", "generator": "gpt-image-2.5-flare, run in Figma", "figmaFile": "dlvnZAbqR9Vbnk3Sg7Eixi", "node": "4:2"},
    "rx": {"source": "assets/banners/store/rx-scene.png", "generator": "gpt-image-2.5-flare, run in Figma", "figmaFile": "dlvnZAbqR9Vbnk3Sg7Eixi", "node": "4:3"},
    "delivery": {"source": "assets/banners/store/delivery-scene.png", "generator": "gpt-image-2.5-flare, run in Figma", "figmaFile": "dlvnZAbqR9Vbnk3Sg7Eixi", "node": "4:4"},
}


def lightmap(bare):
    """The bare scene's light: fine and broad luminance and the broad colour of its air."""
    L = bare.convert("L")
    return {"fine": L.filter(ImageFilter.GaussianBlur(4)), "broad": L.filter(ImageFilter.GaussianBlur(70)),
            "air": bare.convert("RGB").filter(ImageFilter.GaussianBlur(70))}


def relight(p, lm, x, y, base_y, strength):
    """Multiply the scene's dappled light over the pack (see the module note)."""
    w, h = p.size
    box = (x, y, x + w, y + h)
    fine = list(lm["fine"].crop(box).get_flattened_data()); broad = list(lm["broad"].crop(box).get_flattened_data())
    # the light level of the surface the pack stands on, against the scene's brightest stone (~250)
    seat = lm["fine"].crop((x + w // 4, base_y - 4, x + 3 * w // 4, base_y + 4))
    sv = list(seat.get_flattened_data()); level = max(0.86, min(1.0, sum(sv) / len(sv) / 250))
    ar, ag, ab = lm["air"].crop(box).resize((1, 1), Image.BOX).getpixel((0, 0))
    top = max(ar, ag, ab); tint = [1 - 0.4 * (1 - c / top) for c in (ar, ag, ab)]
    out = []
    for (r, g, b, a), f, bb in zip(p.get_flattened_data(), fine, broad):
        m = max(0.62, min(1.15, 1 + strength * (f / max(bb, 1) - 1))) * level
        out.append((min(255, int(r * m * tint[0])), min(255, int(g * m * tint[1])), min(255, int(b * m * tint[2])), a))
    q = Image.new("RGBA", p.size); q.putdata(out)
    return q


def place(scene, prod, cx, base_y, width, *, light=-1.0, haze=0.0, haze_rgb=(220, 232, 224), contact=175, cast=80, wrap=0.32, lm=None, relit=0.0, soft=0.0):
    """Stand `prod` on a surface. cx: centre x (px); base_y: y of the pack's front-bottom edge (px);
    width: drawn width (px); light: -1 throws the cast shadow left (key light from the right), +1 right.
    haze: 0-1 share of the scene's air mixed into the pack (aerial perspective for packs farther back)."""
    S = scene.size
    w = int(round(width)); h = int(round(prod.height * w / prod.width))
    p = prod.resize((w, h), Image.LANCZOS)
    if haze:
        a = p.getchannel("A")
        rgb = Image.blend(p.convert("RGB"), Image.new("RGB", p.size, haze_rgb), haze)
        rgb = ImageEnhance.Contrast(rgb).enhance(1 - haze * 0.6)
        p = rgb.convert("RGBA"); p.putalpha(a)
    x = int(round(cx - w / 2)); y = int(round(base_y - h))
    if lm is not None and relit:
        p = relight(p, lm, x, y, base_y, relit)
    if soft:
        # the scene's focus: blur premultiplied, so the transparent edge never bleeds a halo
        p = p.convert("RGBa").filter(ImageFilter.GaussianBlur(soft)).convert("RGBA")

    # soft cast shadow: a flattened ellipse thrown away from the light, on the surface plane
    m = Image.new("L", S, 0); d = ImageDraw.Draw(m)
    sx = light * w * 0.16
    d.ellipse([x + w * 0.02 + sx, base_y - h * 0.02, x + w * 1.0 + sx, base_y + max(6, w * 0.07)], fill=cast)
    m = m.filter(ImageFilter.GaussianBlur(max(5, w / 16)))
    # contact: a tight dark line hugging the base, where light cannot reach under the carton
    c = Image.new("L", S, 0); d = ImageDraw.Draw(c)
    d.ellipse([x + w * 0.03, base_y - 3, x + w * 0.97, base_y + max(3, w * 0.018)], fill=contact)
    c = c.filter(ImageFilter.GaussianBlur(max(1.6, w / 90)))
    for mask in (m, c):
        dark = Image.new("RGBA", S, (22, 40, 30, 0)); dark.putalpha(mask)
        scene = Image.alpha_composite(scene, dark)
    # light wrap: let a little of the blurred surroundings spill over the pack's outer edge, the way
    # a lens does in one exposure, so the cut line stops reading as a sticker edge
    a = Image.new("L", S, 0); a.paste(p.getchannel("A"), (x, y))
    inner = a.filter(ImageFilter.MinFilter(5))
    ring = ImageChops.subtract(a, inner).filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: int(v * wrap))
    bg = scene.filter(ImageFilter.GaussianBlur(6))   # the surroundings before the pack lands
    scene.alpha_composite(p, (x, y))
    return Image.composite(bg, scene, ring)


def cut(slug):
    im = Image.open(CUT / f"{slug}.webp").convert("RGBA")
    return im.crop(im.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox())


# (slug, cx, base_y, width, options). Back-to-front order: later packs draw over earlier ones.
# Geometry measured on the 1792x768 scenes (top faces: sacuwin green 382-399, white 480-510;
# eye back pedestal 386-402, front disc 477-497). Packs stand just in front of each face's centre line.
JOBS = {
    "sacuwin": {
        "packs": [
            ("sacuwin-50", 1240, 395, 142, {"light": -1, "haze": 0.06}),
            ("sacuwin-100", 1382, 500, 152, {"light": -1}),
            ("sacuwin-200", 1530, 499, 116, {"light": -1}),
        ],
        "desk_y": 140,                 # top of the 1792x588 desktop crop
        "mob": (962, 210, 830, 467),   # x, y, w, h of the 16:9 phone crop, framed on the packs
    },
    "eye": {
        "packs": [
            # back pedestal: about 85% of the front packs' scale, so size recedes with depth;
            # every eye pack takes the scene's dappled leaf light and its softness
            ("sysnet-ultra", 1350, 396, 122, {"light": -1, "cast": 60, "haze": 0.07, "haze_rgb": (205, 218, 206), "relit": 1.8, "soft": 1.0}),
            ("oloage-kt", 1498, 396, 124, {"light": -1, "cast": 60, "haze": 0.07, "haze_rgb": (205, 218, 206), "relit": 1.8, "soft": 1.0}),
            ("hyloage", 1044, 490, 190, {"light": -1, "cast": 60, "relit": 1.8, "soft": 0.7}),
            ("caftop", 1214, 490, 116, {"light": -1, "cast": 60, "relit": 1.8, "soft": 0.7}),
        ],
        "desk_y": 150,
        "mob": (900, 210, 800, 450),
    },
    "rx": {"packs": [], "desk_y": 180, "mob": (960, 300, 820, 461)},
    "delivery": {"packs": [], "desk_y": 160, "mob": (992, 300, 800, 450)},
}

DESK = (1792, 588)  # about 3.05:1, the carousel's 1280x420 at 1.4x
MOB = (840, 472)    # 16:9, every phone crop is resampled to this


def encode(img, path, q):
    img.save(path, "WEBP", quality=q, method=6)
    return path.stat().st_size


def sidecar(path, name, used, crop, size, q):
    o = ORIGIN[name]
    node = f"Figma file {o['figmaFile']}, node {o['node']}" if o["figmaFile"] else o["node"]
    meta = {
        # "prompt" + "createdAt" are the keys `impeccable embed-prompt --scan` reads. The scene's own
        # generation prompt was not recorded, so the origin is stated instead.
        "prompt": (f"Composite, not generated as one image. Scene: {o['source']} ({o['generator']}; {node}; generation prompt not recorded; no products, text or logos in it). "
                   + (f"Real pack cutouts placed by {SCRIPT}: " + ", ".join(used) + "." if used else f"No packs; cropped and encoded by {SCRIPT}.")),
        "createdAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "file": path.name,
        "origin": "AI-generated scene with real product photographs composited on top" if used else "AI-generated scene, no products",
        "scene": o["source"],
        "sceneGenerator": o["generator"],
        "figmaFile": o["figmaFile"],
        "figmaNode": o["node"],
        "sceneSha256": hashlib.sha256((ROOT / o["source"]).read_bytes()).hexdigest()[:16],
        "cutouts": [f"assets/products/cutout/{s}.webp" for s in used],
        "cutoutOrigin": "owner product photos (assets/products/original), background removed by scripts/make_cutouts.py",
        "generator": SCRIPT,
        "command": f"python3 -I {SCRIPT} <project_root>",
        "crop": {"x": crop[0], "y": crop[1], "w": crop[2] - crop[0], "h": crop[3] - crop[1], "of": "1792x768 composite"},
        "pixels": list(size),
        "encode": f"Pillow WebP quality {q} method 6",
        "bytes": path.stat().st_size,
        "text": "none baked in; headline, line and button are live HTML",
        "date": datetime.date.today().isoformat(),
    }
    path.with_name(path.name + ".json").write_text(json.dumps(meta, indent=1) + "\n")


def fit(img, path, budget=120_000):
    for q in (86, 82, 78, 74, 70, 66, 62):
        if encode(img, path, q) <= budget:
            return q
    return q


OUT.mkdir(parents=True, exist_ok=True)
report = []
for name, job in JOBS.items():
    scene = Image.open(SCENES / f"{name}-scene.png").convert("RGBA")
    lm = lightmap(scene) if any(o.get("relit") for *_, o in job["packs"]) else None
    for slug, cx, by, w, opt in job["packs"]:
        scene = place(scene, cut(slug), cx, by, w, lm=lm, **opt)
    rgb = scene.convert("RGB")
    used = [j[0] for j in job["packs"]]
    if REVIEW:
        REVIEW.mkdir(parents=True, exist_ok=True)
        rgb.save(REVIEW / f"{name}-composite.png")
    y = job["desk_y"]; dc = (0, y, DESK[0], y + DESK[1])
    desk = rgb.crop(dc)
    for wpx, tag in ((1792, "1792"), (1280, "1280")):
        im = desk if wpx == 1792 else desk.resize((1280, round(1280 * DESK[1] / DESK[0])), Image.LANCZOS)
        f = OUT / f"{name}-{tag}.webp"; q = fit(im, f)
        sidecar(f, name, used, dc, im.size, q); report.append((f.name, im.size, f.stat().st_size, q))
    mx, my, mw, mh = job["mob"]; mc = (mx, my, mx + mw, my + mh)
    mob = rgb.crop(mc).resize(MOB, Image.LANCZOS)
    f = OUT / f"{name}-m.webp"; q = fit(mob, f)
    sidecar(f, name, used, mc, mob.size, q); report.append((f.name, mob.size, f.stat().st_size, q))

for r in report:
    print(f"{r[0]:22} {r[1][0]}x{r[1][1]:<5} {r[2]/1024:6.1f} KB  q{r[3]}")
