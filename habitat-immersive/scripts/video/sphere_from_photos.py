#!/usr/bin/env python3
"""
Panoràmica 360° equirectangular a partir de fotos fetes des del centre d'una estança
(p. ex. iPhone amb l'objectiu 0,5×: cantonades de dalt i de baix, sostre i terra).

Tot és local i gratuït (OpenCV, NumPy, SciPy):
1. Punts característics (SIFT) i aparellament de totes les fotos entre si.
2. Rotació relativa de cada parella a partir de l'homografia (H = K·R·K⁻¹).
3. Rotacions inicials amb un arbre d'expansió màxim i ajust global (mínims quadrats robustos)
   de totes les rotacions i de la distància focal.
4. Orientació: el sostre i el terra (o la mitjana dels «amunt» de les fotos) defineixen la vertical.
5. Projecció de cada foto a l'esfera, compensació d'exposició i barreja multibanda.
6. Les zones sense foto s'omplen amb una continuació difuminada (pano360.fill_gaps).

Ús: python3 sphere_from_photos.py <carpeta> <sortida.jpg> [--width 4096] [--focal35 13]
                                   [--low-priority 7,8] [--blur yaw0,pitch0,yaw1,pitch1 ...]
"""
import argparse
import json
import math
import os
import sys

import cv2
import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation

sys.path.insert(0, os.path.dirname(__file__))
from pano360 import coverage_limits, fill_gaps  # noqa: E402


def load(folder, scale):
    names = sorted(n for n in os.listdir(folder) if n.lower().endswith(('.jpg', '.jpeg', '.png')))
    imgs = []
    for n in names:
        im = cv2.imread(os.path.join(folder, n))
        imgs.append(cv2.resize(im, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA))
    return names, imgs


def intrinsics(w, h, focal35):
    # La focal equivalent de 35 mm es refereix a la diagonal (43,27 mm)
    f = focal35 / 43.27 * math.hypot(w, h)
    return np.array([[f, 0, w / 2], [0, f, h / 2], [0, 0, 1]], np.float64)


def pair_matches(imgs, K):
    sift = cv2.SIFT_create(nfeatures=4000)
    gray = [cv2.cvtColor(im, cv2.COLOR_BGR2GRAY) for im in imgs]
    kps = [sift.detectAndCompute(g, None) for g in gray]
    bf = cv2.BFMatcher(cv2.NORM_L2)
    Kinv = np.linalg.inv(K)
    pairs = {}
    for i in range(len(imgs)):
        for j in range(i + 1, len(imgs)):
            (ki, di), (kj, dj) = kps[i], kps[j]
            if di is None or dj is None:
                continue
            raw = bf.knnMatch(di, dj, k=2)
            good = [m for m, n in (r for r in raw if len(r) == 2) if m.distance < 0.75 * n.distance]
            if len(good) < 20:
                continue
            pi = np.float32([ki[m.queryIdx].pt for m in good])
            pj = np.float32([kj[m.trainIdx].pt for m in good])
            H, inl = cv2.findHomography(pi, pj, cv2.RANSAC, 0.015 * max(imgs[0].shape[:2]))
            if H is None:
                continue
            inl = inl.ravel().astype(bool)
            if inl.sum() < 20:
                continue
            # rotació relativa: H ≈ K R K⁻¹  ->  R ≈ K⁻¹ H K, ortonormalitzada
            R = Kinv @ H @ K
            U, _, Vt = np.linalg.svd(R)
            R = U @ np.diag([1, 1, np.linalg.det(U @ Vt)]) @ Vt
            pairs[(i, j)] = {'R': R, 'pi': pi[inl], 'pj': pj[inl], 'n': int(inl.sum())}
    return pairs


def initial_rotations(n, pairs):
    """Arbre d'expansió màxim (per nombre d'aparellaments) i encadenament de rotacions."""
    rots = [None] * n
    rots[0] = np.eye(3)
    edges = sorted(pairs.items(), key=lambda kv: -kv[1]['n'])
    changed = True
    while changed:
        changed = False
        for (i, j), p in edges:
            # p['R'] porta rajos de la càmera i a la càmera j: x_j = R x_i
            if rots[i] is not None and rots[j] is None:
                rots[j] = rots[i] @ p['R'].T
                changed = True
            elif rots[j] is not None and rots[i] is None:
                rots[i] = rots[j] @ p['R']
                changed = True
    return rots


