"""Original score + sound design (synthesized locally) and the final mix.

Everything here is generated from oscillators and filtered noise: no third-party music,
and no sound is presented as an authentic historical recording.
Outputs build/voice_proc.wav, build/music.wav, build/sfx.wav, build/mix.wav.
"""
import math, subprocess
import numpy as np, soundfile as sf
from scipy.signal import fftconvolve, butter, sosfilt
from common import BUILD, SR, load_json

TL = load_json(BUILD / "timeline.json")
VT = load_json(BUILD / "voice_timing.json")
DUR = TL["duration"]
N = int(DUR * SR)
rng = np.random.default_rng(42)
SEC = {s["id"]: s for s in VT["sections"]}
SHOT_START = {s["index"]: s["start"] for s in TL["shots"]}


def shot_t(kind, nth=0):
    return [s for s in TL["shots"] if s["type"] == kind][nth]["start"]


# ------------------------------------------------------------------ dsp helpers
def tt(n):
    return np.arange(n) / SR


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def env_curve(points):
    """Piecewise-linear automation over the whole timeline; points = [(t, value)]."""
    ts, vs = zip(*points)
    return np.interp(tt(N), ts, vs).astype(np.float32)


def add(buf, sig, t0, gain=1.0):
    i = int(t0 * SR)
    if i >= len(buf) or i + len(sig) <= 0:
        return
    if i < 0:
        sig, i = sig[-i:], 0
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n] * gain


_IR = None


def reverb(x, wet=0.3, length=2.4):
    global _IR
    if _IR is None:
        n = int(length * SR)
        ir = rng.normal(0, 1, n) * np.exp(-tt(n) * 6.0 / length)
        ir = lp(ir, 5000)
        ir[: int(0.012 * SR)] = 0
        _IR = (ir / np.sqrt((ir ** 2).sum())).astype(np.float32)
    return x * (1 - wet) + fftconvolve(x, _IR)[: len(x)] * wet * 2.2


# ------------------------------------------------------------------ instruments
def drone(f0, n, detune=0.0025, harmonics=7, cutoff=900):
    t = tt(n)
    sig = np.zeros(n)
    for k in range(1, harmonics + 1):
        for d in (-detune, detune):
            sig += np.sin(2 * np.pi * f0 * k * (1 + d) * t + rng.uniform(0, 6.28)) / k
    sig *= 1 + 0.18 * np.sin(2 * np.pi * 0.07 * t)
    return lp(sig, cutoff) * 0.12


def air(n, lo=1800, hi=5200):
    return bp(rng.normal(0, 1, n), lo, hi) * 0.05 * (1 + 0.3 * np.sin(2 * np.pi * 0.11 * tt(n)))


def kick(gain=1.0, f0=95, f1=42, dec=0.35):
    n = int(0.6 * SR); t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t * 22)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / dec) * gain


def tom(gain=1.0, f0=120, f1=72):
    n = int(0.5 * SR); t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t * 14)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)
    s += lp(rng.normal(0, 1, n), 1200) * np.exp(-t / 0.03) * 0.2
    return s * gain


def tick(gain=1.0):
    n = int(0.03 * SR)
    return hp(rng.normal(0, 1, n), 4000) * np.exp(-tt(n) / 0.004) * gain


def pluck(f, gain=1.0, dec=2.2):
    n = int(dec * 2 * SR); t = tt(n)
    s = sum(np.sin(2 * np.pi * f * k * t) * (0.6 ** (k - 1)) * np.exp(-t * (1.0 + 1.6 * k) / dec) for k in range(1, 6))
    s *= 1 - np.exp(-t * 400)
    return lp(s, 2600) * gain


def impact(gain=1.0, big=False):
    n = int((3.5 if big else 2.4) * SR); t = tt(n)
    f = 28 + 40 * np.exp(-t * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (1.3 if big else 0.8))
    crack = lp(rng.normal(0, 1, n), 2500 if big else 1800) * np.exp(-t / 0.06) * 0.5
    return reverb(boom + crack, 0.35) * gain


