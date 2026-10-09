#!/usr/bin/env python3
"""
Recreació aproximada d'una panoràmica 360° (equirectangular 2:1) a partir dels fotogrames
d'un vídeo on la càmera gira dins d'una estança.

Mètode (OpenCV, tot local):
1. Tria fotogrames nítids del tram indicat, espaiats perquè se solapin.
2. Detecta i aparella punts característics (SIFT) entre fotogrames.
3. Estima la rotació de la càmera de cada fotograma (model de rotació pura) i l'afina
   amb un ajust de feixos; redreça l'horitzó (wave correction).
4. Projecta cada fotograma sobre una esfera amb el projector esfèric d'OpenCV. Amb escala s,
   la coordenada u = s·longitud i v = s·colatitud: és directament la projecció
   equirectangular, de manera que cada fotograma es col·loca al lloc que li correspon.
5. Barreja els fotogrames (multibanda) i genera una màscara de cobertura.
6. Les zones que el vídeo no va gravar s'omplen amb una continuació molt difuminada dels
   colors veïns i es marquen a la màscara: no s'inventen detalls.

Ús:  python3 pano360.py <vídeo> <inici> <final> <sortida.jpg> [--step 0.3] [--exclude a-b,c-d]
"""
import argparse
import json
import math
import os
import subprocess
import tempfile

import cv2
import numpy as np


def extract(video, t0, t1, fps, tmp):
    d = tempfile.mkdtemp(dir=tmp)
    subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t0}', '-to', f'{t1}', '-i', video, '-vf', f'fps={fps}', '-q:v', '2', os.path.join(d, '%04d.jpg')], check=True)
    files = sorted(os.listdir(d))
    return [(t0 + i / fps, os.path.join(d, f)) for i, f in enumerate(files)]