def rays(pts, f, c):
    v = np.column_stack([(pts[:, 0] - c[0]) / f, (pts[:, 1] - c[1]) / f, np.ones(len(pts))])
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def refine(rots, pairs, K, idx):
    """Ajust global de les rotacions (càmera→món) amb focal fixa i pèrdua robusta (paral·laxi)."""
    order = [i for i in idx if i != idx[0]]
    c = (K[0, 2], K[1, 2])
    f = K[0, 0]
    x0 = np.concatenate([Rotation.from_matrix(rots[i]).as_rotvec() for i in order])
    pre = {k: (rays(p['pi'], f, c), rays(p['pj'], f, c)) for k, p in pairs.items()}

    def unpack(x):
        R = {idx[0]: rots[idx[0]]}
        for k, i in enumerate(order):
            R[i] = Rotation.from_rotvec(x[3 * k : 3 * k + 3]).as_matrix()
        return R

    def residual(x):
        R = unpack(x)
        out = []
        for (i, j), (ri, rj) in pre.items():
            if i in R and j in R:
                out.append(((ri @ R[i].T - rj @ R[j].T) * f).ravel())
        return np.concatenate(out)

    sol = least_squares(residual, x0, loss='soft_l1', f_scale=3.0, max_nfev=300)
    res = residual(sol.x)
    # error típic en píxels, robust (mediana) per no penalitzar la paral·laxi d'alguns objectes
    return unpack(sol.x), float(np.median(np.abs(res)))


def world_frame(R, low_priority):
    """Base del visor: Y amunt, X endavant (primera foto, horitzontal), Z a la dreta."""
    ups = np.array([R[i] @ np.array([0, -1, 0]) for i in R])
    up = ups.mean(axis=0)
    up /= np.linalg.norm(up)
    fwd = {i: R[i] @ np.array([0, 0, 1]) for i in R}
    # si hi ha una foto del sostre i una del terra, la vertical és la línia que les uneix
    ceil = max(fwd, key=lambda i: fwd[i] @ up)
    floor = min(fwd, key=lambda i: fwd[i] @ up)
    if fwd[ceil] @ up > 0.75 and fwd[floor] @ up < -0.75:
        v = fwd[ceil] - fwd[floor]
        up = v / np.linalg.norm(v)
    first = min(R)
    x = fwd[first] - (fwd[first] @ up) * up
    x /= np.linalg.norm(x)
    z = np.cross(x, up)
    return x, up, z