def riser(length=1.4, gain=1.0):
    n = int(length * SR); t = tt(n)
    noise = rng.normal(0, 1, n)
    out = np.zeros(n)
    seg = int(0.05 * SR)
    for i in range(0, n, seg):  # stepped band sweep, rising
        c = 400 + 3600 * (i / n) ** 2
        out[i:i + seg] = bp(noise[i:i + seg + 2000], c * 0.7, c * 1.3)[: len(out[i:i + seg])]
    return out * (t / length) ** 2.2 * gain * 0.6


def whoosh(gain=1.0):
    n = int(0.5 * SR); t = tt(n)
    e = np.sin(np.pi * np.clip(t / 0.5, 0, 1)) ** 2
    return bp(rng.normal(0, 1, n), 500, 3500) * e * gain * 0.35


def stamp_sfx(gain=1.0):
    n = int(0.8 * SR); t = tt(n)
    thump = np.sin(2 * np.pi * (70 + 60 * np.exp(-t * 40)) * t) * np.exp(-t / 0.09)
    slap = bp(rng.normal(0, 1, n), 800, 6000) * np.exp(-t / 0.018) * 0.6
    return reverb(thump + slap, 0.15) * gain


def key_click(gain=1.0):
    n = int(0.05 * SR); t = tt(n)
    c = bp(rng.normal(0, 1, n), 1800, 6000) * np.exp(-t / 0.005)
    th = np.sin(2 * np.pi * rng.uniform(170, 230) * t) * np.exp(-t / 0.012) * 0.5
    return (c + th) * gain * rng.uniform(0.7, 1.0)


# ------------------------------------------------------------------ score
# per-chapter intensity: pulse bpm (None = no pulse), pulse gain, toms, ticks, motif spacing (s), upper drone, ostinato
PROFILE = {0: (None, 0.0, False, False, 2.2, 0.3, False), 1: (None, 0.0, False, False, 2.4, 0.0, False),
           2: (60, 0.16, False, False, 2.6, 0.0, False), 3: (64, 0.26, False, False, None, 0.4, False),
           4: (80, 0.28, False, True, None, 0.3, False), 5: (92, 0.34, True, True, None, 0.9, True),
           6: (96, 0.34, True, True, None, 0.9, True), 7: (None, 0.0, False, False, 2.4, 0.2, False),
           8: (58, 0.15, False, False, 3.0, 0.0, False), 9: (None, 0.0, False, False, 3.2, 0.2, False),
           10: (None, 0.0, False, False, 2.6, 0.0, False)}


def chapter_spans():
    starts = {0: 0.0}
    for s in TL["shots"]:
        if s["type"] == "chapter":
            starts[s["chapter"]] = s["start"]
    ks = sorted(starts)
    return [(k, starts[k], starts[ks[i + 1]] if i + 1 < len(ks) else DUR) for i, k in enumerate(ks)]


def quiet_spans():
    return [(s["start"], s["end"]) for s in TL["shots"] if s["type"] in ("memorial", "execdate", "roll")]


def drone_chunked(f0, gain, cutoff, harmonics=7, detune=0.0025, seed=0):
    """Long drone generated in 30 s chunks (bounded memory), continuous phase and filter state."""
    r = np.random.default_rng(seed)
    phases = r.uniform(0, 6.28, (harmonics, 2))
    sos = butter(2, cutoff, "low", fs=SR, output="sos")
    zi = np.zeros((sos.shape[0], 2))
    out = np.zeros(N, np.float32)
    step = SR * 30
    for i0 in range(0, N, step):
        t = (np.arange(i0, min(N, i0 + step)) / SR)
        sig = np.zeros(len(t))
        for k in range(1, harmonics + 1):
            for j, d in enumerate((-detune, detune)):
                sig += np.sin(2 * np.pi * f0 * k * (1 + d) * t + phases[k - 1, j]) / k
        sig *= 1 + 0.18 * np.sin(2 * np.pi * 0.07 * t)
        y, zi = sosfilt(sos, sig, zi=zi)
        out[i0:i0 + len(t)] = y * 0.12 * gain
    return out