def sharp(img):
    return cv2.Laplacian(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()


def select_frames(cands, step, min_sharp, exclude):
    """Agafa el fotograma més nítid de cada finestra de `step` segons."""
    out = []
    t = cands[0][0]
    end = cands[-1][0]
    while t <= end:
        win = [(s, tt, im) for tt, f in cands if t <= tt < t + step and not any(a <= tt <= b for a, b in exclude) for im in [cv2.imread(f)] for s in [sharp(im)]]
        if win:
            s, tt, im = max(win, key=lambda x: x[0])
            if s >= min_sharp:
                out.append((tt, im))
        t += step
    return out


def build(frames, work_megapix=0.45, compose_scale=1.0):
    imgs = [im for _, im in frames]
    h0, w0 = imgs[0].shape[:2]
    work_scale = min(1.0, math.sqrt(work_megapix * 1e6 / (h0 * w0)))
    finder = cv2.SIFT_create(nfeatures=2500)
    feats, small = [], []
    for im in imgs:
        sm = cv2.resize(im, None, fx=work_scale, fy=work_scale, interpolation=cv2.INTER_AREA)
        small.append(sm)
        feats.append(cv2.detail.computeImageFeatures2(finder, sm))
    matcher = cv2.detail_BestOf2NearestRangeMatcher(range_width=6, try_use_gpu=False, match_conf=0.3)
    matches = matcher.apply2(feats)
    matcher.collectGarbage()
    keep = cv2.detail.leaveBiggestComponent(feats, matches, 0.6)
    keep = [int(i) for i in np.array(keep).flatten()]
    feats = [feats[i] for i in keep]
    imgs = [imgs[i] for i in keep]
    small = [small[i] for i in keep]
    frames = [frames[i] for i in keep]
    matches = matcher.apply2(feats)
    if len(imgs) < 3:
        raise RuntimeError('massa pocs fotogrames connectats')

    est = cv2.detail_HomographyBasedEstimator()
    ok, cams = est.apply(feats, matches, None)
    if not ok:
        raise RuntimeError('no s’han pogut estimar les càmeres')
    for c in cams:
        c.R = c.R.astype(np.float32)
    refine = np.zeros((3, 3), np.uint8)
    refine[0, 0] = refine[0, 1] = refine[0, 2] = refine[1, 1] = refine[1, 2] = 1
    def fresh():
        _, cs = est.apply(feats, matches, None)
        for c in cs:
            c.R = c.R.astype(np.float32)
        return cs

    refined = None
    # Si l'ajust de feixos no convergeix (vídeo mogut), es prova un ajust més tolerant i,
    # en últim cas, es fan servir directament les rotacions estimades.
    for make, conf in ((cv2.detail_BundleAdjusterRay, 0.6), (cv2.detail_BundleAdjusterRay, 0.35), (cv2.detail_BundleAdjusterReproj, 0.35)):
        adj = make()
        adj.setConfThresh(conf)
        adj.setRefinementMask(refine)
        ok, out = adj.apply(feats, matches, fresh())
        if ok and all(np.isfinite(c.R).all() and c.focal > 0 for c in out):
            refined = out
            break
    if refined is None:
        print('  (avís: sense ajust de feixos; s’usen les rotacions inicials)')
        refined = fresh()
    cams = refined
    rmats = [np.copy(c.R) for c in cams]
    rmats = cv2.detail.waveCorrect(rmats, cv2.detail.WAVE_CORRECT_HORIZ)
    for c, r in zip(cams, rmats):
        c.R = r

    focals = sorted(c.focal for c in cams)
    f_work = focals[len(focals) // 2]
    # escala de composició a resolució completa
    scale_full = 1.0 / work_scale
    f_full = f_work * scale_full * compose_scale
    warper = cv2.PyRotationWarper('spherical', f_full)

    # Protecció: si l'estimació ha divergit, la projecció es fa gegant i no té sentit
    def full_K(c):
        K = c.K().astype(np.float32)
        K[0, 0] *= scale_full * compose_scale
        K[0, 2] *= scale_full * compose_scale
        K[1, 1] *= scale_full * compose_scale
        K[1, 2] *= scale_full * compose_scale
        return K

    rois = [warper.warpRoi((im.shape[1], im.shape[0]), full_K(c), c.R) for c, im in zip(cams, imgs)]
    x0 = min(r[0] for r in rois)
    y0 = min(r[1] for r in rois)
    x1 = max(r[0] + r[2] for r in rois)
    y1 = max(r[1] + r[3] for r in rois)
    if x1 - x0 > 2.05 * math.pi * f_full or y1 - y0 > 1.02 * math.pi * f_full:
        raise RuntimeError('estimació divergent: la projecció surt de l’esfera')

    warped, masks, corners, sizes = [], [], [], []
    for c, im in zip(cams, imgs):
        K = c.K().astype(np.float32)
        K[0, 0] *= scale_full * compose_scale
        K[0, 2] *= scale_full * compose_scale
        K[1, 1] *= scale_full * compose_scale
        K[1, 2] *= scale_full * compose_scale
        imc = cv2.resize(im, None, fx=compose_scale, fy=compose_scale) if compose_scale != 1 else im
        corner, wimg = warper.warp(imc, K, c.R, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)
        m = np.full(imc.shape[:2], 255, np.uint8)
        # vora interior per amagar costures
        m = cv2.erode(m, np.ones((9, 9), np.uint8))
        _, wmask = warper.warp(m, K, c.R, cv2.INTER_NEAREST, cv2.BORDER_CONSTANT)
        warped.append(wimg)
        masks.append(wmask)
        corners.append(corner)
        sizes.append((wimg.shape[1], wimg.shape[0]))

    comp = cv2.detail.ExposureCompensator_createDefault(cv2.detail.ExposureCompensator_GAIN_BLOCKS)
    comp.feed(corners=corners, images=warped, masks=masks)
    for i in range(len(warped)):
        comp.apply(i, corners[i], warped[i], masks[i])

    seam = cv2.detail_GraphCutSeamFinder('COST_COLOR')
    wf = [w.astype(np.float32) for w in warped]
    masks = seam.find(wf, corners, masks)

    blender = cv2.detail_MultiBandBlender()
    blender.setNumBands(5)
    dst = cv2.detail.resultRoi(corners=corners, sizes=sizes)
    blender.prepare(dst)
    for w, m, c in zip(warped, masks, corners):
        blender.feed(w.astype(np.int16), m, c)
    pano, pmask = blender.blend(None, None)
    pano = np.clip(pano, 0, 255).astype(np.uint8)
    return pano, pmask, dst, f_full, frames


def to_equirect(pano, pmask, dst, s, width):
    """Col·loca el resultat a la seva posició dins del llenç equirectangular complet."""
    W = int(round(2 * math.pi * s))
    H = W // 2
    canvas = np.zeros((H, W, 3), np.uint8)
    cover = np.zeros((H, W), np.uint8)
    x0, y0 = dst[0], dst[1]
    # u del projector esfèric va de -π·s a π·s; v de 0 a π·s
    ox = int(round(x0 + math.pi * s))
    oy = int(round(y0))
    ph, pw = pano.shape[:2]
    for k in range(-1, 2):  # embolcalla horitzontalment
        xa = ox + k * W
        xs0, xs1 = max(0, xa), min(W, xa + pw)
        ys0, ys1 = max(0, oy), min(H, oy + ph)
        if xs1 <= xs0 or ys1 <= ys0:
            continue
        sub = pano[ys0 - oy : ys1 - oy, xs0 - xa : xs1 - xa]
        sm = pmask[ys0 - oy : ys1 - oy, xs0 - xa : xs1 - xa] > 0
        canvas[ys0:ys1, xs0:xs1][sm] = sub[sm]
        cover[ys0:ys1, xs0:xs1][sm] = 255
    canvas = cv2.resize(canvas, (width, width // 2), interpolation=cv2.INTER_AREA)
    cover = cv2.resize(cover, (width, width // 2), interpolation=cv2.INTER_NEAREST)
    return canvas, cover


def fill_gaps(img, cover):
    """Omple les zones no gravades amb una continuació molt suau dels colors veïns."""
    h, w = cover.shape
    known = cover > 0
    if known.all():
        return img
    # 1) Continuació vertical: cada columna gravada allarga cap amunt el color de la seva vora
    #    superior (cel o sostre) i cap avall el de la inferior (terra), amb una mitjana d'una franja.
    base = img.astype(np.float32).copy()
    ext = known.copy()
    band = max(4, h // 60)
    cols = np.where(known.any(axis=0))[0]
    for x in cols:
        ys = np.where(known[:, x])[0]
        top, bot = ys[0], ys[-1]
        base[:top, x] = base[top : top + band, x].mean(axis=0)
        base[bot + 1 :, x] = base[max(bot - band, top) : bot + 1, x].mean(axis=0)
        ext[:, x] = True
    # 2) Columnes no gravades: interpolació circular entre les vores esquerra i dreta
    if len(cols) and len(cols) < w:
        known_cols = np.zeros(w, bool)
        known_cols[cols] = True
        idx = np.arange(w)
        for x in idx[~known_cols]:
            dl = next(d for d in range(1, w) if known_cols[(x - d) % w])
            dr = next(d for d in range(1, w) if known_cols[(x + d) % w])
            t = dl / (dl + dr)
            base[:, x] = base[:, (x - dl) % w] * (1 - t) + base[:, (x + dr) % w] * t
        ext[:] = True
    acc = base * ext[..., None]
    known_ext = ext
    wgt = known_ext.astype(np.float32)
    levels = []
    a, m = acc, wgt
    while min(a.shape[:2]) > 4:
        levels.append((a, m))
        a = cv2.pyrDown(a)
        m = cv2.pyrDown(m)
    fill = a / np.maximum(m[..., None], 1e-4)
    for a, m in reversed(levels):
        up = cv2.resize(fill, (a.shape[1], a.shape[0]), interpolation=cv2.INTER_LINEAR)
        cur = a / np.maximum(m[..., None], 1e-4)
        alpha = np.clip(m * 4, 0, 1)[..., None]
        fill = cur * alpha + up * (1 - alpha)
    # desenfocament fort i circular (la panoràmica dona la volta): només ambient, sense detall
    pad = w // 4
    wrapped = cv2.copyMakeBorder(fill, 0, 0, pad, pad, cv2.BORDER_WRAP)
    wrapped = cv2.GaussianBlur(wrapped, (0, 0), w / 28)
    fill = cv2.GaussianBlur(wrapped, (0, 0), w / 28)[:, pad:-pad]
    # transició suau entre gravat i reconstruït
    soft = cv2.GaussianBlur(known.astype(np.float32), (0, 0), w / 400)[..., None]
    soft = np.where(known[..., None], np.maximum(soft, 0.85), soft * 0.85)
    out = img.astype(np.float32) * soft + fill * (1 - soft)
    # lleuger enfosquiment de les zones reconstruïdes perquè es distingeixin
    out = out * (0.86 + 0.14 * soft)
    return np.clip(out, 0, 255).astype(np.uint8)


def coverage_limits(cover):
    """Rang de yaw i pitch (graus, convenció del visor) que cobreix la zona gravada."""
    h, w = cover.shape
    cols = cover.max(axis=0) > 0
    # el buit circular més gran de columnes no gravades marca on comença i acaba la zona
    best, start = (0, 0), None
    ext = np.concatenate([cols, cols])
    run = 0
    for i, c in enumerate(ext):
        run = 0 if c else run + 1
        if run > best[0] and run <= w:
            best = (run, i)
    gap_len, gap_end = best
    first = (gap_end + 1) % w
    span = w - gap_len
    yaw0 = first / w * 360
    yaw1 = yaw0 + span / w * 360
    # pitch: files cobertes per almenys el 25 % de les columnes gravades
    rows = (cover > 0).sum(axis=1) >= 0.25 * cols.sum()
    ys = np.where(rows)[0]
    pitch_top = 90 - ys[0] / h * 180
    pitch_bot = 90 - ys[-1] / h * 180
    return {'yaw': [round(yaw0, 1), round(yaw1, 1)], 'pitch': [round(pitch_bot, 1), round(pitch_top, 1)]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video')
    ap.add_argument('t0', type=float)
    ap.add_argument('t1', type=float)
    ap.add_argument('out')
    ap.add_argument('--step', type=float, default=0.3)
    ap.add_argument('--min-sharp', type=float, default=12)
    ap.add_argument('--exclude', default='')
    ap.add_argument('--width', type=int, default=4096)
    a = ap.parse_args()
    exclude = [tuple(float(x) for x in r.split('-')) for r in a.exclude.split(',') if r]
    tmp = tempfile.mkdtemp(prefix='pano-')
    cands = extract(a.video, a.t0, a.t1, 10, tmp)
    frames = select_frames(cands, a.step, a.min_sharp, exclude)
    pano, pmask, dst, s, used = build(frames)
    eq, cover = to_equirect(pano, pmask, dst, s, a.width)
    filled = fill_gaps(eq, cover)
    cv2.imwrite(a.out, filled, [cv2.IMWRITE_JPEG_QUALITY, 86, cv2.IMWRITE_JPEG_PROGRESSIVE, 1])
    cv2.imwrite(a.out.replace('.jpg', '-cover.png'), cover)
    cov = float((cover > 0).mean())
    lon = float((cover.max(axis=0) > 0).mean() * 360)
    info = {'frames': len(used), 'times': [round(t, 2) for t, _ in used], 'coverage': round(cov, 3), 'horizontalDegrees': round(lon), **coverage_limits(cover)}
    json.dump(info, open(a.out.replace('.jpg', '.json'), 'w'))
    print(json.dumps(info))


if __name__ == '__main__':
    main()
