"""Procedural blister-foil rasters for the Aarvion home prototype.

Renders every foil raster the page uses from one physical model, with no AI
generation and no source photos:

  foil-plate.webp       the lit foil body of the strip at 2x: rolling undulation, soft
                        crumple and the specular roll highlights they catch. Tileable.
  foil-knurl.webp       the diamond knurl emboss as a light/shadow overlay (white and black
                        with alpha), an exact-period tile layered over the plate.
  foil-knurl-print.webp the same knurl at 0.32 gain: the smooth print field under text.
  foil-fill.webp        the foil body seen 1.5x closer, tileable, for Act 1's full-frame fill.
  foil-knurl-fill.webp  the knurl at the fill's 1.5x pitch.
  *-1x.webp             1x twins of the knurl tiles (exact 2x2 area average) for 1x screens.
  foil-glint.webp       a soft specular band (alpha) that Act 1 slides across the foil.
  dome-floor.webp       the smooth pressed-foil floor inside a blister pocket.
  dome-<aspect>.webp    clear PVC blister domes (alpha), one per pocket aspect: contact
                        shadow, heat-seal band, crease, wall refraction, Fresnel reflection,
                        rim light and a window highlight held to the rim band (the pack
                        under the dome is veiled by at most 15%). 9-slice ready.

Why the knurl is its own tile: the emboss is fine, high-energy detail. Baked into a
2880 px plate it costs 250-360 KB as WebP at any usable quality. Kept exactly
periodic it compresses losslessly to a few KB, and the plate body under it is smooth
enough to cost under 20 KB. The page stacks the two as background layers, so the
look is the same model rendered in two passes: knurl shading is written as the
exact light/shadow delta it adds at the plate's mean brightness.

Model: heightfields turned into normals and lit like lacquered aluminium, with an
environment reflection (soft key box upper left, dim fill lower right, bright
ceiling, darker floor), a Blinn-Phong sparkle and groove occlusion. Every periodic
term uses whole cycles across its tile and every blur runs in the Fourier domain,
so each tile is seamless in both axes.

Usage (from the repository root):
  .tools/venv/bin/python -I scripts/render_foil.py [--only name,name,...]
Requires numpy and Pillow, and cwebp (libwebp) for the encode. Writes
design/prototype/assets/foil/*.webp with a <file>.json provenance sidecar each, and
keeps the PNG masters in .tools/foil-png/ (gitignored).
"""
import json
import pathlib
import shutil
import subprocess
import sys
from datetime import datetime, timezone

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "design/prototype/assets/foil"
PNG = ROOT / ".tools/foil-png"
SCRIPT = "scripts/render_foil.py"
SEED = 2611

# Aluminium pulled very slightly toward the forest field (tokens --color-foil-*).
TINT = np.array([0.962, 0.978, 0.970])

# Sizes are device pixels at 2x. CSS shows each at half size.
PLATE = dict(w=2880, h=720, mean=0.855,
             rolls=[(1, 0, 26.0), (2, 0, 17.0), (3, 1, 9.0), (5, 0, 6.0), (7, 1, 3.0)],
             crumple=(3.0, 90.0), streak=(0.08, 0.04), quality=80)
FILL = dict(w=2880, h=1080, mean=0.85,
            rolls=[(1, 0, 34.0), (2, 1, 20.0), (3, 0, 12.0), (5, 1, 5.0)],
            crumple=(4.2, 120.0), streak=(0.09, 0.04), quality=76)
KNURL = dict(a=14, b=12, cells=20, amp=2.3, soft=0.5, jitter=0.16, tilt=0.14, base=0.855, gain=0.82)
# The print field: lidding foil is smooth where it is printed, so under names, salts and
# stamps the same knurl runs at under half the emboss (same period and phase as KNURL).
KNURL_PRINT = dict(KNURL, gain=0.32)
KNURL_FILL = dict(a=21, b=18, cells=12, amp=3.2, soft=0.75, jitter=0.16, tilt=0.14, base=0.85, gain=1.05)
# Pocket aspects in CSS px (rendered at 2x): dome footprint w x h, corner radius, wall, outer
# margin. The domes are 9-sliced, so these are the design sizes: the stacked pockets' dome is
# 1.1 x its height wide (site.css); the feature and phone catalogue pockets have portrait side columns.
DOMES = {
    "hero": dict(w=207, h=188, r=16, wall=10, m=12),
    "hero-m": dict(w=185, h=168, r=16, wall=10, m=12),
    "feature": dict(w=120, h=220, r=18, wall=11, m=14),
    "cat": dict(w=118, h=216, r=16, wall=10, m=12),  # sideways catalogue pocket on a phone (primary device)
}
# Over the pack (inside the rim band) the dome may veil the pack by at most this much alpha.
DOME_VEIL_MAX = 0.15
FLOOR = dict(w=488, h=344)
GLINT = dict(w=384, h=576, lean=22.0)