def build_music():
    L = np.zeros(N, np.float32); R = np.zeros(N, np.float32)
    spans = chapter_spans()
    quiet = quiet_spans()
    end = DUR
    # bed automation: chapter-level, ducked deeply during memorial/execution cards, fade in/out
    pts = [(0, 0.0), (0.3, 0.75)]
    for a, b in quiet:
        pts += [(a - 0.4, 1.0), (a + 0.3, 0.32), (b - 0.3, 0.32), (b + 0.6, 1.0)]
    pts += [(end - 7.0, 0.85), (end - 0.3, 0.0), (end, 0.0)]
    pts.sort()
    bed = env_curve(pts)
    for f, g, c, sd in ((73.42, 1.0, 900, 1), (110.0, 0.5, 700, 2)):
        L += drone_chunked(f, g, c, seed=sd) * bed
        R += drone_chunked(f * 1.002, g, c, seed=sd + 10) * bed
    a = (bp(rng.normal(0, 1, N).astype(np.float32), 1800, 5200) * 0.05).astype(np.float32)
    L += a * bed * 0.7; R += np.roll(a, 900) * bed * 0.7
    del a
    # upper drone per chapter profile
    up_pts = [(0, 0)]
    for k, a0, b0 in spans:
        lvl = PROFILE[k][5]
        up_pts += [(a0 + 0.5, lvl), (b0 - 0.5, lvl)]
    up = env_curve(sorted(up_pts)) * bed
    d3 = drone_chunked(146.83, 0.45, 1400, harmonics=5, seed=3)
    L += d3 * up; R += np.roll(d3, 300) * up
    del d3
    motif = [146.83, 174.61, 220.0, 164.81, 146.83, 130.81, 116.54, 110.0]
    in_quiet = lambda t: any(a - 0.2 <= t < b for a, b in quiet)
    ost = [73.42, 73.42, 87.31, 73.42, 65.41, 73.42, 87.31, 98.0]
    for k, a0, b0 in spans:
        bpm, pg, toms, ticks, mot, _, osti = PROFILE[k]
        if mot:
            t, i = a0 + 1.0, 0
            while t < b0 - 1.0:
                if not in_quiet(t):
                    p = pluck(motif[i % 8], 0.10).astype(np.float32); add(L, p, t, 0.9); add(R, p, t + 0.012, 0.75)
                i += 1; t += mot * (1.0 if i % 8 else 1.6)
        if bpm:
            beat = 60 / bpm; t, i = a0 + 1.0, 0
            while t < b0 - 0.5:
                if not in_quiet(t):
                    kk = kick(pg).astype(np.float32); add(L, kk, t); add(R, kk, t)
                    if bpm < 70:
                        k2 = kick(pg * 0.55).astype(np.float32); add(L, k2, t + 0.24); add(R, k2, t + 0.24)
                    if toms and i % 4 == 3:
                        tm = tom(pg * 0.6).astype(np.float32); add(L, tm, t + beat / 2, 0.8); add(R, tm, t + beat / 2, 0.5)
                    if ticks:
                        for h in range(2):
                            tk = tick(0.10 if h == 0 else 0.06).astype(np.float32); add(L, tk, t + h * beat / 2, 0.6); add(R, tk, t + h * beat / 2 + 0.003, 0.9)
                t += beat; i += 1
        if osti:
            t, i = a0 + 1.5, 0
            while t < b0 - 0.5:
                if not in_quiet(t):
                    p = pluck(ost[i % 8] * 2, 0.06, dec=0.6).astype(np.float32); add(L, p, t, 0.7); add(R, p, t, 0.9)
                t += 60 / bpm / 2; i += 1
    # final tail: soft low chord under the last minute
    t0 = max(0, end - 60)
    n = int((end - t0) * SR); tt_ = tt(n)
    for f, g in ((73.42, 0.10), (110.0, 0.07), (174.61, 0.05), (220.0, 0.04)):
        sig = (np.sin(2 * np.pi * f * tt_) * np.clip(tt_ / 6.0, 0, 1) * np.clip((end - t0 - tt_) / 5.0, 0, 1) * g).astype(np.float32)
        add(L, sig, t0); add(R, sig, t0 + 0.01)
    return np.stack([reverb_long(L, 0.22), reverb_long(R, 0.22)], 1)


def reverb_long(x, wet):
    from scipy.signal import oaconvolve
    reverb(np.zeros(10), wet)  # builds the impulse response
    return (x * (1 - wet) + oaconvolve(x, _IR.astype(np.float32))[: len(x)] * wet * 2.2).astype(np.float32)


