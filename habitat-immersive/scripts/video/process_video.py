#!/usr/bin/env python3
"""
Tractament local del vídeo d'una propietat real (FFmpeg + OpenCV, tot gratuït i local).

  python3 scripts/video/process_video.py scripts/video/casa-real.config.json

- No modifica mai el vídeo original: només el llegeix.
- Per a cada vista del recorregut tria el fotograma més nítid dins de la finestra de temps
  indicada i evita fotogrames gairebé idèntics (hash perceptual).
- Ajusta lleugerament la imatge (contrast local, brillantor en escenes fosques i nitidesa suau).
- Genera imatges optimitzades (alta i miniatura), un vídeo de recorregut editat sense àudio
  i un JSON de dades que la web importa (src/data/<id>.generated.json).

Requisits: ffmpeg/ffprobe al PATH, Python 3 amb opencv-python-headless i numpy.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

import cv2
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def probe(path):
    out = subprocess.run(
        ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:stream_side_data=rotation:format=duration', '-of', 'json', path],
        check=True, capture_output=True, text=True,
    ).stdout
    data = json.loads(out)
    st = data['streams'][0]
    rot = 0
    for sd in st.get('side_data_list', []) or []:
        rot = int(sd.get('rotation', 0))
    w, h = st['width'], st['height']
    if abs(rot) == 90:
        w, h = h, w
    num, den = st['r_frame_rate'].split('/')
    return {'width': w, 'height': h, 'fps': round(float(num) / float(den), 2), 'duration': round(float(data['format']['duration']), 2), 'rotation': rot}


def sharpness(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(g, cv2.CV_64F).var())


def dhash(img, size=8):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, (size + 1, size), interpolation=cv2.INTER_AREA)
    return (g[:, 1:] > g[:, :-1]).flatten()


def enhance(img):
    """Millora suau: contrast local (CLAHE), brillantor en escenes fosques i nitidesa lleugera."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    mean = l.mean()
    if mean < 95:  # escena fosca (p. ex. la cuina): corba gamma per aixecar ombres
        gamma = np.interp(mean, [30, 95], [0.7, 0.95])
        lut = np.array([((i / 255.0) ** gamma) * 255 for i in range(256)]).astype('uint8')
        l = cv2.LUT(l, lut)
    l = cv2.createCLAHE(clipLimit=1.15, tileGridSize=(6, 6)).apply(l)
    out = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    blur = cv2.GaussianBlur(out, (0, 0), 1.0)
    return cv2.addWeighted(out, 1.18, blur, -0.18, 0)


def blur_regions(img, regions):
    h, w = img.shape[:2]
    for x, y, rw, rh in regions:
        x0, y0, x1, y1 = int(x * w), int(y * h), int((x + rw) * w), int((y + rh) * h)
        roi = img[y0:y1, x0:x1]
        if roi.size:
            img[y0:y1, x0:x1] = cv2.GaussianBlur(roi, (0, 0), 18)
    return img


def frames_in_window(src, t0, t1, tmp):
    d = tempfile.mkdtemp(dir=tmp)
    run(['ffmpeg', '-v', 'error', '-ss', f'{t0:.3f}', '-i', src, '-t', f'{t1 - t0:.3f}', '-q:v', '1', os.path.join(d, '%04d.png')])
    files = sorted(os.listdir(d))
    span = (t1 - t0) / max(1, len(files))
    return [(t0 + i * span, os.path.join(d, f)) for i, f in enumerate(files)]


def save_jpg(img, path, height, quality):
    h, w = img.shape[:2]
    if h > height:
        img = cv2.resize(img, (round(w * height / h), height), interpolation=cv2.INTER_AREA)
    cv2.imwrite(path, img, [cv2.IMWRITE_JPEG_QUALITY, quality, cv2.IMWRITE_JPEG_PROGRESSIVE, 1, cv2.IMWRITE_JPEG_OPTIMIZE, 1])
    return img.shape[1], img.shape[0]


