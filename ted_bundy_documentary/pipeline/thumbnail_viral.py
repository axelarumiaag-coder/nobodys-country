"""High-impact YouTube thumbnails (1280x720) built from the real 1978 portrait.

Variants: A "behind the smile", B split-light "perfect mask", C in-court portrait.
Only lighting/grading is applied to the photograph; nothing is added to the face.
Outputs output/thumbnails/ted_bundy_thumbnail_{A,B,C}.jpg
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageEnhance
from common import OUT, ARCHIVAL, FONTS
from render import font, radial

TW, TH = 1280, 720
HEAD = ARCHIVAL / "selected" / "bundy_headshot_1978.jpg"
COURT = ARCHIVAL / "selected" / "bundy_court_1979.jpg"
RED = (214, 28, 34)
WHITE = (246, 243, 236)


def prep(path, size, centering, contrast=1.35, sharpen=True):
    im = Image.open(path).convert("L")
    im = ImageOps.autocontrast(im, cutoff=0.5)
    im = ImageOps.fit(im, size, Image.LANCZOS, centering=centering)
    im = ImageEnhance.Contrast(im).enhance(contrast)
    if sharpen:
        im = im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=140, threshold=2))
    return im


def tone(gray, tint=(1.0, 0.97, 0.92)):
    a = np.asarray(gray, np.float32)[..., None] / 255
    return a * np.array(tint, np.float32)


def text_block(img, lines, x, y, shadow=14):
    """lines: [(text, font_key, size, color)] drawn top-down with a heavy soft shadow."""
    sh = Image.new("L", img.size, 0)
    ds, d = ImageDraw.Draw(sh), ImageDraw.Draw(img)
    yy = y
    pos = []
    for txt, key, size, col in lines:
        f = font(key, size)
        b = f.getbbox(txt)
        ds.text((x, yy - b[1]), txt, font=f, fill=255)
        pos.append((txt, f, (x, yy - b[1]), col))
        yy += (b[3] - b[1]) + int(size * 0.12)
    img.paste((0, 0, 0), (0, 0), sh.filter(ImageFilter.GaussianBlur(shadow)).point(lambda v: min(255, int(v * 1.4))))
    for txt, f, p, col in pos:
        d.text(p, txt, font=f, fill=col, stroke_width=2, stroke_fill=(0, 0, 0))
    return yy


def finish(img, name):
    a = np.asarray(img, np.float32) / 255
    a *= (0.6 + 0.4 * np.clip(radial(TW, TH, TW / 2, TH / 2, TW * 0.85, TH * 1.05, 1.0) * 1.7, 0, 1))[..., None]
    a += np.random.default_rng(2).normal(0, 0.01, a.shape)
    out = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    d = OUT / "thumbnails"
    d.mkdir(exist_ok=True)
    out.save(d / f"ted_bundy_thumbnail_{name}.jpg", quality=95, subsampling=0)
    return out


def variant_a():
    """Huge face right, eyes on the upper third; 'TED BUNDY' + hook left."""
    base = np.zeros((TH, TW, 3), np.float32) + 0.025
    base += radial(TW, TH, TW * 0.70, TH * 0.40, TW * 0.55, TH * 0.9, 1.3)[..., None] * np.array([0.16, 0.03, 0.03], np.float32)
    face = prep(HEAD, (760, 900), (0.52, 0.30))  # tight crop: face fills the frame
    f = tone(face)
    # rim of red light on the right edge of the face
    f = f + radial(760, 900, 760, 380, 420, 700, 1.6)[..., None] * np.array([0.35, 0.02, 0.02], np.float32)
    fade = np.clip(np.linspace(-0.25, 1.6, 760), 0, 1)[None, :, None] * np.clip(np.linspace(1.4, 0.0, 900) * 1.6, 0, 1)[:, None, None] ** 0.15
    img = Image.fromarray(np.clip(base * 255, 0, 255).astype(np.uint8))
    face_img = Image.fromarray(np.clip(f * 255, 0, 255).astype(np.uint8))
    mask = Image.fromarray((np.clip(fade[..., 0], 0, 1) * 255).astype(np.uint8))
    img.paste(face_img.crop((0, 90, 760, 810)), (TW - 760 + 40, 0), mask.crop((0, 90, 760, 810)))
    text_block(img, [("TED", "display", 230, WHITE), ("BUNDY", "display", 230, RED)], 48, 34)
    d = ImageDraw.Draw(img)
    d.rectangle([52, 540, 172, 550], fill=RED)
    text_block(img, [("THE MAN BEHIND", "sans_black", 54, WHITE), ("THE SMILE", "sans_black", 54, WHITE)], 52, 572, shadow=8)
    return finish(img, "A")


def variant_b():
    """Split light: one half of the face warm, the other in deep red shadow — 'the perfect mask'."""
    face = prep(HEAD, (820, 720), (0.5, 0.32))
    a = tone(face)
    w = a.shape[1]
    k = np.clip((np.arange(w) - w * 0.53) / 30 + 0.5, 0, 1)[None, :, None]
    warm = a * np.array([1.04, 0.98, 0.88], np.float32)
    redside = (a.mean(2, keepdims=True) ** 1.25) * np.array([0.95, 0.10, 0.10], np.float32) * 0.9
    f = warm * (1 - k) + redside * k
    base = np.zeros((TH, TW, 3), np.float32) + 0.02
    img = Image.fromarray(np.clip(base * 255, 0, 255).astype(np.uint8))
    fade = np.clip(np.linspace(-0.2, 1.8, w), 0, 1)
    mask = Image.fromarray((np.tile(fade, (720, 1)) * 255).astype(np.uint8))
    img.paste(Image.fromarray(np.clip(f * 255, 0, 255).astype(np.uint8)), (TW - w + 30, 0), mask)
    d = ImageDraw.Draw(img)
    # thin crack line along the split
    x = TW - w + 30 + int(w * 0.53)
    d.line([(x, 0), (x, TH)], fill=(255, 235, 225), width=2)
    text_block(img, [("TED BUNDY", "display", 168, WHITE)], 46, 50)
    text_block(img, [("THE PERFECT", "display", 118, WHITE), ("MASK", "display", 150, RED)], 46, 250)
    return finish(img, "B")


def variant_c():
    """In-court portrait (1979): pensive face, 'TED BUNDY' + 'HE FOOLED EVERYONE?'"""
    face = prep(COURT, (900, 720), (0.38, 0.35), contrast=1.25)
    a = tone(face)
    base = np.zeros((TH, TW, 3), np.float32) + 0.02
    img = Image.fromarray(np.clip(base * 255, 0, 255).astype(np.uint8))
    fade = np.clip(np.linspace(-0.3, 1.7, 900), 0, 1)
    mask = Image.fromarray((np.tile(fade, (720, 1)) * 255).astype(np.uint8))
    img.paste(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)), (TW - 900 + 20, 0), mask)
    text_block(img, [("TED", "display", 220, WHITE), ("BUNDY", "display", 220, RED)], 48, 40)
    text_block(img, [("30 CONFESSED", "sans_black", 56, WHITE), ("MURDERS", "sans_black", 56, WHITE)], 52, 560, shadow=8)
    return finish(img, "C")


if __name__ == "__main__":
    outs = [variant_a(), variant_b(), variant_c()]
    sheet = Image.new("RGB", (1280 + 20 + 320, 720 * 3 + 40), (255, 255, 255))
    for i, im in enumerate(outs):
        sheet.paste(im, (0, i * 740))
        sheet.paste(im.resize((320, 180), Image.LANCZOS), (1300, i * 740))
        sheet.paste(im.resize((168, 94), Image.LANCZOS), (1300, i * 740 + 200))
    sheet.save(OUT / "thumbnails" / "_preview_sheet.png")
    print("ok")
