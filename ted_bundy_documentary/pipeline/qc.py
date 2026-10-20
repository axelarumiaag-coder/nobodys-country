"""Automated quality control of a rendered video. Writes build/qc_<name>.json and stills.

python qc.py <video.mp4>
"""
import json, re, subprocess, sys, string
import numpy as np, soundfile as sf
from common import BUILD, OUT, SR, load_json, save_json
from asr import transcribe
from build_voice import frame_db

VID = sys.argv[1]
NAME = "final" if "final" in VID else "preview"
VT = load_json(BUILD / "voice_timing.json")
TL = load_json(BUILD / "timeline.json")
R = {"video": VID}


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def norm(s):
    s = s.lower().replace("-", " ")
    s = s.translate(str.maketrans("", "", string.punctuation.replace("'", "")))
    return s.split()


def wer(ref, hyp):
    r, h = norm(ref), norm(hyp)
    d = np.zeros((len(r) + 1, len(h) + 1), int)
    d[:, 0] = range(len(r) + 1); d[0, :] = range(len(h) + 1)
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + (r[i - 1] != h[j - 1]))
    return d[-1, -1] / max(1, len(r))


# 1) container / stream facts
p = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", VID]).stdout)
v = [s for s in p["streams"] if s["codec_type"] == "video"][0]
a = [s for s in p["streams"] if s["codec_type"] == "audio"][0]
R["streams"] = {"video": f"{v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']} {v.get('pix_fmt')}",
                "audio": f"{a['codec_name']} {a['sample_rate']} Hz {a['channels']} ch",
                "video_duration": float(v.get("duration", 0)), "audio_duration": float(a.get("duration", 0)),
                "frames": int(v.get("nb_frames", 0)), "expected_frames": int(round(TL["duration"] * TL.get("fps", 30)))}

# 2) decode the whole file (catches corrupt frames) + true black frames
bd = run(["ffmpeg", "-hide_banner", "-v", "error", "-i", VID, "-vf", "blackdetect=d=0.04:pix_th=0.02:pic_th=0.995", "-an", "-f", "null", "-"])
bd2 = run(["ffmpeg", "-hide_banner", "-i", VID, "-vf", "blackdetect=d=0.04:pix_th=0.02:pic_th=0.995", "-an", "-f", "null", "-"])
R["decode_errors"] = bd.stderr.strip()[:2000]
R["black_segments"] = re.findall(r"black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)", bd2.stderr)

# 3) audio: loudness, true peak, clipping
eb = run(["ffmpeg", "-hide_banner", "-i", VID, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
R["loudness"] = {"integrated_LUFS": float(re.findall(r"I:\s+(-?[\d.]+) LUFS", eb)[-1]),
                 "LRA": float(re.findall(r"LRA:\s+(-?[\d.]+) LU", eb)[-1]),
                 "true_peak_dBFS": float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", eb)[-1])}
wav = BUILD / f"qc_{NAME}.wav"
run(["ffmpeg", "-y", "-loglevel", "error", "-i", VID, "-vn", "-ac", "2", "-ar", str(SR), str(wav)])
mix, _ = sf.read(wav)
R["loudness"]["samples_at_or_above_0.999"] = int((np.abs(mix) >= 0.999).sum())
# silence/near-silence moments (for the deliberate pause before the final question)
db = frame_db(mix.mean(1), SR, 0.05)
R["near_silence_windows_s"] = [round(i * 0.05, 2) for i in range(len(db)) if db[i] < -45][:40]

# 4) intelligibility: Whisper on the final mix, line by line (music and SFX included)
lines = []
for ln in VT["lines"]:
    seg = mix[int((ln["start"] - 0.12) * SR): int((ln["end"] + 0.15) * SR)]
    hyp = transcribe(seg, SR)
    lines.append({"line": ln["index"], "ref": ln["text"], "asr": hyp, "wer": round(wer(ln["text"], hyp), 3)})
R["asr_lines"] = lines
R["asr_mean_wer"] = round(float(np.mean([l["wer"] for l in lines])), 4)

# 5) subtitle sync: cue start vs measured voice onset (cues that follow a pause)
voice, _ = sf.read(BUILD / "voice_raw.wav")
vdb = frame_db(voice, SR, 0.005)
from subtitles import build_chunks
errs = []
for c in build_chunks(VT):
    w0 = c["words"][0]["start"]
    i0 = int(w0 / 0.005)
    if i0 > 30 and (vdb[i0 - 24:i0 - 6] < -35).all():  # preceded by >= 90 ms of silence
        win = vdb[i0 - 24:i0 + 60]
        on = np.argmax(win > -30)
        onset = (i0 - 24 + on) * 0.005
        errs.append({"cue": c["text"], "cue_start": round(c["start"], 3), "voice_onset": round(onset, 3),
                     "offset_ms": round((c["start"] - onset) * 1000)})
R["subtitle_sync"] = {"cues_measured": len(errs),
                      "max_abs_offset_ms": max(abs(e["offset_ms"]) for e in errs),
                      "mean_offset_ms": round(float(np.mean([e["offset_ms"] for e in errs])), 1), "detail": errs}
srt = (OUT / "ted_bundy_subtitles.srt").read_text(encoding="utf-8")
srt_words = " ".join(b.split("\n", 2)[2] for b in srt.strip().split("\n\n"))
script_words = " ".join(l["text"] for l in VT["lines"])
R["srt_matches_narration_text"] = norm(srt_words) == norm(script_words)

# 6) waveform picture + stills at every shot midpoint
run(["ffmpeg", "-y", "-loglevel", "error", "-i", VID, "-filter_complex",
     "showwavespic=s=1800x400:split_channels=1:colors=0xd8d4cc|0xb2181e", "-frames:v", "1", str(BUILD / f"waveform_{NAME}.png")])
sd = BUILD / f"qc_stills_{NAME}"
sd.mkdir(exist_ok=True)
for s in TL["shots"]:
    t = (s["start"] + s["end"]) / 2
    run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", VID, "-frames:v", "1", "-vf", "scale=480:-1", str(sd / f"shot{s['index']:03d}.png")])
save_json(BUILD / f"qc_{NAME}.json", R)
print(json.dumps({k: R[k] for k in ("streams", "black_segments", "loudness", "asr_mean_wer", "srt_matches_narration_text")}, indent=1))
print("subtitle sync:", {k: R["subtitle_sync"][k] for k in ("cues_measured", "max_abs_offset_ms", "mean_offset_ms")})
for l in lines:
    if l["wer"] > 0:
        print("ASR diff:", l["wer"], "|", l["ref"], "|", l["asr"])