def build_clip(src, clip, out_path, tmp):
    """Codifica cada tram segur per separat i els uneix en un MP4 lleuger sense àudio. Retorna els capítols."""
    labels, t, parts = [], 0.0, []
    for ch in clip['chapters']:
        labels.append({'stop': ch['stop'], 'label': ch['label'], 'start': round(t, 2)})
        for a, b in ch['segments']:
            seg = os.path.join(tmp, f'seg{len(parts):02d}.mp4')
            run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{a}', '-to', f'{b}', '-i', src, '-an', '-vf', f"scale={clip['width']}:-2,fps=30,format=yuv420p",
                 '-c:v', 'libx264', '-preset', 'slow', '-crf', str(clip['crf']), '-profile:v', 'main', '-g', '30', seg])
            parts.append(seg)
            t += b - a
    lst = os.path.join(tmp, 'parts.txt')
    with open(lst, 'w') as f:
        f.writelines(f"file '{p}'\n" for p in parts)
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', out_path])
    # Versió WebM (VP9) per als navegadors sense H.264 (p. ex. Chromium de codi obert)
    run(['ffmpeg', '-v', 'error', '-y', '-i', out_path, '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', out_path[:-4] + '.webm'])
    return labels, round(t, 2)


def main(cfg_path):
    cfg = json.load(open(cfg_path))
    src = os.path.join(ROOT, cfg['source'])
    if not os.path.exists(src):
        sys.exit(f"No trobo el vídeo original a {src}. Copia'l a aquesta ruta (no es modificarà).")
    info = probe(src)
    out = os.path.join(ROOT, cfg['output'])
    if os.path.isdir(os.path.join(out, 'frames')):
        shutil.rmtree(os.path.join(out, 'frames'))
    os.makedirs(os.path.join(out, 'frames'), exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='casa-real-')
    web_base = '/' + cfg['output'].replace('public/', '', 1)
    hashes = []
    stops = []
    try:
        for stop in cfg['stops']:
            views = []
            for v in stop['views']:
                cands = []
                for t, f in frames_in_window(src, v['from'], v['to'], tmp):
                    img = cv2.imread(f)
                    cands.append((sharpness(img), t, img))
                cands.sort(key=lambda c: -c[0])
                chosen = None
                for s, t, img in cands:
                    h = dhash(img)
                    if all(np.count_nonzero(h != o) > 6 for o in hashes):
                        chosen = (s, t, img, h)
                        break
                if chosen is None:
                    print(f"  · {stop['id']}/{v['id']}: tots els fotogrames són gairebé idèntics a vistes ja triades; s'omet")
                    continue
                s, t, img, h = chosen
                hashes.append(h)
                img = enhance(img)
                if v.get('blur'):
                    img = blur_regions(img, v['blur'])
                name = f"{stop['id']}-{v['id']}"
                w, hh = save_jpg(img, os.path.join(out, 'frames', f'{name}.jpg'), cfg['frameHeight'], 84)
                save_jpg(img, os.path.join(out, 'frames', f'{name}-sm.jpg'), cfg['thumbHeight'], 80)
                views.append({'id': v['id'], 'label': v['label'], 'src': f'{web_base}/frames/{name}', 'time': round(t, 2), 'sharpness': round(s, 1), 'width': w, 'height': hh})
                print(f"  ✓ {name}: t={t:.2f}s nitidesa={s:.1f}")
            stops.append({'id': stop['id'], 'name': stop['name'], 'views': views})

        clip_path = os.path.join(out, 'recorregut.mp4')
        chapters, clip_dur = build_clip(src, cfg['clip'], clip_path, tmp)
        first = stops[0]['views'][0]
        shutil.copy(os.path.join(ROOT, 'public' + first['src'] + '.jpg'), os.path.join(out, 'recorregut-poster.jpg'))
        print(f"  ✓ recorregut.mp4: {clip_dur}s, {os.path.getsize(clip_path) / 1e6:.1f} MB, sense àudio")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    data = {
        'id': cfg['id'],
        'source': {k: info[k] for k in ('width', 'height', 'fps', 'duration')},
        'stops': stops,
        'clip': {'src': f'{web_base}/recorregut.mp4', 'webm': f'{web_base}/recorregut.webm', 'poster': f'{web_base}/recorregut-poster.jpg', 'duration': clip_dur, 'chapters': chapters},
    }
    data_path = os.path.join(ROOT, 'src', 'data', f"{cfg['id']}.generated.json")
    json.dump(data, open(data_path, 'w'), ensure_ascii=False, indent=2)
    print('Escrit', os.path.relpath(data_path, ROOT))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'scripts', 'video', 'casa-real.config.json'))
