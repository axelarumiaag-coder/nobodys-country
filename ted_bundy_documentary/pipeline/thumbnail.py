"""YouTube thumbnail, 1280x720 -> output/ted_bundy_thumbnail.jpg.

Uses the archival slot 'thumbnail_portrait' from assets/archival/archival_assignments.json
when a verified, properly licensed portrait has been assigned; otherwise the documentary's
own illustrative silhouette (no fabricated likeness).
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from common import OUT, ARCHIVAL, FONTS, load_json
from render import silhouette_plate, radial, font, to_img

TW, TH = 1280, 720


def portrait_layer():
    ap = ARCHIVAL / "archival_assignments.json"
    slot = load_json(ap).get("slots", {}).get("thumbnail_portrait") if ap.exists() else None
    if slot and (ARCHIVAL / slot["file"]).exists():
        im = ImageOps.autocontrast(Image.open(ARCHIVAL / slot["file"]).convert("L"), cutoff=1)
        im = ImageOps.fit(im, (700, 720), centering=(0.5, 0.3))
        a = np.asarray(im, np.float32)[..., None] / 255 * np.array([1.0, 0.97, 0.93], np.float32)
        fade = np.clip(np.linspace(-0.2, 1.4, 700), 0, 1)[None, :, None]
        return to_img(a * fade), "archival"
    warm = np.asarray(silhouette_plate("warm"), np.float32) / 255
    cold = np.asarray(silhouette_plate("cold"), np.float32) / 255
    w = warm.shape[1]
    split = np.clip((np.arange(w) - w * 0.5) / 140 + 0.5, 0, 1)[None, :, None]  # left warm / right red
    a = warm * (1 - split) + cold * split
    im = to_img(a).crop((560, 60, 1840, 1350)).resize((700, 710), Image.LANCZOS)
    return im, "illustration"


def main():
    base = np.zeros((TH, TW, 3), np.float32) + 0.03
    base += radial(TW, TH, TW * 0.72, TH * 0.45, TW * 0.6, TH * 0.9, 1.4)[..., None] * np.array([0.10, 0.03, 0.03], np.float32)
    img = to_img(base)
    layer, kind = portrait_layer()
    lw, lh = layer.size
    fx = np.clip(np.arange(lw) / 240.0, 0, 1) ** 1.5
    fy = np.clip(np.arange(lh) / 120.0, 0, 1)
    feather = Image.fromarray((np.outer(fy, fx) * 255).astype(np.uint8))
    img.paste(layer, (TW - lw + 40, TH - lh + 10), feather)
    d = ImageDraw.Draw(img)
    # headline: one focal point (figure) + 3 large words
    x = 64
    f1 = font("display", 150)
    f2 = font("display", 250)
    sh = Image.new("L", img.size, 0)
    ds = ImageDraw.Draw(sh)
    for (txt, f, y) in (("THE PERFECT", f1, 70), ("MASK", f2, 205)):
        ds.text((x, y), txt, font=f, fill=255)
    img.paste((0, 0, 0), (0, 0), sh.filter(ImageFilter.GaussianBlur(12)))
    d.text((x, 70), "THE PERFECT", font=f1, fill=(240, 236, 230))
    d.text((x, 205), "MASK", font=f2, fill=(196, 28, 34))
    d.rectangle([x + 4, 500, x + 120, 508], fill=(196, 28, 34))
    d.text((x + 2, 530), "TED BUNDY", font=font("sans_black", 56), fill=(240, 236, 230))
    d.text((x + 4, 600), "1946 – 1989", font=font("mono_bold", 30), fill=(160, 158, 154))
    # film grain + vignette for consistency with the documentary
    a = np.asarray(img, np.float32) / 255
    a *= (0.55 + 0.45 * np.clip(radial(TW, TH, TW / 2, TH / 2, TW * 0.8, TH * 1.0, 1.0) * 1.6, 0, 1))[..., None]
    a += np.random.default_rng(1).normal(0, 0.012, a.shape)
    out = to_img(a)
    OUT.mkdir(exist_ok=True)
    out.save(OUT / "ted_bundy_thumbnail.jpg", quality=95, subsampling=0)
    print("thumbnail:", kind)


if __name__ == "__main__":
    main()
