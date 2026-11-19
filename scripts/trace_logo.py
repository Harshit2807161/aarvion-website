#!/usr/bin/env python3
"""Trace the owner's official Aarvion logo (a low-resolution phone screenshot) into vector assets.

    python3 scripts/trace_logo.py [--root .]      # needs numpy, Pillow, scipy, scikit-image

It traces the image; it never redraws the logo or sets type. Per colour layer: coverage of the flat
colour (the mode of the shapes' eroded interiors) -> light blur against JPEG and staircase noise ->
4x bicubic -> the 0.5 contour (the layer's mask edge) -> straight runs, snapped to exact H/V and to
shared heights (baseline, cap height) -> corners the blur rounded off rebuilt by intersecting the
neighbouring edges, thin tips rebuilt from coverage sections (blur keeps area) -> cubic Beziers
(Schneider) for the curves. Writes the SVG variants, PNG exports, app icons and the og-image.
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage import measure

H = 0.2  # contour sample spacing, source px
SRC = "assets/brand/official/source/aarvion-logo-source.jpg"
BOXES = {"mint": (100, 321, 150, 1060), "navy": (321, 445, 120, 1030)}  # rows, cols: no bar, no button
FOREST, WHITE = "#1F3D2B", "#FFFFFF"

def unit(v): return v / np.linalg.norm(v)
def nrm(u): return np.array([-u[1], u[0]])
def ang(a, b): return np.degrees(np.arccos(np.clip(unit(a) @ unit(b), -1, 1)))  # degrees

def tls(Q):  # total least squares line: centre, direction (along Q), max deviation
    c = Q.mean(0)
    u = np.linalg.svd(Q - c, full_matrices=False)[2][0]
    u = u if (Q[-1] - Q[0]) @ u > 0 else -u
    return c, u, np.abs((Q - c) @ nrm(u)).max()

def line_x(r, o):  # intersection of two lines {c, u}
    t = np.linalg.solve(np.c_[r["u"], -o["u"]], o["c"] - r["c"])
    return r["c"] + t[0] * r["u"]

def turning(P, k):  # signed turn (deg) between the chords into and out of each point
    a, b = P - np.roll(P, k, 0), np.roll(P, -k, 0) - P
    return np.degrees(np.arctan2(a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0], (a * b).sum(1)))

def smooth(D, w=21):
    if len(D) <= w:
        return D
    pad = np.vstack([np.repeat(D[:1], w // 2, 0), D, np.repeat(D[-1:], w // 2, 0)])
    return np.c_[[np.convolve(pad[:, j], np.ones(w) / w, "valid") for j in (0, 1)]].T

def contours(cov, f=4):
    up = ndi.zoom(ndi.gaussian_filter(cov, 1.0), f, order=3, grid_mode=True, mode="grid-constant")
    for p in measure.find_contours(up, 0.5):
        xy = (np.c_[p[:, 1], p[:, 0]] + 0.5) / f  # pixel (i, j) covers [j, j+1] x [i, i+1]
        xy = np.vstack([xy[:-1], xy[:1]])
        d = np.r_[0, np.cumsum(np.hypot(*np.diff(xy, axis=0).T))]
        s = np.linspace(0, d[-1], int(round(d[-1] / H)), endpoint=False)
        P = np.c_[np.interp(s, d, xy[:, 0]), np.interp(s, d, xy[:, 1])]
        yield np.roll(P, -int(np.argmax(np.abs(turning(P, 12)))), 0)  # start on a corner

def trim(P, a, b):  # shrink a run until every point is within 0.2px of its line
    for _ in range(4):
        c, u, _ = tls(P[a:b + 1])
        ok = np.nonzero(np.abs((P[a:b + 1] - c) @ nrm(u)) < 0.2)[0]
        a, b = a + ok[0], a + ok[-1]
    return a, b

def find_runs(P, axis_only, tol=0.3):
    """Straight runs, grown point by point from the straightest 4px seeds, then rejoined."""
    n, w, taken, runs = len(P), int(2 / H), np.zeros(len(P), bool), []
    for dev, i in sorted((tls(P[i - w:i + w + 1])[2], i) for i in range(w, len(P) - w, 3)):
        if dev > 0.15 or taken[i - w:i + w + 1].any():
            continue
        a, b, live = i - w, i + w, [True, True]
        c, u, _ = tls(P[a:b + 1])
        while any(live):
            for side in (0, 1):
                j = (a - 1, b + 1)[side]
                if not live[side] or not 0 <= j < n or taken[j] or abs((P[j] - c) @ nrm(u)) > tol:
                    live[side] = False
                    continue
                a, b = (j, b) if side == 0 else (a, j)
                if (b - a) % 25 == 0:
                    c, u, _ = tls(P[a:b + 1])
        a, b = trim(P, a, b)
        taken[a:b + 1] = True
        runs.append([a, b])
    merged = []
    for a, b in sorted(r for r in runs if (r[1] - r[0]) * H >= 4):  # one edge split by a noisy stretch
        if merged:
            (c1, u1, _), (c2, u2, _) = tls(P[merged[-1][0]:merged[-1][1] + 1]), tls(P[a:b + 1])
            near = np.abs((P[a:b + 1] - c1) @ nrm(u1)).max() < 0.45
            if a - merged[-1][1] <= 40 and (near or ang(u1, u2) < 3 and abs((c2 - c1) @ nrm(u1)) < 0.5):
                merged[-1] = list(trim(P, merged[-1][0], b))
                continue
        merged.append([a, b])
    out = []
    for a, b in merged:
        c, u, _ = tls(P[a:b + 1])
        tilt = np.degrees(np.arctan2(abs(u[1]), abs(u[0])))
        axis = "H" if tilt < 1 else "V" if tilt > 89 else None
        if (b - a) * H >= (40 if axis_only else 5 if axis else 8) and (axis or not axis_only):
            out.append(dict(a=a, b=b, c=c, u=u, axis=axis))
    return out

def tips_in(P, i0, i1, phi):  # pointed tips (> 75 deg turn within 2.4px) inside indices i0..i1
    n = len(P)
    return [i for i in range(i0 + 10, i1 - 10)
            if abs(phi[i % n]) > 75 and abs(phi[i % n]) >= np.abs(phi[np.arange(i - 15, i + 16) % n]).max()]

def lines_meet(P, r, o, phi):  # runs r then o meet at a corner with only blur between them
    gap = np.arange(r["b"], r["b"] + (o["a"] - r["b"]) % len(P) + 1) % len(P)
    if len(gap) * H > 15 or ang(r["u"], o["u"]) < 30 or tips_in(P, r["b"], r["b"] + len(gap) - 1, phi):
        return False
    d = lambda q: np.abs((P[gap] - q["c"]) @ nrm(q["u"]))
    return bool(np.minimum(d(r), d(o)).max() < 1.5)

def run_end(P, r, i, end, phi):
    """Run r meets a curve at its end (+1) or start (-1): (corner?, point, curve tangent, data index).
    The curve's direction is fitted where the contour is 3.5px off the line, past the blur. Blur rounds
    a sharp corner by 2-6px; a drawn fillet is rounder and keeps bending. On a long run a shallow
    corner is one whose far edge runs on straight."""
    n, ks = len(P), np.arange(int(30 / H))
    dev = np.abs((P[(i + end * ks) % n] - r["c"]) @ nrm(r["u"]))
    fit = lambda s, L=6: dict(zip("cud", tls(P[(i + end * np.arange(int(s / H), int((s + L) / H))) % n])))
    s1, s3 = H * np.argmax(dev > 1), H * np.argmax(dev > 3.5)
    seg = fit(s3)
    seg["u"] = seg["u"] * end
    X, th = line_x(r, seg), ang(r["u"], seg["u"])
    r_eq = np.linalg.norm(P[(i + end * ks) % n] - X, axis=1).min() / max(1 / np.cos(np.radians(th) / 2) - 1, 1e-9)
    d1, d2, far = fit(s1, 4)["u"] * end, fit(s1 + 6, 4)["u"] * end, fit(s1, 12)
    if (any(abs(phi[(i + end * j) % n]) > 75 for j in range(int(20 / H))) or (th >= 25 and r_eq < 7)
            or (ang(r["u"], d1) >= 40 and ang(d1, d2) < 20)
            or ((r["b"] - r["a"]) * H >= 30 and far["d"] < 0.35 and 12 <= ang(r["u"], far["u"] * end) < 90)):
        if np.linalg.norm(X - P[i]) < 25:
            return True, X, seg["u"], (i + end * int(s3 / H)) % n
    k = int(min(3, 0.3 * (r["b"] - r["a"]) * H) / H)  # smooth: the curve takes over the last 3px
    p = P[(i - end * k) % n]
    return False, r["c"] + ((p - r["c"]) @ r["u"]) * r["u"], r["u"], (i - end * k) % n

def prune(P, runs):
    """Keep slanted runs with a corner at both ends and H/V runs with one (the rest are flats of curves)."""
    phi = turning(P, 12)
    while runs:
        def corner(k, e):
            o = runs[(k + e) % len(runs)]
            if len(runs) > 1 and lines_meet(P, *((runs[k], o) if e > 0 else (o, runs[k])), phi):
                return True
            return run_end(P, runs[k], runs[k]["b" if e > 0 else "a"], e, phi)[0]
        keep = [(all if r["axis"] is None else any)(corner(k, e) for e in (-1, 1)) for k, r in enumerate(runs)]
        if all(keep):
            break
        runs = [r for r, ok in zip(runs, keep) if ok]
    return runs

def tip(P, t, cov):
    """A pointed tip at index t, rebuilt from coverage sections across the sliver: blur keeps area, so
    a section's coverage sum is the true width and its centroid the true centre (the 0.5 contour makes
    a thin tip too thin and too short). The tip is where a quadratic taper of the width reaches 0."""
    n, T0 = len(P), P[t]
    ax = unit(unit(P[(t - 50) % n] - T0) + unit(P[(t + 50) % n] - T0))  # into the body
    ss, ts = np.arange(-16, 40, 0.5), np.arange(-9, 9.01, 0.25)
    pts = T0 + ss[:, None, None] * ax + ts[None, :, None] * nrm(ax)
    v = ndi.map_coordinates(cov, [pts[..., 1] - 0.5, pts[..., 0] - 0.5], order=1)
    w = v.sum(1) * 0.25
    c = (v * ts).sum(1) * 0.25 / np.maximum(w, 1e-6)
    big = np.nonzero((w > 8) & (ss > 0))[0]
    upto = np.arange(len(ss)) < (big[0] if len(big) else len(ss))  # the contour is untrustworthy here
    near = (w > 1) & (w < 4) & upto
    pw, pc = np.polyfit(ss[near], w[near], 2), np.polyfit(ss[near], c[near], 1)
    roots = np.roots(pw).real
    s0 = roots[np.argmin(np.abs(roots - ss[near][0]))]
    keep = (ss > s0 + 0.5) & (w > 1) & upto
    sec, (ws, cs) = ss[keep], smooth(np.c_[w, c], 5)[keep].T
    edge = lambda sg: T0 + sec[:, None] * ax + (cs + sg * ws / 2)[:, None] * nrm(ax)
    sg = np.sign((P[(t - 50) % n] - T0) @ nrm(ax))
    k1 = next(k for k in range(1, n) if (P[(t - k) % n] - T0) @ ax > sec[-1] + 1)
    k2 = next(k for k in range(1, n) if (P[(t + k) % n] - T0) @ ax > sec[-1] + 1)
    dw = np.polyval(np.polyder(pw), s0)
    d = lambda g: unit(ax + (pc[0] + g * dw / 2) * nrm(ax))
    return dict(X=T0 + s0 * ax + np.polyval(pc, s0) * nrm(ax), tin=-d(sg), tout=d(-sg), iin=(t - k1) % n,
                iout=(t + k2) % n, line=False, pre=edge(sg)[::-1], post=edge(-sg))

def bez(c, t):
    t = t[:, None]
    return (1 - t) ** 3 * c[0] + 3 * (1 - t) ** 2 * t * c[1] + 3 * (1 - t) * t ** 2 * c[2] + t ** 3 * c[3]

def fit_bez(D, t0, t1, tol=0.3):
    """Schneider's cubic fit through D's end points with fixed end tangents (traversal direction)."""
    s = np.r_[0, np.cumsum(np.hypot(*np.diff(D, axis=0).T))]
    u, L = s / s[-1], np.linalg.norm(D[-1] - D[0])
    for _ in range(40):
        A1, A2 = (3 * (1 - u) ** 2 * u)[:, None] * t0, (3 * (1 - u) * u ** 2)[:, None] * -t1
        R = D - bez(np.array([D[0], D[0], D[-1], D[-1]]), u)
        C = [[(A1 * A1).sum(), (A1 * A2).sum()], [(A1 * A2).sum(), (A2 * A2).sum()]]
        a1, a2 = np.linalg.lstsq(np.array(C), [(R * A1).sum(), (R * A2).sum()], rcond=None)[0]
        if not (1e-3 * L < a1 < 2 * L and 1e-3 * L < a2 < 2 * L):
            a1 = a2 = L / 3
        c = np.array([D[0], D[0] + a1 * t0, D[-1] - a2 * t1, D[-1]])
        r = bez(c, u) - D
        if np.hypot(*r.T).max() < tol:
            return [c]
        d1 = 3 * (((1 - u) ** 2)[:, None] * (c[1] - c[0]) + (2 * (1 - u) * u)[:, None] * (c[2] - c[1]) + (u ** 2)[:, None] * (c[3] - c[2]))
        d2 = 6 * ((1 - u)[:, None] * (c[2] - 2 * c[1] + c[0]) + u[:, None] * (c[3] - 2 * c[2] + c[1]))
        den = (d1 * d1).sum(1) + (r * d2).sum(1)
        u = np.maximum.accumulate(np.clip(u - (r * d1).sum(1) / np.where(np.abs(den) > 1e-9, den, 1e-9), 0, 1))
        u[0], u[-1] = 0, 1
    if len(D) < 30:
        return [c]
    i = int(np.clip(np.hypot(*r.T).argmax(), 15, len(D) - 16))
    tc = unit(D[i + 10] - D[i - 10])
    return fit_bez(D[:i + 1], t0, tc, tol) + fit_bez(D[i:], tc, t1, tol)

def trace_contour(P, runs, cov):
    """One closed path: ('L', p0, p1) and ('C', p0, c1, c2, p3) segments between rebuilt vertices."""
    n, phi, m, B = len(P), turning(P, 12), len(runs), []
    brk = lambda X, tin, tout, iin, iout, line: dict(X=X, tin=tin, tout=tout, iin=iin, iout=iout, line=line,
                                                     pre=np.zeros((0, 2)), post=np.zeros((0, 2)))
    if not runs:
        B = [tip(P, t % n, cov) for t in tips_in(P, -10, n + 10, phi)]
        if not B:  # a smooth closed curve (the O): break at its extremes, tangents exactly on axis
            S = smooth(np.vstack([P[-20:], P, P[:20]]), 25)[20:-20]
            ext = [S[:, 0].argmin(), S[:, 0].argmax(), S[:, 1].argmin(), S[:, 1].argmax()]
            for i in sorted(set(ext)):
                d = S[(i + 5) % n] - S[i - 5]
                t = np.array([0.0, np.sign(d[1])]) if i in ext[:2] else np.array([np.sign(d[0]), 0.0])
                B.append(brk(S[i], t, t, i, i, False))
    for k, r in enumerate(runs):
        o = runs[(k + 1) % m]
        if k == 0:  # the vertex that starts run 0; later runs get theirs from the gap before them
            if m > 1 and lines_meet(P, runs[-1], r, phi):
                B.append(brk(line_x(runs[-1], r), None, None, r["a"], r["a"], True))
            else:
                _, X, tin, i_in = run_end(P, r, r["a"], -1, phi)
                B.append(brk(X, tin, r["u"], i_in, r["a"], True))
        if m > 1 and lines_meet(P, r, o, phi):
            if k < m - 1:
                B.append(brk(line_x(r, o), None, None, o["a"], o["a"], True))
            continue
        _, X, tout, i_out = run_end(P, r, r["b"], 1, phi)
        B.append(brk(X, r["u"], tout, r["b"], i_out, False))
        B += [tip(P, t % n, cov) for t in tips_in(P, r["b"] + 100, o["a"] + (n if k == m - 1 else 0) - 100, phi)]
        if k < m - 1:
            _, X, tin, i_in = run_end(P, o, o["a"], -1, phi)
            B.append(brk(X, tin, o["u"], i_in, o["a"], True))
    segs = []
    for j, b in enumerate(B):
        e = B[(j + 1) % len(B)]
        if b["line"]:
            segs.append(("L", b["X"], e["X"]))
            continue
        data = smooth(P[np.arange(b["iout"], b["iout"] + (e["iin"] - b["iout"]) % n) % n])
        D = np.vstack([b["X"], b["post"], data, e["pre"], e["X"]])
        segs += [("C", *c) for c in fit_bez(D, unit(b["tout"]), unit(e["tin"]))]
    return segs

def trace_layer(cov, axis_only):
    items = []
    for P in contours(cov):
        runs = prune(P, find_runs(P, axis_only))
        for r in runs:  # snap: exact H/V through the run's points
            r["u"] = {"H": np.array([np.sign(r["u"][0]), 0.0]), "V": np.array([0.0, np.sign(r["u"][1])])}.get(r["axis"], r["u"])
            r["c"] = P[r["a"]:r["b"] + 1].mean(0)
        items.append((P, runs))
    groups = []  # one exact height per cluster of horizontals: baseline, cap height, counter floors
    for y, L, r in sorted(((r["c"][1], r["b"] - r["a"], r) for _, rs in items for r in rs if r["axis"] == "H"),
                          key=lambda g: g[0]):
        (groups[-1].append((y, L, r)) if groups and y - groups[-1][-1][0] < 0.6 else groups.append([(y, L, r)]))
    for g in groups:
        y = sum(v * L for v, L, _ in g) / sum(L for _, L, _ in g)
        for *_, r in g:
            r["c"] = np.array([r["c"][0], y])
    return [trace_contour(P, runs, cov) for P, runs in items]

def flatten(segs):
    pts = [segs[0][1]]
    for s in segs:
        pts.extend([s[2]] if s[0] == "L" else bez(np.array(s[1:]), np.linspace(0, 1, 33)[1:]))
    return np.array(pts)

def raster(layers, scale, shift, size, ss=4):
    """RGBA image of [(paths, hex)] layers (even-odd fill), supersampled ss x ss."""
    W, Hh = size
    out = np.zeros((Hh, W, 4))
    for paths, hexc in layers:
        acc = np.zeros((Hh * ss, W * ss), bool)
        for segs in paths:
            m = Image.new("1", (W * ss, Hh * ss), 0)
            ImageDraw.Draw(m).polygon([tuple(p) for p in (flatten(segs) * scale + shift) * ss], fill=1)
            acc ^= np.asarray(m)
        a = acc.reshape(Hh, ss, W, ss).mean((1, 3))[..., None]
        rgb = [int(hexc[i:i + 2], 16) for i in (1, 3, 5)]
        out = np.concatenate([out[..., :3] * (1 - a) + np.multiply(rgb, a), out[..., 3:] * (1 - a) + a], -1)
    out[..., :3] /= np.maximum(out[..., 3:], 1e-9)
    return Image.fromarray(np.round(out * [1, 1, 1, 255]).clip(0, 255).astype(np.uint8), "RGBA")

def bounds(layers):
    P = np.vstack([flatten(s) for paths, _ in layers for s in paths])
    return P.min(0), P.max(0)

def fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s

def path_d(paths, off):  # snapped edges are written as H/V, so they stay exact
    out = []
    for segs in paths:
        out.append("M" + " ".join(map(fmt, segs[0][1] - off)))
        for s in segs:
            p, q = s[1] - off, s[-1] - off
            if s[0] == "C":
                out.append("C" + " ".join(fmt(v) for pt in s[2:] for v in pt - off))
            elif abs(p[1] - q[1]) < 1e-3 or abs(p[0] - q[0]) < 1e-3:
                out.append(f"H{fmt(q[0])}" if abs(p[1] - q[1]) < 1e-3 else f"V{fmt(q[1])}")
            else:
                out.append("L" + " ".join(map(fmt, q)))
        out.append("Z")
    return "".join(out)

def svg(layers, crop=None, title=True):
    lo, hi = crop or bounds(layers)
    w, h = (fmt(v) for v in hi - lo)
    body = "".join(f'<path fill="{c}" fill-rule="evenodd" d="{path_d(p, lo)}"/>' for p, c in layers)
    head = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"'
    return head + (' role="img"><title>Aarvion</title>' if title else ">") + body + "</svg>\n"

def placed(layers, size, box, ground=None, crop=None):
    """Layers fitted inside box (w, h), centred on a canvas of size, optionally on a solid ground."""
    lo, hi = crop or bounds(layers)
    k = min(box[0] / (hi - lo)[0], box[1] / (hi - lo)[1])
    shift = (np.array(size) - (hi - lo) * k) / 2 - lo * k
    img = raster(layers, k, shift, size, ss=8 if max(size) <= 512 else 4)
    if crop:  # clip to the crop box
        a = np.asarray(img).copy()
        a[..., :int(round(lo[0] * k + shift[0])), 3] = 0
        img = Image.fromarray(a, "RGBA")
    return Image.alpha_composite(Image.new("RGBA", size, ground), img) if ground else img

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    root = ap.parse_args().root
    rgb = np.asarray(Image.open(root / SRC).convert("RGB")).astype(float)
    cols, paths = {}, {}
    for name, (y0, y1, x0, x1) in BOXES.items():
        reg = np.zeros(rgb.shape[:2], bool)
        reg[y0:y1, x0:x1] = True
        q = rgb[ndi.binary_erosion((np.abs(255 - rgb).sum(2) > 100) & reg, iterations=4)].astype(int)
        keys, cnt = np.unique(q[:, 0] << 16 | q[:, 1] << 8 | q[:, 2], return_counts=True)
        cols[name] = "#%06X" % keys[cnt.argmax()]  # the flat colour: mode of the shapes' interiors
        v = 255 - np.array([int(cols[name][i:i + 2], 16) for i in (1, 3, 5)], float)
        cov = np.clip(((255 - rgb) @ v) / (v @ v), 0, 1) * reg
        paths[name] = trace_layer(cov, axis_only=name == "mint")
        a, b = cov > 0.5, np.asarray(raster([(paths[name], WHITE)], 1, 0, rgb.shape[1::-1], 8))[..., 3] > 127
        print(f"{name} {cols[name]}: {sum(map(len, paths[name]))} segments, IoU vs source mask {(a & b).sum() / (a | b).sum():.4f}")
    mint, navy = paths["mint"], paths["navy"]
    variants = {"aarvion-logo": [(mint, cols["mint"]), (navy, cols["navy"])],
                "aarvion-logo-reversed": [(mint, cols["mint"]), (navy, WHITE)],
                "aarvion-logo-forest": [(mint, FOREST), (navy, FOREST)],
                "aarvion-logo-white": [(mint, WHITE), (navy, WHITE)],
                "aarvion-mark": [(mint, cols["mint"])], "aarvion-mark-white": [(mint, WHITE)]}
    out, pub, app = root / "assets/brand/official", root / "public/brand", root / "src/app"
    for d in (out / "png", out / "icons", pub / "png", app):
        d.mkdir(parents=True, exist_ok=True)
    for name, layers in variants.items():
        for d in (out, pub):
            (d / f"{name}.svg").write_text(svg(layers))
    for name in ("aarvion-logo", "aarvion-logo-reversed"):
        lo, hi = bounds(variants[name])
        for w in (1024, 2048, 4096):
            size = (w, int(np.ceil(w * (hi - lo)[1] / (hi - lo)[0])))
            img = placed(variants[name], size, size)
            for d in (out, pub):
                img.save(d / f"png/{name}-{w}.png", optimize=True)
    mark = variants["aarvion-mark"]
    lo, hi = bounds(mark)
    head = (np.array([700.0, lo[1]]), hi)  # the swoosh's head: it reads at 16px, where the thin arc cannot
    ico = [placed(mark, (s, s), (s * 0.88, s * 0.88), WHITE, head) for s in (16, 32, 48)]
    ico[2].save(out / "icons/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico[:2])
    w, h = hi - head[0]
    k = 42 / w
    inner = svg(mark, head, title=False)
    (out / "icons/icon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" role="img"><title>Aarvion</title>'
        f'<rect width="48" height="48" rx="10" fill="{WHITE}"/><svg x="3" y="{fmt((48 - h * k) / 2)}" width="42" '
        f'height="{fmt(h * k)}" viewBox="0 0 {fmt(w)} {fmt(h)}">{inner[inner.index("<path"):].strip()}</svg>\n')
    placed(mark, (180, 180), (156, 156), WHITE).convert("RGB").save(out / "icons/apple-touch-icon.png")
    placed(mark, (192, 192), (168, 168), WHITE).save(out / "icons/icon-192.png")
    placed(mark, (512, 512), (392, 392), WHITE).save(out / "icons/icon-512-maskable.png")  # inside the 80% safe circle
    placed(variants["aarvion-logo"], (1200, 630), (640, 330), WHITE).convert("RGB").save(out / "icons/og-image.png")
    for src, dst in [("favicon.ico", app / "favicon.ico"), ("icon.svg", app / "icon.svg"),
                     ("apple-touch-icon.png", app / "apple-icon.png"), ("og-image.png", app / "opengraph-image.png"),
                     ("icon-192.png", pub / "icon-192.png"), ("icon-512-maskable.png", pub / "icon-512-maskable.png")]:
        dst.write_bytes((out / "icons" / src).read_bytes())

if __name__ == "__main__":
    main()