# ── numeric helpers ──────────────────────────────────────────────────────
def pnoise(h, w, sigma, rng, sx=1.0):
    """Unit-variance periodic noise. sx > 1 shortens it across x, so it streaks along x."""
    n = rng.standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.rfftfreq(w)[None, :]
    g = np.exp(-2.0 * (np.pi * sigma) ** 2 * ((fx * sx) ** 2 + fy ** 2))
    n = np.fft.irfft2(np.fft.rfft2(n) * g, s=n.shape)
    return n / (n.std() + 1e-9)


def pblur(a, sigma):
    """Periodic Gaussian blur in the Fourier domain."""
    h, w = a.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.rfftfreq(w)[None, :]
    g = np.exp(-2.0 * (np.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
    return np.fft.irfft2(np.fft.rfft2(a) * g, s=a.shape)


def hash2(xi, yi):
    v = np.sin(xi * 12.9898 + yi * 78.233) * 43758.5453
    return v - np.floor(v)


def normalize(v):
    return v / np.linalg.norm(v)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


KEY = normalize(np.array([-0.52, -0.70, 0.49]))   # soft box, upper left (image y points down)
BOUNCE = normalize(np.array([0.62, 0.55, 0.56]))  # dim fill, lower right
SUN = normalize(np.array([-0.40, -0.58, 0.71]))   # light for the sparkle and lacquer
HALF = normalize(SUN + np.array([0.0, 0.0, 1.0]))


def env(rx, ry, rz):
    """Studio seen by reflection: bright ceiling, soft key box, dim fill, darker floor."""
    sky = 0.66 + 0.17 * np.clip(-ry, -1, 1) + 0.05 * np.clip(-rx, -1, 1) + 0.04 * rz
    key = 0.42 * np.exp((rx * KEY[0] + ry * KEY[1] + rz * KEY[2] - 1.0) / 0.10)
    fil = 0.12 * np.exp((rx * BOUNCE[0] + ry * BOUNCE[1] + rz * BOUNCE[2] - 1.0) / 0.18)
    return sky + key + fil


def normals(Z, periodic=True):
    if periodic:
        dzdx = (np.roll(Z, -1, 1) - np.roll(Z, 1, 1)) * 0.5
        dzdy = (np.roll(Z, -1, 0) - np.roll(Z, 1, 0)) * 0.5
    else:
        dzdx, dzdy = np.gradient(Z, axis=1), np.gradient(Z, axis=0)
    inv = 1.0 / np.sqrt(dzdx * dzdx + dzdy * dzdy + 1.0)
    return -dzdx * inv, -dzdy * inv, inv


def shade(Z, occ=None, periodic=True):
    """Light a heightfield like lacquered aluminium. Returns 0..1-ish luminance."""
    nx, ny, nz = normals(Z, periodic)
    c = env(2 * nz * nx, 2 * nz * ny, 2 * nz * nz - 1)  # reflect the view ray (0,0,1)
    spec = np.clip(nx * HALF[0] + ny * HALF[1] + nz * HALF[2], 0, 1) ** 90
    lac = np.clip(nx * SUN[0] + ny * SUN[1] + nz * SUN[2], 0, 1)
    c = c * 0.9 + 0.08 * lac + 0.32 * spec
    return c * occ if occ is not None else c


def tint(L):
    return np.clip(L[..., None] * TINT[None, None, :] / TINT.mean(), 0, 1)


# ── foil body: rolling undulation and crumple, no emboss ─────────────────
def body(p, rng):
    w, h = p["w"], p["h"]
    y, x = np.mgrid[0:h, 0:w].astype(np.float64)
    Z = np.zeros((h, w))
    for kx, ky, amp in p["rolls"]:
        Z += amp * np.cos(2 * np.pi * (kx * x / w + ky * y / h) + rng.uniform(0, 2 * np.pi))
    Z += p["crumple"][0] * pnoise(h, w, p["crumple"][1], rng)
    Z += p["streak"][0] * pnoise(h, w, 3.0, rng, sx=1 / p["streak"][1])  # faint rolling marks along x
    L = shade(Z)
    return tint(L - L.mean() + p["mean"])


# ── knurl: exact-period diamond emboss written as a light/shadow overlay ─
def knurl(k):
    a, b, n = k["a"], k["b"], k["cells"]
    w, h = a * n, b * n
    y, x = np.mgrid[0:h, 0:w].astype(np.float64) + 0.5
    u, v = x / a + y / b, x / a - y / b
    fu, fv = np.mod(u, 1.0), np.mod(v, 1.0)
    tu, tv = 1 - 2 * np.abs(fu - 0.5), 1 - 2 * np.abs(fv - 0.5)  # 0 in the grooves, 1 between
    pyr = np.minimum(tu, tv)
    pil = (0.5 - 0.5 * np.cos(2 * np.pi * u)) * (0.5 - 0.5 * np.cos(2 * np.pi * v))
    hgt = 0.62 * pyr + 0.38 * pil
    # per-diamond amplitude and tilt, hashed on the wrapped cell centre (tile stays seamless)
    uc, vc = np.floor(u) + 0.5, np.floor(v) + 0.5
    xc = np.mod(np.round(a * (uc + vc) / 2 * 2).astype(np.int64), 2 * w)
    yc = np.mod(np.round(b * (uc - vc) / 2 * 2).astype(np.int64), 2 * h)
    h1, h2, h3 = hash2(xc, yc), hash2(yc + 17.0, xc + 3.0), hash2(xc + 41.0, yc + 29.0)
    amp = 1 - k["jitter"] + k["jitter"] * h1
    dx, dy = (fu + fv - 1) * a / 2, (fu - fv) * b / 2
    hgt = hgt * amp * (1 + (h2 - 0.5) * 2 * k["tilt"] * dx / a * 2 + (h3 - 0.5) * 2 * k["tilt"] * dy / b * 2)
    hgt = pblur(hgt, k["soft"])
    occ = 0.80 + 0.20 * pblur(pyr, k["soft"] * 2.2)
    L = shade(hgt * k["amp"], occ)
    flat = shade(np.zeros((4, 4)))[0, 0]
    d = L - flat
    d = np.where(d > 0, np.tanh(d * 3.2) / 3.2, d * 1.35) * k["gain"]  # soft-clip the lit facet, deepen the shadow facet
    d -= d.mean()  # luminance-neutral on average: the plate body sets the tone
    B = k["base"]
    up = np.clip(d / (1 - B), 0, 1)       # white over B adds a(1-B)
    dn = np.clip(-d / B, 0, 1)            # black over B removes aB
    img = np.zeros((h, w, 4))
    img[..., :3] = np.where(d[..., None] > 0, 1.0, 0.0)
    img[..., 3] = np.maximum(up, dn)
    return img


def half(img):
    """Exact 2x2 area average in premultiplied space: the 1x twin of a 2x tile, still seamless."""
    h, w = img.shape[0] // 2 * 2, img.shape[1] // 2 * 2
    a = img[:h, :w, 3:4]
    pm = np.concatenate([img[:h, :w, :3] * a, a], -1)
    pm = pm.reshape(h // 2, 2, w // 2, 2, 4).mean(axis=(1, 3))
    out = pm.copy()
    out[..., :3] = pm[..., :3] / np.maximum(pm[..., 3:4], 1e-6)
    return out


def floor(f, rng):
    """Pressed-foil floor inside a pocket: smooth, a little brighter, darker toward the walls."""
    w, h = f["w"], f["h"]
    y, x = np.mgrid[0:h, 0:w].astype(np.float64)
    xn, yn = (x + 0.5) / w * 2 - 1, (y + 0.5) / h * 2 - 1
    Z = 30 * (1 - xn ** 2) * (1 - yn ** 2) + 0.9 * pnoise(h, w, 22.0, rng)  # shallow pillow, soft dents
    L = shade(Z, periodic=False)
    edge = np.minimum(np.minimum(x + 0.5, w - x - 0.5) / w, np.minimum(y + 0.5, h - y - 0.5) / h)
    L *= 0.84 + 0.16 * smoothstep(0.0, 0.18, edge)
    return tint(L - L.mean() + 0.885)


def sdf_rrect(x, y, cx, cy, hw, hh, r):
    qx = np.abs(x - cx) - (hw - r)
    qy = np.abs(y - cy) - (hh - r)
    out = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r
    return -out  # positive inside


def over(dst, rgb, a):
    """Straight-alpha 'over' of a layer (rgb 3-vector or HxWx3, alpha HxW) onto dst (HxWx4)."""
    rgb = np.broadcast_to(np.asarray(rgb, dtype=np.float64), dst[..., :3].shape)
    a = np.clip(a, 0, 1)[..., None]
    da = dst[..., 3:4]
    oa = a + da * (1 - a)
    dst[..., :3] = (rgb * a + dst[..., :3] * da * (1 - a)) / np.maximum(oa, 1e-6)
    dst[..., 3:4] = oa


def dome(d, s=2):
    W, H = (d["w"] + 2 * d["m"]) * s, (d["h"] + 2 * d["m"]) * s
    r, ww, m = d["r"] * s, d["wall"] * s, d["m"] * s
    y, x = np.mgrid[0:H, 0:W].astype(np.float64) + 0.5
    cx, cy, hw, hh = W / 2, H / 2, W / 2 - m, H / 2 - m
    sd = sdf_rrect(x, y, cx, cy, hw, hh, r)
    xn, yn = (x - cx) / hw, (y - cy) / hh
    lit = np.clip(-(xn * 0.55 + yn * 0.85) * 0.5 + 0.5, 0, 1)  # 1 toward the upper-left light
    img = np.zeros((H, W, 4))
    ink = np.array([0.06, 0.11, 0.08])

    # 1. contact shadow on the foil, offset down, only outside the footprint
    sd_sh = sdf_rrect(x - 1.6 * s, y - 3.4 * s, cx, cy, hw + 0.6 * s, hh + 0.6 * s, r)
    outside = smoothstep(0.6 * s, -0.8 * s, sd)
    over(img, ink, (0.12 + 0.36 * np.exp(np.minimum(sd_sh, 0) / (3.2 * s))) * outside * smoothstep(-10 * s, -1 * s, sd_sh))
    # 2. heat-seal band: foil pressed flat and bright around the pocket, hides the knurl
    seal = smoothstep(-7.5 * s, -5.0 * s, sd) * smoothstep(-0.2 * s, -1.6 * s, sd)
    over(img, [0.955, 0.972, 0.964], seal * (0.62 + 0.25 * lit))
    # 3. crease where the dome meets the seal
    crease = smoothstep(-1.5 * s, -0.4 * s, sd) * smoothstep(0.8 * s, -0.1 * s, sd)
    over(img, ink, 0.42 * crease)

    # dome heightfield: rounded shoulder over the wall, shallow pillow over the top
    t = np.clip(sd / ww, 0, 1)
    D = 16 * s * np.sqrt(np.clip(1 - (1 - t) ** 2, 0, 1)) + 5 * s * (1 - np.clip(xn, -1, 1) ** 2) * (1 - np.clip(yn, -1, 1) ** 2)
    nx, ny, nz = normals(D, periodic=False)
    inside = smoothstep(-0.3 * s, 0.5 * s, sd)
    wall = inside * (1 - smoothstep(ww * 0.75, ww * 1.1, sd))
    face_away = np.clip(nx * 0.55 + ny * 0.85, 0, 1)

    # 4. the wall refracts the foil behind it: darker on the side turned from the light
    #    (kept light, so at 1x the rim reads as clear plastic, not a bevelled frame)
    over(img, [0.28, 0.34, 0.31], wall * (0.08 + 0.26 * face_away))
    # 5. Fresnel reflection of the studio on clear PVC: strong on the walls, faint on top
    refl = np.clip(env(2 * nz * nx, 2 * nz * ny, 2 * nz * nz - 1) * 1.06, 0, 1)
    fres = 0.015 + 0.85 * (1 - nz) ** 1.15
    over(img, np.stack([refl] * 3, -1) * np.array([0.985, 1.0, 0.992]), inside * fres * (0.35 + 0.85 * lit))
    # 6. rim light: the bright lip at the foot of the wall, hottest toward the light
    lip = smoothstep(0.0, 0.8 * s, sd) * smoothstep(3.0 * s, 1.2 * s, sd)
    over(img, [1, 1, 1], lip * (0.38 + 0.55 * lit))
    spec = np.clip(nx * HALF[0] + ny * HALF[1] + nz * HALF[2], 0, 1) ** 22
    over(img, [1, 1, 1], wall * spec * 0.9)
    # 7. inner edge of the wall: a dark refraction line, then a fine bright shoulder
    edge_d = smoothstep(ww * 0.72, ww * 0.86, sd) * smoothstep(ww * 1.02, ww * 0.88, sd)
    over(img, [0.22, 0.27, 0.25], edge_d * (0.08 + 0.16 * (1 - lit)))
    edge_b = smoothstep(ww * 0.92, ww * 1.02, sd) * smoothstep(ww * 1.25, ww * 1.05, sd)
    over(img, [1, 1, 1], edge_b * (0.10 + 0.40 * lit))
    # 8. internal highlight, confined to the rim band (the inner shoulder of the dome): a window
    #    reflection along the upper-left shoulder, a faint bounce lower right. Over the pack the
    #    plastic stays clear: a veil of at most DOME_VEIL_MAX, so the pack reads saturated.
    #    Measured in px from the footprint edge, so the band is the same on every pocket size.
    band = smoothstep(ww * 1.0, ww * 1.3, sd) * (1 - smoothstep(ww * 1.9, ww * 2.7, sd))
    over_pack = smoothstep(ww * 1.9, ww * 2.7, sd)
    ux, uy = (x - (cx - hw)) / (2 * hw), (y - (cy - hh)) / (2 * hh)  # 0..1 across the footprint
    window = np.exp(-(((ux - 0.30) / 0.30) ** 2 + ((uy - 0.10) / 0.42) ** 2))
    sweep = np.clip(1 - (ux + uy) / 0.9, 0, 1) ** 1.5
    over(img, [1, 1, 1], band * np.clip(0.42 * window + 0.18 * sweep, 0, 0.55))
    over(img, [1, 1, 1], over_pack * (0.06 * window + 0.03 * sweep))
    bounce = np.exp(-(((ux - 0.80) / 0.16) ** 2 + ((uy - 0.86) / 0.10) ** 2))
    over(img, [1, 1, 1], (band * 0.22 + over_pack * 0.04) * bounce)
    veil = img[..., 3][over_pack > 0.99]
    if veil.size and veil.max() > DOME_VEIL_MAX:
        sys.exit(f"dome veil over the pack {veil.max():.3f} > {DOME_VEIL_MAX}")
    return img


def glint(g):
    """A soft anisotropic specular band: a hot core inside a broad halo, leaning, tapering at the ends."""
    w, h = g["w"], g["h"]
    y, x = np.mgrid[0:h, 0:w].astype(np.float64) + 0.5
    xn, yn = x / w * 2 - 1, y / h * 2 - 1
    across = xn - np.tan(np.deg2rad(g["lean"])) * yn
    halo = np.exp(-(across / 0.42) ** 2)
    core = np.exp(-(across / 0.10) ** 2)
    taper = np.clip(1 - np.abs(yn) ** 4, 0, 1)
    img = np.zeros((h, w, 4))
    img[..., :3] = 1.0
    img[..., 3] = np.clip((0.36 * halo + 0.42 * core) * taper, 0, 1)
    return img


# ── output ───────────────────────────────────────────────────────────────
ONLY = None  # --only a,b,c: write just these rasters (every other one is still computed, so the rng stream is unchanged)


def save(name, arr, enc, params, note):
    if ONLY is not None and name not in ONLY:
        return 0.0
    OUT.mkdir(parents=True, exist_ok=True)
    PNG.mkdir(parents=True, exist_ok=True)
    png, webp = PNG / f"{name}.png", OUT / f"{name}.webp"
    alpha = arr.shape[2] == 4
    Image.fromarray(np.round(np.clip(arr, 0, 1) * 255).astype(np.uint8), "RGBA" if alpha else "RGB").save(png)
    cmd = ["cwebp", "-quiet", "-m", "6"] + enc
    subprocess.run(cmd + [str(png), "-o", str(webp)], check=True)
    h, w = arr.shape[:2]
    side = {
        # "prompt" + "createdAt" are the keys `impeccable embed-prompt` reads for provenance.
        "prompt": f"Procedural, not AI-generated: {note} Rendered by {SCRIPT} (numpy heightfield, environment-lit), seed {SEED}, {w}x{h}.",
        "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "origin": "procedural",
        "aiGenerated": False,
        "generator": SCRIPT,
        "command": ".tools/venv/bin/python -I scripts/render_foil.py" + (f" --only {','.join(sorted(ONLY))}" if ONLY else ""),
        "pixels": [w, h],
        "alpha": alpha,
        "encode": " ".join(cmd + ["<master.png>", "-o", f"{name}.webp"]),
        "seed": SEED,
        "params": params,
    }
    (OUT / f"{name}.webp.json").write_text(json.dumps(side, indent=2) + "\n")
    kb = webp.stat().st_size / 1024
    print(f"{name}.webp {w}x{h} {kb:.1f} KB")
    return kb


def main():
    global ONLY
    if not shutil.which("cwebp"):
        sys.exit("cwebp not found (brew install webp)")
    if "--only" in sys.argv:
        ONLY = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    rng = np.random.default_rng(SEED)
    lossy = lambda q: ["-q", str(q), "-sharp_yuv"]
    alpha_q = lambda q: ["-q", str(q), "-alpha_q", "100", "-exact", "-sharp_yuv"]
    total = 0
    total += save("foil-plate", body(PLATE, rng), lossy(PLATE["quality"]), {k: v for k, v in PLATE.items() if k != "quality"},
                  "Lit blister-foil body at 2x: rolling undulation, soft crumple and the specular roll highlights they catch. Tileable; shown at background-size 1440px 360px under foil-knurl.webp.")
    kn = knurl(KNURL)
    total += save("foil-knurl", kn, ["-lossless", "-z", "9", "-exact"], KNURL,
                  "Diamond knurl emboss as an exact-period light/shadow overlay (white and black with alpha) at 2x; tile shown at 140px 120px over foil-plate.webp.")
    total += save("foil-knurl-1x", half(kn), ["-lossless", "-z", "9", "-exact"], dict(KNURL, scale="1x, 2x2 area average of foil-knurl"),
                  "The knurl overlay area-averaged to 1x for 1x screens (image-set), so the emboss cannot alias into moire; tile shown at 140px 120px.")
    kp = knurl(KNURL_PRINT)
    total += save("foil-knurl-print", kp, ["-lossless", "-z", "9", "-exact"], KNURL_PRINT,
                  "Print-field knurl: the same diamond emboss, period and phase as foil-knurl.webp at 0.32 gain, for the smooth printed field under names, salts and stamps (lidding foil is smooth where it is printed); 2x, tile shown at 140px 120px over foil-plate.webp.")
    total += save("foil-knurl-print-1x", half(kp), ["-lossless", "-z", "9", "-exact"], dict(KNURL_PRINT, scale="1x, 2x2 area average of foil-knurl-print"),
                  "The print-field knurl area-averaged to 1x for 1x screens (image-set); tile shown at 140px 120px.")
    total += save("foil-fill", body(FILL, rng), lossy(FILL["quality"]), {k: v for k, v in FILL.items() if k != "quality"},
                  "The foil body seen 1.5x closer, at 2x, tileable: Act 1's full-frame fill, shown at background-size 1440px 540px under foil-knurl-fill.webp.")
    kf = knurl(KNURL_FILL)
    total += save("foil-knurl-fill", kf, ["-lossless", "-z", "9", "-exact"], KNURL_FILL,
                  "The knurl overlay at the fill's 1.5x pitch, 2x; tile shown at 126px 108px.")
    total += save("foil-knurl-fill-1x", half(kf), ["-lossless", "-z", "9", "-exact"], dict(KNURL_FILL, scale="1x, 2x2 area average of foil-knurl-fill"),
                  "The fill's knurl overlay area-averaged to 1x for 1x screens (image-set); tile shown at 126px 108px.")
    total += save("foil-glint", glint(GLINT), alpha_q(70), GLINT,
                  "Soft specular band with a hot core (white with alpha) that Act 1 slides across the foil with transform only.")
    total += save("dome-floor", floor(FLOOR, rng), lossy(78), FLOOR,
                  "Smooth pressed-foil floor inside a blister pocket, stretched to the pocket box under the pack cut-out.")
    for k, d in DOMES.items():
        total += save(f"dome-{k}", dome(d), alpha_q(82), d,
                      f"Clear PVC blister dome overlay (alpha) for the {k} pocket at 2x: contact shadow, heat-seal band, crease, light wall refraction, Fresnel reflection, rim light, and a window highlight held to the rim band so the pack under the dome is veiled by at most {DOME_VEIL_MAX:.0%}. Applied as a 9-slice border-image over the pack.")
    print(f"total {total:.1f} KB")


if __name__ == "__main__":
    main()
