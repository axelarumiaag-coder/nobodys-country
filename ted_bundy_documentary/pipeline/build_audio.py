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
def build_music():
    L = np.zeros(N); R = np.zeros(N)
    early, arrest, trial, ending = SEC["EARLY CASES"]["start"], SEC["ARREST AND ESCAPES"]["start"], SEC["TRIAL"]["start"], SEC["ENDING"]["start"]
    florida = shot_t("chapter", 3)
    memorial = shot_t("memorial")
    pens = [s for s in TL["shots"] if s["type"] == "map"][-1]["start"]
    exec_end = VT["lines"][17]["end"]
    question = VT["lines"][19]["start"]
    end = DUR

    # drone bed (D) + fifth, stereo-detuned
    d1 = drone(73.42, N); d2 = drone(110.0, N, cutoff=700) * 0.5
    d1r = drone(73.42 * 1.002, N); d2r = drone(110.0 * 0.998, N, cutoff=700) * 0.5
    bed_env = env_curve([(0, 0.0), (0.25, 0.75), (6.0, 1.0), (ending, 0.9), (exec_end, 0.6), (exec_end + 0.4, 0.12),
                         (question - 1.0, 0.12), (question + 1.5, 0.75), (end - 6.5, 0.8), (end - 0.3, 0.0), (end, 0.0)])
    L += (d1 + d2) * bed_env; R += (d1r + d2r) * bed_env
    a = air(N)
    air_env = env_curve([(0, 0), (1.0, 0.8), (early, 0.5), (florida, 1.0), (trial, 0.4), (end - 1, 0.6), (end, 0)])
    L += a * air_env; R += np.roll(a, 900) * air_env

    # upper drone layer for Florida (controlled intensity)
    d3 = drone(146.83, N, cutoff=1400, harmonics=5) * 0.45
    up_env = env_curve([(0, 0), (florida - 0.5, 0), (florida + 1.0, 1.0), (memorial, 1.0), (memorial + 0.6, 0.35),
                        (pens, 0.35), (pens + 0.5, 0.9), (trial - 0.2, 0.9), (trial + 0.8, 0), (end, 0)])
    L += d3 * up_env; R += np.roll(d3, 300) * up_env

    # piano-like motif: sparse in Ch1, sparser in the trial
    motif = [146.83, 174.61, 220.0, 164.81, 146.83, 130.81, 116.54, 110.0]
    def motif_run(t0, t1, every, gain):
        k, t = 0, t0
        while t < t1:
            p = pluck(motif[k % len(motif)], gain)
            add(L, p, t, 0.9); add(R, p, t + 0.012, 0.75)
            k += 1; t += every
    motif_run(early + 0.2, SEC["EARLY CASES"]["start"] + 12.0, 1.85, 0.11)
    motif_run(trial + 0.1, ending - 0.4, 2.4, 0.10)

    # heartbeat pulse in Ch2 (64 bpm) -> 84 bpm in Ch3 -> 96 bpm in Florida
    def pulse(t0, t1, bpm, gain, toms=False, ticks=False, skip=()):
        beat = 60 / bpm; t = t0; i = 0
        while t < t1:
            if not any(a <= t < b for a, b in skip):
                kk = kick(gain); add(L, kk, t); add(R, kk, t)
                if bpm < 70:  # double-beat 'heartbeat'
                    add(L, kick(gain * 0.55), t + 0.24); add(R, kick(gain * 0.55), t + 0.24)
                if toms and i % 4 == 3:
                    tm = tom(gain * 0.6); add(L, tm, t + beat / 2, 0.8); add(R, tm, t + beat / 2, 0.5)
                if ticks:
                    for h in range(2):
                        tk = tick(0.10 if h == 0 else 0.06); add(L, tk, t + h * beat / 2, 0.6); add(R, tk, t + h * beat / 2 + 0.003, 0.9)
            t += beat; i += 1
    ch2 = shot_t("chapter", 1)
    pulse(ch2 + 0.9, arrest - 0.3, 64, 0.30)
    pulse(arrest, florida - 0.4, 84, 0.34, toms=True, ticks=True, skip=[(SHOT_START[30] - 0.1, SHOT_START[31])])
    pulse(florida + 0.9, memorial - 0.2, 96, 0.38, toms=True, ticks=True)
    pulse(pens, trial - 0.3, 96, 0.30, ticks=True)
    # low ostinato in Florida
    ost = [73.42, 73.42, 87.31, 73.42, 65.41, 73.42, 87.31, 98.0]
    t, k = florida + 0.9, 0
    while t < memorial - 0.2:
        p = pluck(ost[k % 8] * 2, 0.07, dec=0.6); add(L, p, t, 0.7); add(R, p, t, 0.9)
        t += 60 / 96 / 2; k += 1
    # final tail: soft low chord swell under the closing lines
    for f, g in ((73.42, 0.10), (110.0, 0.07), (174.61, 0.05), (220.0, 0.04)):
        n = int((end - question) * SR); tt_ = tt(n)
        sig = np.sin(2 * np.pi * f * tt_) * np.clip(tt_ / 3.0, 0, 1) * np.clip((end - question - tt_) / 3.0, 0, 1) * g
        add(L, sig, question); add(R, sig, question + 0.01)
    m = np.stack([L, R], 1)
    m = np.stack([reverb(m[:, 0], 0.22), reverb(m[:, 1], 0.22)], 1)
    return m


