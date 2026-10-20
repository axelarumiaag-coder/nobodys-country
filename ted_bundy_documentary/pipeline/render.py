"""Frame renderer: draws every shot of build/timeline.json and encodes with FFmpeg.

Usage: python render.py [--preview] [--frames a:b] [--still t1,t2,...]
  --preview  half resolution, fast encode (build/preview.mp4)
  --still    write PNG frames at the given times to build/stills/
"""
import math, sys, subprocess, os, random
from functools import lru_cache
from multiprocessing import Pool
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
from common import W, H, FPS, BUILD, ARCHIVAL, FONTS, BG, LIGHT, GREY, RED, RED_SOFT, load_json
import usmap
from subtitles import build_chunks

TL = load_json(BUILD / "timeline.json")
VT = load_json(BUILD / "voice_timing.json")
SHOTS = TL["shots"]
CHUNKS = build_chunks(VT)
RNG = np.random.default_rng(7)


# ------------------------------------------------------------------ helpers
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x); return 1 - (1 - x) ** 3


def ease_io(x):
    x = clamp(x); return x * x * (3 - 2 * x)


def lerp(a, b, x):
    return a + (b - a) * x


@lru_cache(None)
def font(key, size):
    return ImageFont.truetype(FONTS[key], int(size))


def text_size(txt, f, tracking=0):
    if tracking:
        return sum(f.getlength(c) for c in txt) + tracking * (len(txt) - 1), f.getbbox("Hg")[3]
    b = f.getbbox(txt)
    return b[2] - b[0], b[3] - b[1]


def draw_text(img, txt, key, size, xy, fill=LIGHT, alpha=1.0, anchor="mm", tracking=0, shadow=False):
    """Draw text on an RGB PIL image with alpha via a mask layer."""
    if alpha <= 0.003 or not txt:
        return
    f = font(key, size)
    layer = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(layer)
    if tracking:
        tw, _ = text_size(txt, f, tracking)
        x, y = xy
        if anchor[0] == "m":
            x -= tw / 2
        elif anchor[0] == "r":
            x -= tw
        for c in txt:
            d.text((x, y), c, font=f, fill=255, anchor="l" + anchor[1])
            x += f.getlength(c) + tracking
    else:
        d.text(xy, txt, font=f, fill=255, anchor=anchor)
    if shadow:
        sh = layer.filter(ImageFilter.GaussianBlur(10)).point(lambda v: int(v * 0.8 * alpha))
        img.paste((0, 0, 0), (0, 0), sh)
    if alpha < 1:
        layer = layer.point(lambda v: int(v * alpha))
    img.paste(fill, (0, 0), layer)


def kb(plate, z, cx=0.5, cy=0.5, rot=0.0):
    """Ken Burns crop of a plate (PIL) to WxH; z>=1 zoom, (cx, cy) normalized centre."""
    pw, ph = plate.size
    base = max(W / pw, H / ph)
    s = 1 / (base * z)
    cw, ch = W * s, H * s
    x0 = clamp(cx * pw - cw / 2, 0, pw - cw)
    y0 = clamp(cy * ph - ch / 2, 0, ph - ch)
    if rot:
        a = math.radians(rot); ca, sa = math.cos(a), math.sin(a)
        mx, my = x0 + cw / 2, y0 + ch / 2
        # rotate about the crop centre
        coeffs = (s * ca, -s * sa, mx - (W / 2) * s * ca + (H / 2) * s * sa,
                  s * sa, s * ca, my - (W / 2) * s * sa - (H / 2) * s * ca)
        return plate.transform((W, H), Image.AFFINE, coeffs, resample=Image.BILINEAR)
    return plate.transform((W, H), Image.AFFINE, (s, 0, x0, 0, s, y0), resample=Image.BILINEAR)


def radial(w, h, cx, cy, rx, ry, power=2.0):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)
    return np.clip(1 - r, 0, 1) ** power


def to_img(arr):
    return Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8))


def to_arr(img):
    return np.asarray(img, np.float32) / 255


