#!/usr/bin/env python3
"""Fotos «normals» (perspectiva) extretes d'una panoràmica equirectangular.

  python3 views_from_pano.py <pano.jpg> <carpeta> nom:yaw:pitch:hfov [...]

Genera <nom>.jpg (1600×1067) i <nom>-sm.jpg (800×534). yaw/pitch en graus amb la convenció del visor.
"""
import math
import os
import sys

import cv2
import numpy as np


def view(pano, yaw, pitch, hfov, w=1600, h=1067):
    H, W = pano.shape[:2]
    f = (w / 2) / math.tan(math.radians(hfov) / 2)
    xs, ys = np.meshgrid(np.arange(w) - w / 2 + 0.5, np.arange(h) - h / 2 + 0.5)
    # càmera: endavant (yaw, pitch), dreta, amunt
    y, p = math.radians(yaw), math.radians(pitch)
    fwd = np.array([math.cos(p) * math.cos(y), math.sin(p), math.cos(p) * math.sin(y)])
    right = np.cross(fwd, [0, 1, 0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    d = fwd * f + xs[..., None] * right - ys[..., None] * up
    d /= np.linalg.norm(d, axis=-1, keepdims=True)
    lon = np.mod(np.arctan2(d[..., 2], d[..., 0]), 2 * np.pi)
    lat = np.arcsin(np.clip(d[..., 1], -1, 1))
    mx = (lon / (2 * np.pi) * W - 0.5).astype(np.float32)
    my = ((0.5 - lat / np.pi) * H - 0.5).astype(np.float32)
    return cv2.remap(pano, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_WRAP)


def main():
    pano = cv2.imread(sys.argv[1])
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for spec in sys.argv[3:]:
        name, yaw, pitch, hfov = spec.split(':')
        im = view(pano, float(yaw), float(pitch), float(hfov))
        cv2.imwrite(os.path.join(out, f'{name}.jpg'), im, [cv2.IMWRITE_JPEG_QUALITY, 85, cv2.IMWRITE_JPEG_PROGRESSIVE, 1])
        cv2.imwrite(os.path.join(out, f'{name}-sm.jpg'), cv2.resize(im, (800, 534), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 80])
        print('✓', name)


if __name__ == '__main__':
    main()