def build_sfx():
    L = np.zeros(N, np.float32); R = np.zeros(N, np.float32)
    for s in TL["shots"]:
        t0 = s["start"]
        for fx in s["sfx"]:
            if fx == "impact":
                x = impact(0.55); add(L, x, t0); add(R, x, t0)
            elif fx == "impact_big":
                x = impact(0.7, big=True); add(L, x, t0); add(R, x, t0)
            elif fx == "impact_soft":
                x = impact(0.30, big=True); add(L, x, t0 + 0.05); add(R, x, t0 + 0.05)
            elif fx == "hit_small":
                x = reverb(tom(0.45, 150, 80), 0.3); add(L, x, t0); add(R, x, t0)
            elif fx == "whoosh":
                x = whoosh(0.8); add(L, x, t0 - 0.25, 0.9); add(R, x, t0 - 0.22, 0.7)
            elif fx == "riser":
                x = riser(1.4, 0.5); add(L, x, min(s["end"], t0 + 3.0) - 1.4); add(R, x, min(s["end"], t0 + 3.0) - 1.4)
            elif fx == "riser_soft":
                x = riser(1.6, 0.25); add(L, x, t0 - 1.6); add(R, x, t0 - 1.6)
            elif fx == "stamp":
                x = stamp_sfx(0.7); add(L, x, t0 + 0.10); add(R, x, t0 + 0.10)
            elif fx == "siren_hint":  # soft synth pulse synced to the light flashes (not a siren)
                t = t0
                while t < s["end"]:
                    x = pluck(146.83, 0.05, dec=0.3); add(L, x, t); add(R, x, t + 0.227)
                    t += 1 / 2.2
            elif fx == "ticks":
                P = s["params"]; d = s["duration"]
                prev = None
                for i in range(int(d * 200)):
                    tt_ = i / 200; p = tt_ / d
                    e = min(1, p / 0.65); e = e * e * (3 - 2 * e)
                    yr = int(round(P["from"] + (P["to"] - P["from"]) * e))
                    if yr != prev and prev is not None:
                        x = key_click(0.2); x[:1440] += tick(0.25); add(L, x, t0 + tt_); add(R, x, t0 + tt_)
                    prev = yr
            elif fx == "drone_dip":
                pass  # handled by the music automation
        if s["type"] == "casefile":
            for txt, a0, a1 in s["params"]["lines"]:
                for i, c in enumerate(txt):
                    tc = a0 + (a1 - a0) * i / max(1, len(txt))
                    if c.strip() and s["start"] <= tc < s["end"]:
                        x = key_click(0.11); add(L, x, tc, 0.8); add(R, x, tc, 1.0)
    return np.stack([L, R], 1)


