"""Short-term loudness profile: python loudness_scan.py <wav> [win_s]"""
import sys, json, numpy as np, soundfile as sf, pyloudnorm as pyln
from common import BUILD, load_json
x, sr = sf.read(sys.argv[1], dtype="float32")
win = float(sys.argv[2]) if len(sys.argv) > 2 else 3.0
m = pyln.Meter(sr)
VT = load_json(BUILD / "voice_timing.json")
vals = []
for i in range(0, len(x) - int(win * sr), int(win * sr)):
    seg = x[i:i + int(win * sr)]
    try:
        vals.append(m.integrated_loudness(seg))
    except Exception:
        vals.append(-70)
v = np.array(vals); v = v[v > -60]
print(f"short-term ({win}s) LUFS: median {np.median(v):.1f}  p5 {np.percentile(v,5):.1f}  p95 {np.percentile(v,95):.1f}  spread(p95-p5) {np.percentile(v,95)-np.percentile(v,5):.1f} LU")
# per narration line loudness
ll = []
for l in VT["lines"]:
    seg = x[int(l["start"] * sr):int(l["end"] * sr)]
    if len(seg) > sr * 0.5:
        ll.append((m.integrated_loudness(seg), l["index"], l["text"][:50]))
a = np.array([q[0] for q in ll])
print(f"per-line LUFS: median {np.median(a):.1f}  min {a.min():.1f}  max {a.max():.1f}  std {a.std():.2f}")
for q in sorted(ll)[:4] + sorted(ll)[-4:]:
    print(f"  {q[0]:6.1f}  L{q[1]:03d} {q[2]}")
