"""Synthesize the narration line by line (Kokoro, local) and derive word timings.

Outputs build/voice_raw.wav (48 kHz mono, unprocessed) and build/voice_timing.json.
Timing is exact at line level; word times inside a line come from detected pauses
plus spoken-length weighting, and are checked against the audio in qc.py.
"""
import re
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
from kokoro_onnx import Kokoro
from common import PIPE, BUILD, MODELS, SR, VOICE_OFFSET, load_json, save_json

NUM_WORDS = {"1970s": "nineteen seventies", "1974": "nineteen seventy four", "1975": "nineteen seventy five",
             "1977": "nineteen seventy seven", "1978": "nineteen seventy eight", "1979": "nineteen seventy nine",
             "1989": "nineteen eighty nine"}


def spoken_weight(word):
    core = re.sub(r"[^\w]", "", word)
    spoken = NUM_WORDS.get(core, core)
    return len(spoken.replace(" ", "")) + 2.5


def trim(x, sr, thr_db=-48, pad=0.03):
    env = np.abs(x)
    thr = 10 ** (thr_db / 20) * env.max()
    idx = np.where(env > thr)[0]
    a = max(0, idx[0] - int(pad * sr)); b = min(len(x), idx[-1] + int(pad * sr))
    return x[a:b]


def tighten_pauses(x, sr, keep=0.17, ratio=0.3, min_run=0.22):
    """Shorten long internal silences (comma pauses) to keep delivery tight."""
    db = frame_db(x, sr)
    silent = db < -34
    out, last, i, hop = [], 0, 0, int(0.01 * sr)
    while i < len(silent):
        if silent[i]:
            j = i
            while j < len(silent) and silent[j]:
                j += 1
            run = (j - i) * 0.01
            if run > min_run and i > 3 and j < len(silent) - 3:
                new = keep + ratio * (run - keep)
                cut = int((run - new) * sr)
                mid = (i + j) // 2 * hop
                a, b = mid - cut // 2, mid + cut - cut // 2
                out.append(x[last:a]); last = b
            i = j
        else:
            i += 1
    out.append(x[last:])
    return np.concatenate(out)


def frame_db(x, sr, hop=0.01):
    n = int(hop * sr)
    m = len(x) // n
    rms = np.sqrt((x[:m * n].reshape(m, n) ** 2).mean(1) + 1e-12)
    return 20 * np.log10(rms / rms.max())


def word_times(text, audio, sr):
    """Return [(word, start, end)] relative to the start of this line."""
    words = text.split()
    dur = len(audio) / sr
    db = frame_db(audio, sr)
    silent = db < -30
    # internal gaps of >= 70 ms
    gaps, i = [], 0
    while i < len(silent):
        if silent[i]:
            j = i
            while j < len(silent) and silent[j]:
                j += 1
            if (j - i) >= 7 and i > 5 and j < len(silent) - 5:
                gaps.append(((i * 0.01), (j * 0.01)))
            i = j
        else:
            i += 1
    # split words into phrases at punctuation
    phrases, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r"[,.?;:]$", w):
            phrases.append(cur); cur = []
    if cur:
        phrases.append(cur)
    weights = [sum(spoken_weight(w) for w in p) for p in phrases]
    total = sum(weights)
    # match each phrase boundary to the nearest detected gap
    bounds, acc = [], 0
    for wgt in weights[:-1]:
        acc += wgt
        expect = acc / total * dur
        best = min(gaps, key=lambda g: abs((g[0] + g[1]) / 2 - expect)) if gaps else None
        if best and abs((best[0] + best[1]) / 2 - expect) < 0.6:
            bounds.append(best)
        else:
            bounds.append((expect, expect))
    segs, start = [], 0.0
    for k, p in enumerate(phrases):
        end = bounds[k][0] if k < len(bounds) else dur
        segs.append((p, start, end))
        start = bounds[k][1] if k < len(bounds) else dur
    out = []
    for p, s, e in segs:
        ws = [spoken_weight(w) for w in p]
        t = s
        for w, wg in zip(p, ws):
            d = (e - s) * wg / sum(ws)
            out.append((w, round(t, 3), round(t + d, 3)))
            t += d
    return out


def main():
    cfg = load_json(PIPE / "narration.json")
    k = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))
    pieces = [np.zeros(int(VOICE_OFFSET * SR), np.float32)]
    t = VOICE_OFFSET
    timing = {"voice": cfg["voice"], "speed": cfg["speed"], "sections": [], "lines": []}
    li = 0
    for sec in cfg["sections"]:
        sec_start = t
        for line in sec["lines"]:
            s, sr = k.create(line["text"], voice=cfg["voice"], speed=cfg["speed"], lang="en-us")
            s = trim(np.asarray(s, np.float32), sr)
            a = tighten_pauses(resample_poly(s, SR, sr).astype(np.float32), SR)
            words = word_times(line["text"], a, SR)
            dur = len(a) / SR
            timing["lines"].append({"index": li, "section": sec["id"], "text": line["text"],
                                    "start": round(t, 3), "end": round(t + dur, 3),
                                    "words": [{"w": w, "start": round(t + ws, 3), "end": round(t + we, 3)} for w, ws, we in words]})
            pieces.append(a)
            t += dur
            gap = line["pause_after"]
            pieces.append(np.zeros(int(gap * SR), np.float32))
            t += int(gap * SR) / SR
            li += 1
            print(f"{li:02d} {dur:5.2f}s  {line['text']}")
        timing["sections"].append({"id": sec["id"], "start": round(sec_start, 3), "end": round(t, 3)})
    audio = np.concatenate(pieces)
    BUILD.mkdir(exist_ok=True)
    sf.write(BUILD / "voice_raw.wav", audio, SR, subtype="FLOAT")
    timing["duration"] = round(len(audio) / SR, 3)
    save_json(BUILD / "voice_timing.json", timing)
    print("narration duration", timing["duration"])


if __name__ == "__main__":
    main()