@lru_cache(None)
def fog_tex(seed=1, w=1280, h=720):
    r = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    for sc, amp in ((8, 1.0), (16, 0.5), (40, 0.25)):
        small = r.random((h // sc + 2, w // sc + 2)).astype(np.float32)
        im = Image.fromarray((small * 255).astype(np.uint8)).resize((w + sc * 2, h + sc * 2), Image.BICUBIC)
        acc += amp * (np.asarray(im, np.float32)[:h, :w] / 255)
    acc = (acc - acc.min()) / (acc.max() - acc.min())
    return np.tile(acc, (1, 2))  # wide strip for scrolling


def fog(t, speed=30, seed=1, strength=0.08):
    tex = fog_tex(seed)
    off = int(t * speed) % tex.shape[1] // 2
    crop = tex[:, off:off + 1280]
    im = Image.fromarray((crop * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)
    return (np.asarray(im, np.float32) / 255)[..., None] * strength


@lru_cache(None)
def vignette():
    v = radial(W, H, W / 2, H / 2, W * 0.78, H * 0.95, 1.0)
    return (0.35 + 0.65 * np.clip(v * 1.6, 0, 1))[..., None].astype(np.float32)


@lru_cache(None)
def grain_frames():
    r = np.random.default_rng(3)
    out = []
    for _ in range(12):
        g = r.normal(0, 1, (H // 2, W // 2)).astype(np.float32)
        g = np.asarray(Image.fromarray(((g * 40) + 128).clip(0, 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), np.float32)
        out.append(((g - 128) / 40)[..., None])
    return out


def canvas(color=BG):
    return Image.new("RGB", (W, H), color)


def bg_texture(t, base=(14, 14, 15), fog_s=0.05, seed=2):
    a = np.full((H, W, 3), np.array(base, np.float32) / 255)
    a += fog(t, 18, seed, fog_s)
    return a


def red_line(img, x0, x1, y, alpha=1.0, w=4):
    if x1 - x0 < 1 or alpha <= 0:
        return
    layer = Image.new("L", img.size, 0)
    ImageDraw.Draw(layer).rectangle([x0, y - w // 2, x1, y + w // 2], fill=int(255 * alpha))
    img.paste(RED, (0, 0), layer)


# ------------------------------------------------------------------ shot renderers
@lru_cache(None)
def silhouette_plate(mood):
    """Head-and-shoulders silhouette, backlit. Purely illustrative, no likeness."""
    pw, ph = 2400, 1350
    glow_col = {"warm": (0.62, 0.48, 0.34), "cold": (0.55, 0.08, 0.09), "shadow": (0.30, 0.30, 0.33),
                "sling": (0.48, 0.44, 0.38), "fade": (0.26, 0.05, 0.06)}[mood]
    a = np.zeros((ph, pw, 3), np.float32) + np.array([0.035, 0.035, 0.04], np.float32)
    gx = pw * (0.5 if mood != "sling" else 0.56)
    g = radial(pw, ph, gx, ph * 0.42, pw * 0.42, ph * 0.75, 1.6)
    a += g[..., None] * np.array(glow_col, np.float32) * 0.9
    m = Image.new("L", (pw, ph), 0)
    d = ImageDraw.Draw(m)
    cx = gx
    hw, hh = 170, 215
    hy = ph * 0.40
    d.ellipse([cx - hw, hy - hh, cx + hw, hy + hh * 0.92], fill=255)                # head
    d.polygon([(cx - hw * 0.92, hy + 20), (cx - 70, hy + hh * 1.02), (cx + 70, hy + hh * 1.02), (cx + hw * 0.92, hy + 20)], fill=255)  # jaw
    half = catmull([(0, hy + 150), (95, hy + 200), (120, hy + 290), (300, hy + 345), (470, hy + 390),
                    (575, hy + 470), (620, hy + 600), (650, ph + 10)])
    outline = [(cx - x, y) for x, y in half[::-1]] + [(cx + x, y) for x, y in half]
    d.polygon(outline, fill=255)                                                     # neck + shoulders
    if mood == "sling":  # arm held across the chest in a pale sling
        sl = Image.new("L", (pw, ph), 0)
        ImageDraw.Draw(sl).polygon([(cx - 420, hy + 520), (cx + 300, hy + 330), (cx + 330, hy + 420), (cx - 380, hy + 640)], fill=255)
        sl = sl.filter(ImageFilter.GaussianBlur(6))
    m = m.filter(ImageFilter.GaussianBlur(5))
    rim = m.filter(ImageFilter.GaussianBlur(28))
    rim_a = np.asarray(rim, np.float32) / 255
    body = np.asarray(m, np.float32) / 255
    edge = np.clip(rim_a - body * 0.92, 0, 1)
    rim_col = np.array({"cold": (0.85, 0.2, 0.2), "fade": (0.5, 0.12, 0.12)}.get(mood, (0.95, 0.85, 0.72)), np.float32)
    a += edge[..., None] * rim_col * (0.9 if mood != "shadow" else 0.35)
    a = a * (1 - body[..., None]) + body[..., None] * np.array([0.012, 0.012, 0.014], np.float32)
    if mood == "sling":
        s_a = np.asarray(sl, np.float32)[..., None] / 255
        a = a * (1 - s_a * 0.8) + s_a * 0.8 * np.array([0.30, 0.29, 0.27], np.float32)
    return to_img(a)


def catmull(pts, n=16):
    """Catmull-Rom spline through pts (list of (x, y))."""
    P = [pts[0]] + pts + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = map(np.array, (P[i - 1], P[i], P[i + 1], P[i + 2]))
        for u in np.linspace(0, 1, n, endpoint=False):
            out.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u ** 2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)))
    out.append(pts[-1])
    return out


def r_silhouette(s, t, p, img_out):
    mood = s["params"]["mood"]
    z0, z1 = s["params"]["z"]
    plate = silhouette_plate(mood)
    im = kb(plate, lerp(z0, z1, ease_io(p)), 0.5, 0.45)
    a = to_arr(im)
    flick = 1 + 0.05 * math.sin(t * 11.0) * math.sin(t * 3.7)
    a *= flick
    a += fog(t, 40, 5, 0.06)
    if mood == "fade":
        a *= lerp(1.0, 0.35, ease_io(p))
    return a


def r_word(s, t, p, _):
    a = bg_texture(t, (12, 12, 13), 0.04)
    img = to_img(a)
    txt = s["params"]["text"]
    sc = lerp(1.08, 1.0, ease_out(t / 0.25))
    tr = lerp(30, 14, ease_out(p))
    draw_text(img, txt, "display", 300 * sc, (W / 2, H * 0.45), LIGHT, ease_out(t / 0.08), tracking=tr)
    if s["params"].get("accent"):
        f = font("display", 300 * sc)
        tw, _ = text_size(txt, f, tr)
        draw_text(img, s["params"]["accent"], "display", 300 * sc, (W / 2 + tw / 2 + 20, H * 0.45), RED, ease_out((t - 0.12) / 0.1), anchor="lm")
    w = 260 * ease_out((t - 0.05) / 0.4)
    red_line(img, W / 2 - w, W / 2 + w, int(H * 0.45 + 150), 1.0, 5)
    return to_arr(img)


def r_name(s, t, p, _):
    a = bg_texture(t, (10, 10, 11), 0.05)
    img = to_img(a)
    tr = lerp(70, 18, ease_out(p * 1.2))
    draw_text(img, "TED BUNDY", "display", 340, (W / 2, H * 0.43), LIGHT, ease_out(t / 0.15), tracking=tr)
    slash_t = at_word("frightening.") - s["start"]
    k = ease_out((t - slash_t) / 0.18)
    if k > 0:
        red_line(img, W / 2 - 470 * k, W / 2 + 470 * k, int(H * 0.43 + 135), 1.0, 8)
    draw_text(img, "THEODORE ROBERT BUNDY  ·  1946 – 1989", "mono", 34, (W / 2, H * 0.43 + 195), GREY, ease_out((t - 0.3) / 0.4), tracking=4)
    return to_arr(img)


def r_title(s, t, p, _):
    a = np.full((H, W, 3), 0.025, np.float32) + fog(t, 25, 9, 0.05)
    img = to_img(a)
    sc = lerp(1.0, 1.04, p)
    draw_text(img, s["params"]["text"], "display", 230 * sc, (W / 2, H * 0.44), LIGHT, ease_out(t / 0.12), tracking=22 * sc)
    red_line(img, W / 2 - 60, W / 2 + 60, int(H * 0.44 + 115), ease_out((t - 0.1) / 0.2), 4)
    draw_text(img, "A TRUE CRIME DOCUMENTARY", "sans_semi", 30, (W / 2, H * 0.44 + 165), GREY, ease_out((t - 0.2) / 0.3), tracking=10)
    return to_arr(img)


def r_chapter(s, t, p, _):
    P = s["params"]
    a = np.full((H, W, 3), 0.02, np.float32) + fog(t, 35, 4, 0.05)
    img = to_img(a)
    k = ease_out(t / 0.35)
    draw_text(img, f"CHAPTER {P['num']}", "mono_bold", 34, (W / 2, H * 0.36), RED_SOFT, k, tracking=10)
    draw_text(img, P["title"], "display", 150, (W / 2 + lerp(30, 0, k), H * 0.47), LIGHT, k, tracking=8)
    lw = 420 * ease_out((t - 0.1) / 0.5)
    red_line(img, W / 2 - lw, W / 2 + lw, int(H * 0.56), 0.9, 2)
    draw_text(img, P["period"], "mono", 36, (W / 2, H * 0.61), GREY, ease_out((t - 0.2) / 0.4), tracking=6)
    return to_arr(img)


def r_date(s, t, p, _):
    P = s["params"]
    a = bg_texture(t, (13, 12, 13), 0.05)
    img = to_img(a)
    big = P["big"]
    size = 360 if len(big) <= 5 else (230 if len(big) <= 11 else 175)
    punch = lerp(1.18, 1.0, ease_out(t / 0.22))
    drift = lerp(1.0, 1.035, p)
    # ghost echo behind
    draw_text(img, big, "display", size * punch * drift * 1.06, (W / 2, H * 0.42), (40, 14, 16), ease_out(t / 0.2), tracking=10)
    draw_text(img, big, "display", size * punch * drift, (W / 2, H * 0.42), LIGHT, ease_out(t / 0.06), tracking=10)
    k = ease_out((t - 0.15) / 0.3)
    f = font("sans_bold", 38)
    tw, _ = text_size(P["sub"], f, 8)
    y = H * 0.42 + size * 0.48 + 40
    ImageDraw.Draw(img).ellipse([W / 2 - tw / 2 - 34, y - 8, W / 2 - tw / 2 - 18, y + 8], fill=RED) if k > 0.5 else None
    draw_text(img, P["sub"], "sans_bold", 38, (W / 2 + 6, y), LIGHT, k, tracking=8)
    return to_arr(img)


def resolve_cam(c):
    if c[0] == "city":
        x, y = usmap.project(*usmap.CITIES[c[1]]); return x, y, c[2]
    if c[0] == "state":
        m = usmap.state_mask(c[1]); ys, xs = np.nonzero(m[::8, ::8])
        return xs.mean() * 8 / usmap.SS, ys.mean() * 8 / usmap.SS, c[2]
    return c[1], c[2], c[3]


def r_map(s, t, p, _):
    P = s["params"]
    c0, c1 = resolve_cam(P["cam"][0]), resolve_cam(P["cam"][1])
    e = ease_io(p)
    cx, cy, z = lerp(c0[0], c1[0], e), lerp(c0[1], c1[1], e), lerp(c0[2], c1[2], e)
    a = usmap.render_view(cx, cy, z, W, H, tuple(P.get("hl", [])), ease_out(t / 0.4))
    a += fog(t, 20, 3, 0.035)
    img = to_img(a)
    d = ImageDraw.Draw(img)

    def scr(city):
        x, y = usmap.project(*usmap.CITIES[city]); return (x - cx) * z + W / 2, (y - cy) * z + H / 2

    if "route" in P:
        (ca, cb), pa, pb = P["route"]
        k = ease_io((p - pa) / (pb - pa))
        (x0, y0), (x1, y1) = scr(ca), scr(cb)
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2 - 0.18 * math.hypot(x1 - x0, y1 - y0)
        pts = [((1 - u) ** 2 * x0 + 2 * (1 - u) * u * mx + u * u * x1, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * my + u * u * y1)
               for u in np.linspace(0, k, max(2, int(120 * k)))]
        for i in range(0, len(pts) - 1, 2):  # dashed
            d.line([pts[i], pts[i + 1]], fill=RED_SOFT, width=5)
        if k > 0:
            hx, hy = pts[-1]; d.ellipse([hx - 9, hy - 9, hx + 9, hy + 9], fill=LIGHT)
        d.ellipse([x0 - 7, y0 - 7, x0 + 7, y0 + 7], fill=GREY)
    for city, label, sub, appear in P.get("pins", []):
        k = ease_out((p - appear) / 0.15)
        if k <= 0:
            continue
        x, y = scr(city)
        if not label:  # dim earlier location
            d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(90, 90, 94)); continue
        ring = (t * 1.6) % 1
        rr = 10 + 40 * ring
        lay = Image.new("L", img.size, 0)
        ImageDraw.Draw(lay).ellipse([x - rr, y - rr, x + rr, y + rr], outline=int(220 * (1 - ring) * k), width=3)
        img.paste(RED_SOFT, (0, 0), lay)
        d.ellipse([x - 10, y - 10, x + 10, y + 10], fill=RED, outline=LIGHT, width=3)
        lx = x + 40 if x < W * 0.62 else x - 40
        anc = "l" if x < W * 0.62 else "r"
        ly = y - 30 if y > 260 else y + 60
        d.line([(x, y), (lx, ly)], fill=(200, 200, 200), width=2)
        draw_text(img, label, "sans_xbold", 46, (lx + (12 if anc == "l" else -12), ly - 4), LIGHT, k, anchor=anc + "s", shadow=True)
        draw_text(img, sub, "mono_bold", 28, (lx + (12 if anc == "l" else -12), ly + 14), (200, 196, 190), k, anchor=anc + "t", shadow=True)
    if "label" in P:
        k = ease_out(t / 0.4)
        draw_text(img, P["label"][0], "display", 130, (W / 2, H * 0.40), LIGHT, k, tracking=14, shadow=True)
        draw_text(img, P["label"][1], "mono_bold", 40, (W / 2, H * 0.40 + 95), RED_SOFT, k, tracking=10, shadow=True)
    if "note" in P:
        draw_text(img, P["note"], "mono", 24, (W - 60, H - 210), GREY, 0.9, anchor="rm", tracking=4)
    return to_arr(img)


@lru_cache(None)
def paper_plate():
    pw, ph = 2300, 1300
    r = np.random.default_rng(11)
    a = np.zeros((ph, pw, 3), np.float32) + np.array([0.035, 0.035, 0.038], np.float32)
    card = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(card).rectangle([300, 170, pw - 300, ph - 170], fill=255)
    card = np.asarray(card.filter(ImageFilter.GaussianBlur(3)), np.float32)[..., None] / 255
    tex = r.normal(0, 1, (ph // 4, pw // 4)).astype(np.float32)
    tex = np.asarray(Image.fromarray(((tex * 20) + 128).clip(0, 255).astype(np.uint8)).resize((pw, ph), Image.BICUBIC), np.float32)[..., None]
    paper = np.array([0.135, 0.13, 0.122], np.float32) + (tex - 128) / 128 * 0.018
    light = radial(pw, ph, pw * 0.42, ph * 0.35, pw * 0.7, ph * 0.9, 0.8)[..., None]
    a = a * (1 - card) + card * paper * (0.75 + 0.45 * light)
    shadow = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(shadow).rectangle([320, 200, pw - 280, ph - 140], fill=255)
    return to_img(a)


def r_casefile(s, t, p, _):
    P = s["params"]
    im = kb(paper_plate(), lerp(1.05, 1.11, p), lerp(0.47, 0.5, p), 0.5, rot=lerp(-1.2, -0.6, p))
    T = s["start"] + t
    x0, y0 = 360, 300
    draw_text(im, P["head"], "mono_bold", 40, (x0, y0), RED_SOFT, ease_out(t / 0.15), anchor="lm", tracking=3)
    red_line(im, x0, x0 + 1150 * ease_out(t / 0.4), y0 + 42, 0.8, 2)
    y = y0 + 120
    for txt, a0, a1 in P["lines"]:
        n = int(len(txt) * clamp((T - a0) / max(1e-3, a1 - a0)))
        if n > 0:
            draw_text(im, txt[:n], "mono_bold", 50, (x0, y), (226, 220, 208), 1.0, anchor="lm")
            if n < len(txt) and int(T * 8) % 2 == 0:
                f = font("mono_bold", 50)
                cx = x0 + f.getlength(txt[:n]) + 6
                ImageDraw.Draw(im).rectangle([cx, y - 24, cx + 22, y + 24], fill=(200, 196, 186))
        y += 78
    draw_text(im, "EDITORIAL GRAPHIC · SOURCES IN DESCRIPTION", "mono", 22, (W - 360, H - 230), (110, 108, 104), 0.9, anchor="rm", tracking=2)
    a = to_arr(im) + fog(t, 15, 8, 0.03)
    return a


def r_frames(s, t, p, _):
    a = bg_texture(t, (11, 11, 12), 0.05)
    img = to_img(a)
    d = ImageDraw.Draw(img)
    n = 5
    fw, fh, gap = 250, 320, 60
    x0 = W / 2 - (n * fw + (n - 1) * gap) / 2
    drift = lerp(0, -40, p)
    for i in range(n):
        fade = 1 - ease_io((t - 0.25 - i * 0.28) / 0.45)
        if fade <= 0.01:
            continue
        x = x0 + i * (fw + gap) + drift
        y = H * 0.40 - fh / 2
        c = int(lerp(40, 150, fade))
        d.rectangle([x, y, x + fw, y + fh], outline=(c, c, c + 2), width=3)
        d.rectangle([x + 18, y + 18, x + fw - 18, y + fh - 70], fill=(int(18 + 10 * fade),) * 3)
        d.line([(x + 30, y + fh - 40), (x + fw - 30, y + fh - 40)], fill=(c // 2,) * 3, width=3)
    return to_arr(img)


def r_streetlight(s, t, p, _):
    a = np.zeros((H, W, 3), np.float32) + np.array([0.02, 0.022, 0.028], np.float32)
    lx, ly = W * lerp(0.32, 0.36, p), H * 0.12
    cone = Image.new("L", (W, H), 0)
    ImageDraw.Draw(cone).polygon([(lx - 30, ly), (lx + 30, ly), (lx + 520, H), (lx - 520, H)], fill=255)
    cone = np.asarray(cone.filter(ImageFilter.GaussianBlur(60)), np.float32)[..., None] / 255
    fl = 0.85 + 0.15 * (0.5 + 0.5 * math.sin(t * 23) * math.sin(t * 7.3))
    col = np.array([0.55, 0.47, 0.36], np.float32)
    a += cone * col * 0.35 * fl * (0.6 + fog(t, 60, 6, 1.0) * 0.8)
    a += radial(W, H, lx, ly, 160, 160, 2)[..., None] * col * 1.2 * fl
    ground = radial(W, H, lx, H * 0.98, 640, 140, 1.5)[..., None]
    a += ground * col * 0.25 * fl
    a += fog(t, 45, 7, 0.07)
    return a


def r_board(s, t, p, _):
    a = bg_texture(t, (16, 15, 15), 0.03, seed=12)
    img = to_img(a)
    d = ImageDraw.Draw(img)
    pan = lerp(30, -30, ease_io(p))
    cards = [("WASHINGTON", "1974", 380, 300), ("OREGON", "1974", 520, 640), ("UTAH", "1974", 1180, 330), ("COLORADO", "1975", 1420, 620)]
    pos = []
    for i, (st, yr, x, y) in enumerate(cards):
        k = ease_out((t - 0.12 * i) / 0.25)
        x += pan
        pos.append((x + 150, y + 90))
        if k <= 0:
            continue
        d.rectangle([x + 8, y + 10, x + 308, y + 190], fill=(6, 6, 6))
        d.rectangle([x, y, x + 300, y + 180], fill=(int(178 * k), int(172 * k), int(160 * k)))
        draw_text(img, st, "mono_bold", 40, (x + 150, y + 70), (25, 25, 25), k)
        draw_text(img, yr, "mono", 32, (x + 150, y + 125), (90, 30, 30), k)
        d.ellipse([x + 140, y - 8, x + 160, y + 12], fill=RED)
    # strings that stop short: the cases are not yet connected
    for i, (a0, b0) in enumerate([(0, 1), (0, 2), (2, 3), (1, 3)]):
        k = ease_io((t - 0.6 - i * 0.25) / 0.6)
        if k <= 0:
            continue
        (x0, y0), (x1, y1) = pos[a0], pos[b0]
        f = 0.42 * k
        d.line([(x0, y0 - 90), (x0 + (x1 - x0) * f, (y0 - 90) + (y1 - y0) * f)], fill=RED, width=4)
        d.line([(x1, y1 - 90), (x1 - (x1 - x0) * f, (y1 - 90) - (y1 - y0) * f)], fill=RED, width=4)
    q = ease_out((t - 1.6) / 0.3)
    draw_text(img, "?", "display", 220, (W / 2 + pan, H * 0.45), RED_SOFT, q)
    return to_arr(img)


def r_policelights(s, t, p, _):
    a = np.zeros((H, W, 3), np.float32) + np.array([0.015, 0.016, 0.02], np.float32)
    # road with perspective lane marks
    road = Image.new("L", (W, H), 0)
    dr = ImageDraw.Draw(road)
    dr.polygon([(W * 0.46, H * 0.52), (W * 0.54, H * 0.52), (W * 1.1, H), (-W * 0.1, H)], fill=60)
    for i in range(8):
        z = ((i + t * 1.8) % 8) / 8
        y0 = H * 0.52 + (H * 0.48) * z ** 2
        y1 = H * 0.52 + (H * 0.48) * min(1, (z + 0.05)) ** 2
        w0, w1 = 2 + 30 * z ** 2, 2 + 30 * min(1, z + 0.05) ** 2
        dr.polygon([(W / 2 - w0, y0), (W / 2 + w0, y0), (W / 2 + w1, y1), (W / 2 - w1, y1)], fill=150)
    a += (np.asarray(road, np.float32) / 255)[..., None] * 0.18
    ph = (t * 2.2) % 1
    red_on, blue_on = ph < 0.5, ph >= 0.5
    for on, col, x in ((red_on, (0.62, 0.06, 0.07), W * 0.72), (blue_on, (0.10, 0.16, 0.48), W * 0.80)):
        lvl = 1.0 if on else 0.15
        a += radial(W, H, x, H * 0.48, 700, 420, 1.6)[..., None] * np.array(col, np.float32) * 0.75 * lvl
        a += radial(W, H, x, H * 0.85, 520, 120, 1.4)[..., None] * np.array(col, np.float32) * 0.35 * lvl
    a += fog(t, 70, 13, 0.05)
    return a


@lru_cache(None)
def beetle_plate():
    """Generic Beetle profile, line illustration (not a photo of any specific car)."""
    pw, ph = 2400, 1350
    m = Image.new("L", (pw, ph), 0)
    d = ImageDraw.Draw(m)
    cx, base = pw / 2, ph * 0.69
    L = 1300
    x0 = cx - L / 2
    body = []
    for u in np.linspace(0, 1, 200):
        x = x0 + u * L
        # roof: asymmetric arc, steeper at the front
        hh = 470 * math.sin(math.pi * u ** (0.85 if u < 0.5 else 0.95)) ** 0.9
        body.append((x, base - 120 - hh * (0.95 if u > 0.15 else 0.6 + 2.3 * u)))
    body = [(x0 - 10, base - 60)] + body + [(x0 + L + 15, base - 60)]
    d.line(body, fill=255, width=7, joint="curve")
    d.line([(x0 - 10, base - 60), (x0 + L + 15, base - 60)], fill=255, width=6)
    # windows
    d.line([(x0 + 360, base - 300), (x0 + 470, base - 520), (x0 + 820, base - 545), (x0 + 1000, base - 330), (x0 + 360, base - 300)], fill=200, width=5)
    d.line([(x0 + 690, base - 540), (x0 + 680, base - 305)], fill=200, width=5)
    # fenders and wheels
    for wx in (x0 + 260, x0 + L - 250):
        d.arc([wx - 210, base - 270, wx + 210, base + 150], 180, 360, fill=255, width=7)
        d.ellipse([wx - 150, base - 150, wx + 150, base + 150], outline=255, width=8)
        d.ellipse([wx - 60, base - 60, wx + 60, base + 60], outline=160, width=5)
    d.line([(x0 + 470, base - 60), (x0 + 470, base - 290)], fill=170, width=4)  # door
    d.ellipse([x0 + 50, base - 285, x0 + 120, base - 205], outline=255, width=6)  # headlight
    glow = m.filter(ImageFilter.GaussianBlur(14))
    a = np.zeros((ph, pw, 3), np.float32) + np.array([0.03, 0.03, 0.034], np.float32)
    line = np.asarray(m, np.float32)[..., None] / 255
    gl = np.asarray(glow, np.float32)[..., None] / 255
    a += gl * np.array([0.45, 0.40, 0.33], np.float32) * 0.9 + line * np.array([0.82, 0.78, 0.72], np.float32)
    a += radial(pw, ph, x0 + 85, base - 245, 120, 120, 2)[..., None] * np.array([0.9, 0.8, 0.6], np.float32) * 0.8
    floor = radial(pw, ph, cx, base + 165, 900, 50, 1.2)[..., None]
    a += floor * 0.08
    return to_img(a)


def r_beetle(s, t, p, _):
    im = kb(beetle_plate(), lerp(1.0, 1.08, ease_io(p)), lerp(0.47, 0.52, p), 0.52)
    a = to_arr(im)
    wipe = ease_out(t / 0.5)
    xs = np.linspace(0, 1, W, dtype=np.float32)[None, :, None]
    a *= np.clip((wipe * 1.2 - xs) * 6, 0, 1)
    img = to_img(a + fog(t, 30, 2, 0.04))
    draw_text(img, "VOLKSWAGEN BEETLE", "sans_xbold", 44, (140, 130), LIGHT, ease_out((t - 0.2) / 0.3), anchor="lm", tracking=6)
    draw_text(img, "LINE ILLUSTRATION — NOT THE ACTUAL VEHICLE", "mono", 26, (140, 178), GREY, ease_out((t - 0.3) / 0.3), anchor="lm", tracking=2)
    return to_arr(img)


def r_stamp(s, t, p, _):
    P = s["params"]
    im = kb(paper_plate(), lerp(1.12, 1.16, p), 0.5, 0.5, rot=-0.5)
    a = to_arr(im) * 0.85
    img = to_img(a)
    draw_text(img, P["top"], "mono_bold", 40, (W / 2, H * 0.30), (200, 194, 182), ease_out(t / 0.2), tracking=6)
    hit = 0.10
    k = clamp((t - hit) / 0.09)
    if k > 0:
        txt = P["stamp"]
        size = 150 if len(txt) < 12 else 110
        sc = lerp(1.5, 1.0, ease_out(k))
        f = font("display", size * sc)
        tw, th = text_size(txt, f, 10 * sc)
        lay = Image.new("L", (int(tw + 120 * sc), int(size * sc * 1.25)), 0)
        ld = ImageDraw.Draw(lay)
        ld.rectangle([6, 6, lay.size[0] - 6, lay.size[1] - 6], outline=255, width=int(9 * sc))
        x = (lay.size[0] - tw) / 2
        for c in txt:
            ld.text((x, lay.size[1] / 2 + 6 * sc), c, font=f, fill=255, anchor="lm"); x += f.getlength(c) + 10 * sc
        # worn ink texture
        noise = (np.random.default_rng(5).random(lay.size[::-1]) > 0.12).astype(np.float32)
        lay = Image.fromarray((np.asarray(lay, np.float32) * noise * min(1, k * 1.5)).astype(np.uint8)).rotate(6, expand=True, resample=Image.BICUBIC)
        shake = (1 - k) * 14
        img.paste((168, 26, 30), (int(W / 2 - lay.size[0] / 2 + shake), int(H * 0.47 - lay.size[1] / 2)), lay)
    draw_text(img, P["bottom"], "mono_bold", 40, (W / 2, H * 0.66), (200, 194, 182), ease_out((t - 0.3) / 0.3), tracking=6)
    if P.get("late"):
        draw_text(img, P["late"], "mono_bold", 40, (W / 2, H * 0.72), RED_SOFT, ease_out((p - 0.55) / 0.12), tracking=6)
    return to_arr(img)


def r_timeline(s, t, p, _):
    P = s["params"]
    a = bg_texture(t, (12, 12, 13), 0.04)
    img = to_img(a)
    d = ImageDraw.Draw(img)
    yr = lerp(P["from"], P["to"], ease_io(p))
    ppy = 420  # pixels per year
    y = H * 0.48
    for year in range(1972, 1992):
        x = W / 2 + (year - yr) * ppy
        if -100 < x < W + 100:
            d.line([(x, y - 20), (x, y + 20)], fill=(110, 110, 114), width=3)
            near = 1 - min(1, abs(year - yr) / 1.2)
            draw_text(img, str(year), "display", lerp(60, 120, near), (x, y - 100), tuple(int(lerp(90, 232, near)) for _ in range(3)), 1.0)
    d.line([(0, y), (W, y)], fill=(70, 70, 74), width=2)
    events = {1974.5: "CASES IN WASHINGTON & UTAH", 1975.6: "ARREST · UTAH", 1976.2: "CONVICTION", 1977.45: "ESCAPE 1", 1977.99: "ESCAPE 2"}
    for ev, label in events.items():
        x = W / 2 + (ev - yr) * ppy
        d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=RED)
        draw_text(img, label, "mono_bold", 26, (x, y + 60), (190, 186, 180), 1.0, tracking=2)
    d.line([(W / 2, y - 200), (W / 2, y + 30)], fill=RED_SOFT, width=2)
    return to_arr(img)


def r_location(s, t, p, _):
    P = s["params"]
    a = np.zeros((H, W, 3), np.float32) + 0.025
    # soft, out-of-focus window lights (abstract night ambience)
    r = np.random.default_rng(21)
    for _ in range(9):
        x, y = r.uniform(0.1, 0.9) * W + lerp(0, -60, p), r.uniform(0.15, 0.6) * H
        a += radial(W, H, x, y, 120, 120, 2.2)[..., None] * np.array([0.30, 0.24, 0.15], np.float32) * r.uniform(0.2, 0.6)
    a += fog(t, 25, 14, 0.05)
    img = to_img(a)
    k = ease_out(t / 0.3)
    draw_text(img, P["big"], "display", 210 * lerp(1.0, 1.03, p), (W / 2, H * 0.42), LIGHT, k, tracking=16, shadow=True)
    draw_text(img, P["sub"], "sans_bold", 38, (W / 2, H * 0.42 + 130), (205, 200, 192), ease_out((t - 0.2) / 0.3), tracking=6, shadow=True)
    return to_arr(img)


def r_memorial(s, t, p, _):
    P = s["params"]
    a = np.zeros((H, W, 3), np.float32) + 0.012 + fog(t, 10, 15, 0.03)
    img = to_img(a)
    sc = lerp(1.0, 1.025, p)
    for i, n in enumerate(P["names"]):
        draw_text(img, n, "sans_semi", 74 * sc, (W / 2, H * (0.34 + 0.11 * i)), LIGHT, ease_io((t - 0.15 - 0.35 * i) / 0.6), tracking=10)
    red_line(img, W / 2 - 40, W / 2 + 40, int(H * 0.59), ease_io((t - 0.8) / 0.5), 2)
    draw_text(img, P["sub"], "mono", 32, (W / 2, H * 0.64), GREY, ease_io((t - 0.9) / 0.6), tracking=5)
    return to_arr(img)


def r_tv(s, t, p, _):
    P = s["params"]
    a = np.zeros((H, W, 3), np.float32) + 0.015
    z = lerp(1.0, 1.06, p)
    sw, sh = 760 * z, 560 * z
    cx, cy = W / 2, H * 0.43
    glow = radial(W, H, cx, cy, sw * 1.2, sh * 1.3, 1.4)[..., None]
    a += glow * np.array([0.25, 0.27, 0.30], np.float32) * 0.6
    img = to_img(a)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([cx - sw / 2 - 50, cy - sh / 2 - 45, cx + sw / 2 + 50, cy + sh / 2 + 45], 40, fill=(20, 19, 18))
    scr = np.random.default_rng(int(t * 30)).random((int(sh) // 4, int(sw) // 4)).astype(np.float32)
    scr = 0.30 + 0.25 * scr
    rows = np.arange(scr.shape[0])[:, None]
    scr *= 0.75 + 0.25 * (np.sin((rows + t * 40) * 0.9) > 0)
    roll = ((rows / scr.shape[0] - t * 0.4) % 1)
    scr *= 0.8 + 0.4 * np.exp(-((roll - 0.5) ** 2) / 0.004)
    sim = Image.fromarray((np.clip(scr, 0, 1) * 255).astype(np.uint8)).resize((int(sw), int(sh)), Image.NEAREST).convert("RGB")
    mask = Image.new("L", sim.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sim.size[0] - 1, sim.size[1] - 1], 60, fill=255)
    img.paste(sim, (int(cx - sw / 2), int(cy - sh / 2)), mask)
    draw_text(img, P["label"], "display", 110, (W / 2, H * 0.43), LIGHT, ease_out((t - 0.15) / 0.3), tracking=10, shadow=True)
    draw_text(img, P["sub"], "mono_bold", 34, (W / 2, cy + sh / 2 + 90), (200, 196, 190), ease_out((t - 0.3) / 0.3), tracking=6)
    return to_arr(img)


def r_spotlight(s, t, p, _):
    wide = s["params"]["wide"]
    z = lerp(1.25, 1.0, ease_io(p)) if wide else lerp(1.0, 1.15, ease_io(p))
    a = np.zeros((H, W, 3), np.float32) + 0.012
    cx = W / 2
    top = -H * 0.2
    cone = Image.new("L", (W, H), 0)
    bw = 360 * z
    ImageDraw.Draw(cone).polygon([(cx - 60 * z, top), (cx + 60 * z, top), (cx + bw, H * 0.80), (cx - bw, H * 0.80)], fill=255)
    cone = np.asarray(cone.filter(ImageFilter.GaussianBlur(40)), np.float32)[..., None] / 255
    col = np.array([0.62, 0.56, 0.46], np.float32)
    a += cone * col * 0.28 * (0.75 + fog(t, 20, 16, 1.0) * 0.6)
    a += radial(W, H, cx, H * 0.80, bw * 1.1, 70 * z, 1.2)[..., None] * col * 0.5
    img = to_img(a)
    d = ImageDraw.Draw(img)
    if wide:  # rows of benches in the foreground
        for i in range(3):
            y = H * (0.84 + 0.07 * i)
            d.rounded_rectangle([-50, y, W + 50, y + 90], 18, fill=(5 + 2 * i, 5 + 2 * i, 6 + 2 * i))
    # dust motes in the beam
    r = np.random.default_rng(31)
    for _ in range(70):
        x0, y0, sp = r.uniform(-1, 1), r.uniform(0, 1), r.uniform(0.02, 0.06)
        yy = ((y0 + t * sp) % 1) * H * 0.8
        xx = cx + x0 * (60 + (bw - 60) * yy / (H * 0.8)) * 0.8
        b = int(r.uniform(90, 200))
        d.ellipse([xx - 1.5, yy - 1.5, xx + 1.5, yy + 1.5], fill=(b, b - 6, b - 14))
    # lectern silhouette
    lw, lh = 170 * z, 300 * z
    d.polygon([(cx - lw / 2, H * 0.80 - lh), (cx + lw / 2, H * 0.80 - lh), (cx + lw / 2.6, H * 0.80), (cx - lw / 2.6, H * 0.80)], fill=(8, 8, 9))
    if not wide:
        draw_text(img, "HE TOOK PART IN HIS OWN DEFENSE", "mono_bold", 34, (W / 2, H * 0.14), (205, 200, 192), ease_out((t - 0.3) / 0.3), tracking=6)
    return to_arr(img)


def r_years(s, t, p, _):
    P = s["params"]
    a = bg_texture(t, (12, 12, 13), 0.03)
    # slow-moving vertical bar shadows
    xs = np.arange(W, dtype=np.float32)
    bars = 0.55 + 0.45 * (np.sin((xs + t * 60) / 1920 * 2 * math.pi * 7) > 0.55)
    light = radial(W, H, W * 0.3, H * 0.4, W * 0.9, H * 0.9, 1)[..., None] * 0.12
    a = a + light * bars[None, :, None]
    img = to_img(a)
    yr = int(round(lerp(P["from"], P["to"], ease_io(p / 0.65))))
    draw_text(img, str(yr), "display", 380, (W / 2, H * 0.43), LIGHT if yr < P["to"] else RED_SOFT, 1.0, tracking=12, shadow=True)
    draw_text(img, "DEATH ROW · FLORIDA STATE PRISON", "mono_bold", 36, (W / 2, H * 0.43 + 215), (200, 196, 190), ease_out(t / 0.3), tracking=6)
    return to_arr(img)


def r_execdate(s, t, p, _):
    P = s["params"]
    a = np.zeros((H, W, 3), np.float32) + 0.015 + fog(t, 12, 17, 0.035)
    img = to_img(a)
    k = ease_io(t / 0.6)
    draw_text(img, P["big"], "display", 200 * lerp(1.0, 1.03, p), (W / 2, H * 0.42), LIGHT, k, tracking=14)
    red_line(img, W / 2 - 50, W / 2 + 50, int(H * 0.42 + 115), ease_io((t - 0.4) / 0.4), 3)
    draw_text(img, P["sub"], "mono_bold", 36, (W / 2, H * 0.42 + 175), (190, 186, 180), ease_io((t - 0.5) / 0.6), tracking=5)
    return to_arr(img)


def words_of(line):
    return VT["lines"][line]["words"]


def layout_words(words, key, size, max_w, gap=None):
    f = font(key, size)
    gap = gap or size * 0.28
    lines, cur, cw = [], [], 0
    for i, w in enumerate(words):
        ww = f.getlength(w)
        if cur and cw + gap + ww > max_w:
            lines.append(cur); cur, cw = [], 0
        cur.append((i, w, ww)); cw += (gap if cw else 0) + ww
    lines.append(cur)
    return lines, f, gap


def r_textreveal(s, t, p, upper=True, size=120, red=()):
    P = s["params"]
    T = s["start"] + t
    a = np.zeros((H, W, 3), np.float32) + 0.016 + fog(t, 14, 18, 0.04)
    img = to_img(a)
    ws = words_of(P["line"])
    texts = [w["w"].upper() if upper else w["w"] for w in ws]
    lines, f, gap = layout_words(texts, "display", size, W * 0.78)
    lh = size * 1.02
    y = H * 0.44 - (len(lines) - 1) * lh / 2
    for ln in lines:
        tw = sum(x[2] for x in ln) + gap * (len(ln) - 1)
        x = W / 2 - tw / 2
        for i, wtxt, ww in ln:
            k = ease_out((T - ws[i]["start"] + 0.05) / 0.18)
            col = RED_SOFT if ws[i]["w"].lower() in P.get("red", []) else LIGHT
            draw_text(img, wtxt, "display", size, (x, y + (1 - k) * 18), col, k, anchor="lm")
            x += ww + gap
        y += lh
    return to_arr(img)


def r_question(s, t, p, _):
    return r_textreveal(s, t, p, size=124)


def r_statement(s, t, p, _):
    a = r_textreveal(s, t, p, size=150)
    if s["index"] == SHOTS[-2]["index"]:  # last statement: fade toward the end card
        a *= 1 - 0.6 * ease_io((p - 0.75) / 0.25)
    return a


def r_endcard(s, t, p, _):
    P = s["params"]
    a = np.zeros((H, W, 3), np.float32) + 0.016 + fog(t, 10, 19, 0.035)
    img = to_img(a)
    lines, f, gap = layout_words(P["q"].split(), "display", 96, W * 0.72)
    y = H * 0.34 - (len(lines) - 1) * 50
    for ln in lines:
        txt = " ".join(x[1] for x in ln)
        draw_text(img, txt, "display", 96, (W / 2, y), LIGHT, ease_out(t / 0.5), tracking=4)
        y += 100
    draw_text(img, P["cta"], "sans_semi", 40, (W / 2, y + 30), RED_SOFT, ease_out((t - 0.6) / 0.5))
    red_line(img, W / 2 - 40, W / 2 + 40, int(H * 0.70), ease_out((t - 1.4) / 0.5), 2)
    draw_text(img, P["mem"], "sans_med", 32, (W / 2, H * 0.76), GREY, ease_out((t - 1.6) / 0.6))
    draw_text(img, "Narration: synthetic voice (Kokoro TTS) · Graphics are editorial illustrations · Sources & licences in description",
              "sans", 22, (W / 2, H * 0.93), (95, 95, 98), ease_out((t - 2.0) / 0.6))
    out = to_arr(img)
    return out * (1 - ease_io((t - (s["duration"] - 1.0)) / 0.9))


@lru_cache(8)
def photo_plate(path):
    im = Image.open(ARCHIVAL / path).convert("L")
    im = ImageOps.autocontrast(im, cutoff=1)
    if min(im.size) < 1100:
        f = 1100 / min(im.size); im = im.resize((int(im.size[0] * f), int(im.size[1] * f)), Image.LANCZOS)
    # fit inside 16:9 with blurred fill so portraits are never stretched
    pw, ph = 2400, 1350
    bgim = ImageOps.fit(im, (pw, ph)).filter(ImageFilter.GaussianBlur(40)).point(lambda v: v * 0.35)
    sc = min(pw / im.size[0], ph / im.size[1])
    fg = im.resize((int(im.size[0] * sc), int(im.size[1] * sc)), Image.LANCZOS)
    bgim.paste(fg, ((pw - fg.size[0]) // 2, (ph - fg.size[1]) // 2))
    a = np.asarray(bgim, np.float32)[..., None] / 255
    tone = np.array([1.0, 0.97, 0.92], np.float32)  # neutral archival tone
    return to_img(np.clip((a - 0.5) * 1.12 + 0.5, 0, 1) * tone)


def r_photo(s, t, p, _):
    ph = s["photo"]
    z0, z1 = ph.get("zoom", [1.0, 1.08])
    im = kb(photo_plate(ph["file"]), lerp(z0, z1, ease_io(p)), lerp(*ph.get("x", [0.5, 0.5]), p), lerp(*ph.get("y", [0.45, 0.42]), p))
    img = im.copy()
    draw_text(img, ph.get("caption", ""), "mono_bold", 26, (60, 70), (220, 216, 208), ease_out(t / 0.3), anchor="lm", tracking=3, shadow=True)
    draw_text(img, "ARCHIVAL · " + ph.get("credit", ""), "mono", 20, (60, 105), (170, 166, 160), ease_out(t / 0.3), anchor="lm", tracking=2, shadow=True)
    return to_arr(img)


RENDER = {k[2:]: v for k, v in globals().items() if k.startswith("r_")}


def at_word(word):
    for ln in VT["lines"]:
        for w in ln["words"]:
            if w["w"] == word:
                return w["start"]
    raise KeyError(word)


# ------------------------------------------------------------------ overlays
def chapter_tag(img, s, T):
    ch = s["chapter"]
    if ch == 0 or s["type"] in ("chapter", "question", "statement", "endcard", "memorial"):
        return
    name = TL["chapters"][str(ch)]
    draw_text(img, f"{ch:02d}", "mono_bold", 24, (64, 62), RED_SOFT, 0.95, anchor="lm", tracking=2)
    draw_text(img, name, "mono", 24, (110, 62), (165, 163, 158), 0.85, anchor="lm", tracking=3)


def illus_tag(img, s):
    if s.get("illustrative") and "photo" not in s:
        draw_text(img, "ILLUSTRATION", "mono", 22, (W - 64, 62), (150, 148, 144), 0.8, anchor="rm", tracking=4)


def draw_subs(img, T):
    for c in CHUNKS:
        if c["start"] - 0.02 <= T < c["end"]:
            break
    else:
        return
    k = ease_out((T - c["start"] + 0.02) / 0.14)
    size = 56
    f = font("sans_xbold", size)
    words = c["words"]
    gap = f.getlength(" ")
    widths = [f.getlength(w["w"]) for w in words]
    tw = sum(widths) + gap * (len(words) - 1)
    x = W / 2 - tw / 2
    y = H - 150 + (1 - k) * 14
    layer_w = Image.new("L", img.size, 0)
    layer_dim = Image.new("L", img.size, 0)
    layer_red = Image.new("L", img.size, 0)
    dw, dd, dr = ImageDraw.Draw(layer_w), ImageDraw.Draw(layer_dim), ImageDraw.Draw(layer_red)
    for w, ww in zip(words, widths):
        spoken = T >= w["start"] - 0.03
        target = (dr if w["key"] else dw) if spoken else dd
        target.text((x, y), w["w"], font=f, fill=255, anchor="ls")
        x += ww + gap
    alpha = k
    allm = Image.fromarray(np.maximum(np.maximum(np.asarray(layer_w), np.asarray(layer_dim)), np.asarray(layer_red)))
    sh = allm.filter(ImageFilter.GaussianBlur(9)).point(lambda v: int(min(255, v * 1.6) * 0.85 * alpha))
    img.paste((0, 0, 0), (0, 0), sh)
    img.paste((242, 240, 236), (0, 0), layer_w.point(lambda v: int(v * alpha)))
    img.paste((150, 150, 150), (0, 0), layer_dim.point(lambda v: int(v * alpha)))
    img.paste((226, 70, 62), (0, 0), layer_red.point(lambda v: int(v * alpha)))


# ------------------------------------------------------------------ frame assembly
def shot_at(T):
    for i, s in enumerate(SHOTS):
        if s["start"] <= T < s["end"]:
            return i
    return len(SHOTS) - 1


def render_shot(s, T):
    t = T - s["start"]
    p = clamp(t / s["duration"])
    fn = RENDER["photo"] if "photo" in s else RENDER[s["type"]]
    return fn(s, t, p, None)


def frame(n):
    T = n / FPS
    i = shot_at(T)
    s = SHOTS[i]
    a = render_shot(s, T)
    t = T - s["start"]
    tr = s["transition"]
    if tr == "dip":
        a *= 0.12 + 0.88 * ease_io(t / 0.18)  # dip never reaches pure black mid-film
    elif tr == "flash" and t < 2.5 / FPS:
        a = a * 0.4 + 0.6 * np.array([0.95, 0.92, 0.9], np.float32) * (1 - t * FPS / 2.5)
    a = np.clip(a, 0, 1)
    # film look: vignette, grain, gentle gate flicker
    flick = 1 + 0.012 * math.sin(T * 17.1) * math.sin(T * 5.3)
    a = a * vignette() * flick
    a += grain_frames()[n % 12] * 0.022
    img = to_img(a)
    chapter_tag(img, s, T)
    illus_tag(img, s)
    if s["subs"]:
        draw_subs(img, T)
    return img


def render_range(args):
    a, b, path, scale = args
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
    if scale != 1:
        cmd += ["-vf", f"scale={int(W * scale)}:{int(H * scale)}"]
    cmd += ["-c:v", "libx264", "-preset", "veryfast" if scale != 1 else "slow", "-crf", "23" if scale != 1 else "15",
            "-pix_fmt", "yuv420p", "-threads", "1", path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in range(a, b):
        proc.stdin.write(frame(n).tobytes())
    proc.stdin.close()
    proc.wait()
    return path


def main():
    args = sys.argv[1:]
    total = int(round(TL["duration"] * FPS))
    if "--still" in args:
        (BUILD / "stills").mkdir(exist_ok=True)
        for tt in args[args.index("--still") + 1].split(","):
            n = int(float(tt) * FPS)
            frame(n).save(BUILD / "stills" / f"f_{float(tt):07.2f}.png")
        return
    preview = "--preview" in args
    scale = 0.5 if preview else 1
    workers = os.cpu_count() or 4
    nseg = workers * 3
    bounds = np.linspace(0, total, nseg + 1).astype(int)
    seg_dir = BUILD / ("seg_preview" if preview else "seg_final")
    seg_dir.mkdir(exist_ok=True)
    jobs = [(int(bounds[i]), int(bounds[i + 1]), str(seg_dir / f"s{i:03d}.mp4"), scale) for i in range(nseg)]
    with Pool(workers) as pool:
        for pth in pool.imap_unordered(render_range, jobs):
            print("done", pth, flush=True)
    lst = seg_dir / "list.txt"
    lst.write_text("".join(f"file '{j[2]}'\n" for j in jobs))
    out = BUILD / ("video_preview.mp4" if preview else "video_final.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)], check=True)
    print("wrote", out, total, "frames")


if __name__ == "__main__":
    main()