def build_sfx():
    L = np.zeros(N); R = np.zeros(N)
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
                x = riser(1.4, 0.5); add(L, x, s["end"] - 1.4); add(R, x, s["end"] - 1.4)
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


def main():
    # 1) voice: gentle cleanup, EQ and compression
    ffmpeg(["-i", str(BUILD / "voice_raw.wav"), "-af",
            "highpass=f=75,equalizer=f=250:t=q:w=1.2:g=-2,equalizer=f=3200:t=q:w=1.5:g=2,"
            "deesser=i=0.25,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=140:makeup=2,"
            "alimiter=limit=0.89", "-ar", str(SR), str(BUILD / "voice_proc.wav")])
    v, _ = sf.read(BUILD / "voice_proc.wav")
    v = np.pad(v, (0, max(0, N - len(v))))[:N]
    music = build_music(); sfx = build_sfx()
    sf.write(BUILD / "music.wav", (music / np.abs(music).max() * 0.8).astype(np.float32), SR)
    sf.write(BUILD / "sfx.wav", (sfx / np.abs(sfx).max() * 0.8).astype(np.float32), SR)
    # 2) automatic ducking from the voice envelope (smooth, attack 60 ms / release 400 ms)
    hop = int(0.01 * SR)
    rms = np.sqrt(np.convolve(v ** 2, np.ones(hop * 3) / (hop * 3), "same"))
    active = (rms > 10 ** (-38 / 20) * np.abs(v).max()).astype(np.float64)[::hop]
    g = np.zeros_like(active); a_up, a_dn = 1 - math.exp(-1 / 6), 1 - math.exp(-1 / 40)
    for i in range(1, len(g)):
        g[i] = g[i - 1] + (active[i] - g[i - 1]) * (a_up if active[i] > g[i - 1] else a_dn)
    duck = np.interp(np.arange(N), np.arange(len(g)) * hop, g)
    duck_db = -8.5 * duck
    m_gain = 10 ** (duck_db / 20)
    music_n = music / np.sqrt((music ** 2).mean()) * 10 ** (-25 / 20)
    sfx_n = sfx / np.abs(sfx).max() * 10 ** (-9 / 20)
    voice_n = v / np.sqrt((v[np.abs(v) > 1e-4] ** 2).mean()) * 10 ** (-17 / 20)
    mix = voice_n[:, None] + music_n * m_gain[:, None] + sfx_n * (1 - 0.3 * duck)[:, None]
    # short fades at the very start/end
    mix[: int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))[:, None]
    mix[-int(0.5 * SR):] *= np.linspace(1, 0, int(0.5 * SR))[:, None]
    sf.write(BUILD / "mix_pre.wav", mix.astype(np.float32), SR, subtype="FLOAT")
    sf.write(BUILD / "stem_voice_pre.wav", np.repeat(voice_n[:, None], 2, 1).astype(np.float32), SR, subtype="FLOAT")
    sf.write(BUILD / "stem_bg_pre.wav", (music_n * m_gain[:, None] + sfx_n * (1 - 0.3 * duck)[:, None]).astype(np.float32), SR, subtype="FLOAT")
    # 3) loudness: two-pass EBU R128 to -14 LUFS, -2.5 dBTP (headroom for AAC) (YouTube-friendly)
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(BUILD / "mix_pre.wav"), "-af",
                        "loudnorm=I=-14:TP=-2.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    import json, re
    st = json.loads(re.findall(r"\{[^{}]*\}", r.stderr, re.S)[-1])
    ffmpeg(["-i", str(BUILD / "mix_pre.wav"), "-af",
            f"loudnorm=I=-14:TP=-2.5:LRA=11:measured_I={st['input_i']}:measured_TP={st['input_tp']}:"
            f"measured_LRA={st['input_lra']}:measured_thresh={st['input_thresh']}:offset={st['target_offset']}:linear=true",
            "-ar", str(SR), str(BUILD / "mix.wav")])
    print("mix written; first pass measured", st["input_i"], "LUFS")


if __name__ == "__main__":
    main()