def render(imgs, R, f, c, frame, W, low_priority, masks=None):
    masks = masks or {}
    H = W // 2
    x, up, z = frame
    lon = (np.arange(W) + 0.5) / W * 2 * np.pi
    th = (np.arange(H) + 0.5) / H * np.pi
    lon, th = np.meshgrid(lon, th)
    d = np.stack([np.cos(lon) * np.sin(th), np.cos(th), np.sin(lon) * np.sin(th)], -1).astype(np.float32)
    world = d[..., 0:1] * x + d[..., 1:2] * up + d[..., 2:3] * z
    warped, weights = {}, {}
    for i, im in enumerate(imgs):
        if i not in R:
            continue
        cam = world @ R[i].astype(np.float32)  # = (R^T · ray) per a cada píxel
        zc = cam[..., 2]
        ok = zc > 0.15
        u = np.where(ok, f * cam[..., 0] / np.maximum(zc, 1e-6) + c[0], -1).astype(np.float32)
        v = np.where(ok, f * cam[..., 1] / np.maximum(zc, 1e-6) + c[1], -1).astype(np.float32)
        h, w = im.shape[:2]
        inside = ok & (u >= 0) & (u < w - 1) & (v >= 0) & (v < h - 1)
        warped[i] = cv2.remap(im, u, v, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        # pes: més alt al centre de la foto (vora suau)
        border = np.minimum(np.minimum(u, w - 1 - u) / w, np.minimum(v, h - 1 - v) / h)
        wgt = np.where(inside, np.clip(border * 4, 0, 1), 0).astype(np.float32)
        if i in low_priority:
            wgt *= 0.25
        for x0, y0, x1, y1 in masks.get(i, []):  # zones de la foto que no s'han de fer servir
            wgt[(u >= x0 * w) & (u < x1 * w) & (v >= y0 * h) & (v < y1 * h)] = 0
        weights[i] = wgt
    return warped, weights


def exposure_gains(warped, weights):
    """Guany per foto i canal perquè les zones compartides tinguin el mateix to."""
    ids = list(warped)
    small = {i: cv2.resize(warped[i], (512, 256), interpolation=cv2.INTER_AREA).astype(np.float32) + 1 for i in ids}
    wsm = {i: cv2.resize(weights[i], (512, 256), interpolation=cv2.INTER_AREA) for i in ids}
    rows, rhs = [], []
    for a in range(len(ids)):
        for b in range(a + 1, len(ids)):
            i, j = ids[a], ids[b]
            m = (wsm[i] > 0.05) & (wsm[j] > 0.05)
            if m.sum() < 200:
                continue
            for ch in range(3):
                r = np.zeros(len(ids) * 3)
                r[a * 3 + ch], r[b * 3 + ch] = 1, -1
                rows.append(r * math.sqrt(m.sum()))
                rhs.append(math.log(small[j][..., ch][m].mean() / small[i][..., ch][m].mean()) * math.sqrt(m.sum()))
    for k in range(len(ids) * 3):  # regularització: guanys propers a 1
        r = np.zeros(len(ids) * 3)
        r[k] = 1
        rows.append(r * 30)
        rhs.append(0)
    g = np.linalg.lstsq(np.array(rows), np.array(rhs), rcond=None)[0]
    return {i: np.exp(g[a * 3 : a * 3 + 3]) for a, i in enumerate(ids)}


def blend(warped, weights, gains, W):
    H = W // 2
    ids = list(warped)
    stack = np.stack([weights[i] for i in ids])
    best = stack.argmax(0)
    covered = stack.max(0) > 0
    blender = cv2.detail_MultiBandBlender()
    blender.setNumBands(6)
    blender.prepare((0, 0, W, H))
    for k, i in enumerate(ids):
        mask = ((best == k) & covered).astype(np.uint8) * 255
        if not mask.any():
            continue
        img = np.clip(warped[i].astype(np.float32) * gains[i], 0, 255).astype(np.int16)
        blender.feed(img, mask, (0, 0))
    out, _ = blender.blend(None, None)
    return np.clip(out, 0, 255).astype(np.uint8), (covered * 255).astype(np.uint8)


def fill_holes(img, cover):
    """Forats interiors (zones entre fotos sense cobrir): continuació suau dels colors de les vores.

    No s'hi inventen objectes: és un degradat difuminat, que es marca com a zona reconstruïda."""
    H, W = cover.shape
    known = cover > 0
    # forats = zones desconegudes que no toquen ni el pol nord ni el sud
    n, lab = cv2.connectedComponents((~known).astype(np.uint8), connectivity=4)
    holes = np.zeros_like(known)
    for k in range(1, n):
        comp = lab == k
        if not comp[0].any() and not comp[-1].any():
            holes |= comp
    if not holes.any():
        return img, cover
    s = 1024 / W
    small = cv2.resize(img, (1024, 512), interpolation=cv2.INTER_AREA)
    hm = cv2.resize(holes.astype(np.uint8) * 255, (1024, 512), interpolation=cv2.INTER_NEAREST)
    hm = cv2.dilate(hm, np.ones((5, 5), np.uint8))
    filled = cv2.inpaint(small, hm, 12, cv2.INPAINT_TELEA)
    filled = cv2.GaussianBlur(filled, (0, 0), 6)
    big = cv2.resize(filled, (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32)
    soft = cv2.GaussianBlur(holes.astype(np.float32), (0, 0), W / 220)[..., None]
    soft = np.maximum(soft, holes[..., None].astype(np.float32))
    out = img.astype(np.float32) * (1 - soft) + big * soft
    cover = cover.copy()
    cover[holes] = 255
    return np.clip(out, 0, 255).astype(np.uint8), cover


def blur_boxes(img, boxes):
    """Difumina rectangles donats en (yaw0, pitch0, yaw1, pitch1) graus, convenció del visor."""
    H, W = img.shape[:2]
    for y0, p0, y1, p1 in boxes:
        x0, x1 = int(y0 / 360 * W), int(y1 / 360 * W)
        r0, r1 = int((90 - p1) / 180 * H), int((90 - p0) / 180 * H)
        roi = img[r0:r1, x0:x1]
        if roi.size:
            img[r0:r1, x0:x1] = cv2.GaussianBlur(roi, (0, 0), max(6, (x1 - x0) / 6))
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('folder')
    ap.add_argument('out')
    ap.add_argument('--width', type=int, default=4096)
    ap.add_argument('--focal35', type=float, default=13.0)
    ap.add_argument('--scale', type=float, default=0.5)
    ap.add_argument('--low-priority', default='')
    ap.add_argument('--blur', nargs='*', default=[])
    ap.add_argument('--mask', nargs='*', default=[], help='foto:x0,y0,x1,y1 en fraccions (p. ex. persones o reflexos)')
    ap.add_argument('--privacy', nargs='*', default=[], help='foto:x0,y0,x1,y1 en fraccions: es difumina a la foto abans de projectar-la')
    a = ap.parse_args()
    names, imgs = load(a.folder, a.scale)
    privacy = []
    for m in a.privacy:
        k, box = m.split(':')
        x0, y0, x1, y1 = (float(v) for v in box.split(','))
        privacy.append((int(k), x0, y0, x1, y1))
    feat_scale = min(1.0, 1400 / max(imgs[0].shape[:2]))
    small = [cv2.resize(im, None, fx=feat_scale, fy=feat_scale, interpolation=cv2.INTER_AREA) for im in imgs]
    h, w = small[0].shape[:2]
    Ks = intrinsics(w, h, a.focal35)
    best = None
    # La focal real de l'objectiu 0,5× varia una mica segons el retall: es prova un rang i es
    # queda la que fa encaixar millor totes les fotos.
    for focal35 in (12.0, 12.5, 13.0, 13.5, 14.0, 14.5, 15.0):
        Ks = intrinsics(w, h, focal35)
        pairs = pair_matches(small, Ks)
        rots = initial_rotations(len(imgs), pairs)
        idx = [i for i, r in enumerate(rots) if r is not None]
        if len(idx) < 2:
            continue
        R, err = refine(rots, pairs, Ks, idx)
        print(f'  focal {focal35} mm: {len(idx)} fotos, {len(pairs)} parelles, error {err:.2f} px', file=sys.stderr)
        if best is None or (len(idx), -err) > (best[0], -best[1]):
            best = (len(idx), err, focal35, R, Ks, pairs)
    _, rms, focal_used, R, Ks, pairs = best
    f = Ks[0, 0] / feat_scale
    idx = list(R)
    # La privacitat s'aplica després d'aparellar (no afecta l'alineació) i abans de projectar
    for k, x0, y0, x1, y1 in privacy:
        im = imgs[k]
        hh, ww = im.shape[:2]
        r = im[int(y0 * hh) : int(y1 * hh), int(x0 * ww) : int(x1 * ww)]
        if r.size:
            im[int(y0 * hh) : int(y1 * hh), int(x0 * ww) : int(x1 * ww)] = cv2.GaussianBlur(r, (0, 0), max(8, r.shape[1] / 5))
    H0, W0 = imgs[0].shape[:2]
    c = (W0 / 2, H0 / 2)
    low = {int(x) for x in a.low_priority.split(',') if x}
    frame = world_frame(R, low)
    masks = {}
    for m in a.mask:
        k, box = m.split(':')
        masks.setdefault(int(k), []).append(tuple(float(v) for v in box.split(',')))
    warped, weights = render(imgs, R, f, c, frame, a.width, low, masks)
    gains = exposure_gains(warped, weights)
    pano, cover = blend(warped, weights, gains, a.width)
    pano, cover = fill_holes(pano, cover)
    pano = fill_gaps(pano, cover)
    if a.blur:
        pano = blur_boxes(pano, [tuple(float(v) for v in b.split(',')) for b in a.blur])
    cv2.imwrite(a.out, pano, [cv2.IMWRITE_JPEG_QUALITY, 87, cv2.IMWRITE_JPEG_PROGRESSIVE, 1])
    info = {
        'photos': len(idx),
        'unused': [names[i] for i in range(len(imgs)) if i not in R],
        'pairs': len(pairs),
        'focal35': focal_used,
        'medianErrorPx': round(rms / feat_scale, 2),
        'coverage': round(float((cover > 0).mean()), 3),
        'horizontalDegrees': round(float((cover.max(axis=0) > 0).mean() * 360)),
        **coverage_limits(cover),
    }
    print(json.dumps(info))


if __name__ == '__main__':
    main()
