#!/usr/bin/env python3
"""Genera les panoràmiques 360° aproximades de la casa real i les deixa a public/.

  python3 scripts/video/build_panos.py

Cada entrada indica el tram del vídeo on la càmera gira dins de l'espai i els moments a excloure
(desenfocats o amb dades personals). Els trams que no aconsegueixen una reconstrucció coherent
(sala sencera, entrada, dormitori) no s'hi inclouen: la web mostra els fotogrames reals.
"""
import json
import os
import subprocess
import sys

import cv2

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
VIDEO = os.path.join(ROOT, 'media-source', 'casa-real', 'original.mp4')
OUT = os.path.join(ROOT, 'public', 'media', 'real', 'casa-real', 'pano')
PANOS = [
    {'stop': 'terrassa', 'from': 33.8, 'to': 42.6, 'args': []},
    {'stop': 'cuina', 'from': 52.8, 'to': 62.6, 'args': ['--exclude', '55.6-58.2', '--min-sharp', '6'], 'label': 'Pas del menjador a la cuina'},
    {'stop': 'sala', 'from': 23.0, 'to': 24.4, 'args': ['--step', '0.15'], 'label': 'Finestral de la sala'},
]


def main():
    os.makedirs(OUT, exist_ok=True)
    result = {}
    for p in PANOS:
        out = os.path.join(OUT, f"{p['stop']}.jpg")
        cmd = [sys.executable, os.path.join(os.path.dirname(__file__), 'pano360.py'), VIDEO, str(p['from']), str(p['to']), out, '--width', '4096', *p['args']]
        r = subprocess.run(cmd, capture_output=True, text=True)
        line = [l for l in r.stdout.splitlines() if l.startswith('{')]
        if r.returncode or not line:
            print(f"  ✗ {p['stop']}: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else 'error'}")
            continue
        info = json.loads(line[-1])
        img = cv2.imread(out)
        cv2.imwrite(out.replace('.jpg', '-preview.jpg'), cv2.resize(img, (1024, 512), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 80])
        os.remove(out.replace('.jpg', '-cover.png'))
        os.remove(out.replace('.jpg', '.json'))
        web = '/media/real/casa-real/pano/' + p['stop']
        result[p['stop']] = {'full': web + '.jpg', 'preview': web + '-preview.jpg', 'label': p.get('label'), **{k: info[k] for k in ('frames', 'coverage', 'horizontalDegrees', 'yaw', 'pitch')}}
        print(f"  ✓ {p['stop']}: {info['horizontalDegrees']}° horitzontals, {info['frames']} fotogrames, cobertura {info['coverage'] * 100:.0f} %")
    path = os.path.join(ROOT, 'src', 'data', 'casa-real.panos.json')
    json.dump(result, open(path, 'w'), ensure_ascii=False, indent=2)
    print('Escrit', os.path.relpath(path, ROOT))


if __name__ == '__main__':
    main()