def ffmpeg(args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error"] + args, check=True)


def level_lines():
    """Bring every narration line to the same loudness (sentences differ by up to ~3 LU from the TTS)."""
    import pyloudnorm as pyln
    v, _ = sf.read(BUILD / "voice_raw.wav", dtype="float32")
    meter = pyln.Meter(SR)
    louds = []
    for l in VT["lines"]:
        seg = v[int(l["start"] * SR):int(l["end"] * SR)]
        louds.append(meter.integrated_loudness(seg) if len(seg) > SR * 0.45 else None)
    target = float(np.median([x for x in louds if x is not None]))
    gain = np.ones(len(v), np.float32)
    for l, lu in zip(VT["lines"], louds):
        if lu is None or not np.isfinite(lu):
            continue
        gain[int(l["start"] * SR):int(l["end"] * SR)] = 10 ** (np.clip(target - lu, -4, 4) / 20)
    k = int(0.03 * SR)  # 30 ms smoothing of gain steps (they fall in silences anyway)
    gain = np.convolve(gain, np.ones(k) / k, "same").astype(np.float32)
    sf.write(BUILD / "voice_level.wav", v * gain, SR, subtype="FLOAT")


def main():
    # 1) voice: per-line levelling, gentle cleanup, EQ and compression
    level_lines()
    ffmpeg(["-i", str(BUILD / "voice_level.wav"), "-af",
            "highpass=f=75,equalizer=f=250:t=q:w=1.2:g=-2,equalizer=f=3200:t=q:w=1.5:g=2,"
            "deesser=i=0.25,acompressor=threshold=-24dB:ratio=3:attack=5:release=150:makeup=3,"
            "alimiter=limit=0.89", "-ar", str(SR), str(BUILD / "voice_proc.wav")])
    v, _ = sf.read(BUILD / "voice_proc.wav")
    v = np.pad(v, (0, max(0, N - len(v))))[:N]
    music = build_music(); sfx = build_sfx()
    sf.write(BUILD / "music.wav", (music / np.abs(music).max() * 0.8).astype(np.float32), SR)
    sf.write(BUILD / "sfx.wav", (sfx / np.abs(sfx).max() * 0.8).astype(np.float32), SR)
    # 2) automatic ducking from the voice envelope: holds through short pauses (< 1.4 s) so the
    #    music does not swell between sentences; attack 60 ms, recovery 0.9 s, depth 5 dB
    hop = int(0.01 * SR)
    rms = np.sqrt(np.convolve(v ** 2, np.ones(hop * 3) / (hop * 3), "same"))
    active = (rms > 10 ** (-38 / 20) * np.abs(v).max()).astype(np.float64)[::hop]
    idx = np.flatnonzero(active)
    for a0, b0 in zip(idx[:-1], idx[1:]):
        if 1 < b0 - a0 <= 140:
            active[a0:b0] = 1.0
    g = np.zeros_like(active); a_up, a_dn = 1 - math.exp(-1 / 6), 1 - math.exp(-1 / 90)
    for i in range(1, len(g)):
        g[i] = g[i - 1] + (active[i] - g[i - 1]) * (a_up if active[i] > g[i - 1] else a_dn)
    duck = np.interp(np.arange(N), np.arange(len(g)) * hop, g)
    duck_db = -5.0 * duck
    m_gain = 10 ** (duck_db / 20)
    music_n = music / np.sqrt((music ** 2).mean()) * 10 ** (-28.5 / 20)
    sfx_n = sfx / np.abs(sfx).max()
    sfx_n = np.tanh(sfx_n * 2.2) / 2.2 * 10 ** (-12 / 20)  # soft-limit hits, then 5 dB lower overall
    voice_n = v / np.sqrt((v[np.abs(v) > 1e-4] ** 2).mean()) * 10 ** (-17 / 20)
    mix = voice_n[:, None] + music_n * m_gain[:, None] + sfx_n * (1 - 0.3 * duck)[:, None]
    # short fades at the very start/end
    mix[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
    mix[-int(0.5 * SR):] *= np.linspace(1, 0, int(0.5 * SR))[:, None]
    sf.write(BUILD / "mix_pre.wav", mix.astype(np.float32), SR, subtype="FLOAT")
    sf.write(BUILD / "stem_voice_pre.wav", np.repeat(voice_n[:, None], 2, 1).astype(np.float32), SR, subtype="FLOAT")
    sf.write(BUILD / "stem_bg_pre.wav", (music_n * m_gain[:, None] + sfx_n * (1 - 0.3 * duck)[:, None]).astype(np.float32), SR, subtype="FLOAT")
    # 3) gentle bus compression, then two-pass EBU R128 to -14 LUFS, -3 dBTP (headroom for AAC)
    ffmpeg(["-i", str(BUILD / "mix_pre.wav"), "-af", "acompressor=threshold=-20dB:ratio=1.8:attack=20:release=300:makeup=1",
            "-c:a", "pcm_f32le", str(BUILD / "mix_bus.wav")])
    import shutil
    shutil.move(BUILD / "mix_bus.wav", BUILD / "mix_pre.wav")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(BUILD / "mix_pre.wav"), "-af",
                        "loudnorm=I=-14:TP=-3:LRA=7:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    import json, re
    st = json.loads(re.findall(r"\{[^{}]*\}", r.stderr, re.S)[-1])
    ffmpeg(["-i", str(BUILD / "mix_pre.wav"), "-af",
            f"loudnorm=I=-14:TP=-3:LRA=7:measured_I={st['input_i']}:measured_TP={st['input_tp']}:"
            f"measured_LRA={st['input_lra']}:measured_thresh={st['input_thresh']}:offset={st['target_offset']}:linear=true",
            "-ar", str(SR), str(BUILD / "mix.wav")])
    print("mix written; first pass measured", st["input_i"], "LUFS")


if __name__ == "__main__":
    main()
