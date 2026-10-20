"""Re-synthesize individual narration lines (pronunciation fixes) without changing timing.

Each candidate is ASR-checked; the accepted take is time-fitted to the original line
duration (tiny tempo change) and spliced into build/voice_raw.wav at the same position.
"""
import json, subprocess, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from kokoro_onnx import Kokoro
from common import BUILD, MODELS, SR
from build_voice import trim, tighten_pauses
from asr import transcribe

VT = json.load(open(BUILD / "voice_timing.json"))
FIX = {  # line text -> list of (text spoken, speed) candidates; subtitles keep the original text
    "Bundy also entered romantic relationships.": [("Bundy also entered romantic relationships.", 0.95), ("Bundy, also, entered romantic relationships.", 0.98), ("Bundee also entered romantic relationships.", 0.98)],
    "Bundy was eventually recaptured and returned to custody.": [("Bundy was eventually recaptured and returned to custody.", 0.95), ("Bundee was eventually recaptured and returned to custody.", 0.98)],
    "During the following months, Donna Manson, Susan Rancourt, Kathy Parks, Brenda Ball, and Georgeann Hawkins also disappeared.":
        [("During the following months, Donna Manson, Susan Rancourt, Kathy Parks, Brenda Ball, and George Ann Hawkins also disappeared.", 0.98)],
    "His mother, Eleanor Louise Cowell, was unmarried when he was born, and for a period of his childhood, Bundy was raised by his maternal grandparents.":
        [("His mother, Elinor Louise Cowell, was unmarried when he was born, and for a period of his childhood, Bundy was raised by his maternal grandparents.", 0.98),
         ("His mother, Eleanor Louise Cowell, was unmarried when he was born, and for a period of his childhood, Bundy was raised by his maternal grandparents.", 0.95)],
}
CHECK = {"Bundy also": "bundy also", "Bundy was eventually": "bundy was eventually", "Georgeann": "george", "Eleanor": "elinor|eleanor"}

k = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))
voice, _ = sf.read(BUILD / "voice_raw.wav", dtype="float32")
report = []
for line in VT["lines"]:
    if line["text"] not in FIX:
        continue
    key = next(c for c in CHECK if c in line["text"])
    ok_take = None
    for txt, sp in FIX[line["text"]]:
        s, sr = k.create(txt, voice=VT["voice"], speed=sp, lang="en-us")
        a = tighten_pauses(resample_poly(trim(np.asarray(s, np.float32), sr), SR, sr).astype(np.float32), SR)
        hyp = transcribe(a, SR).lower()
        good = any(w in hyp for w in CHECK[key].split("|"))
        report.append((line["index"], txt[:40], sp, hyp[:60], good))
        if good:
            ok_take = a; break
    if ok_take is None:
        continue
    dur = line["end"] - line["start"]
    ratio = len(ok_take) / SR / dur
    tmp_in, tmp_out = BUILD / "fix_in.wav", BUILD / "fix_out.wav"
    sf.write(tmp_in, ok_take, SR)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp_in), "-af", f"atempo={ratio:.5f}", str(tmp_out)], check=True)
    fitted, _ = sf.read(tmp_out, dtype="float32")
    n = int(dur * SR)
    fitted = np.pad(fitted, (0, max(0, n - len(fitted))))[:n]
    i0 = int(line["start"] * SR)
    fade = int(0.01 * SR)
    fitted[:fade] *= np.linspace(0, 1, fade); fitted[-fade:] *= np.linspace(1, 0, fade)
    voice[i0:i0 + n] = fitted
    report.append((line["index"], "SPLICED", round(ratio, 4), "", True))
sf.write(BUILD / "voice_raw.wav", voice, SR, subtype="FLOAT")
for r in report:
    print(r)
