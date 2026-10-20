# Ted Bundy — The Perfect Mask

A short true-crime documentary (about 1:49, 1920×1080, 30 fps) rendered by a reproducible Python and FFmpeg pipeline.

## Deliverables (`output/`)
| File | What it is |
|---|---|
| `ted_bundy_final.mp4` | Final video: H.264 at 1080p30 with AAC 320k stereo audio, −14 LUFS, subtitles burned in |
| `ted_bundy_thumbnail.jpg` | 1280×720 YouTube thumbnail ("THE PERFECT MASK") |
| `ted_bundy_script.txt` | Final narration, with the factual edits listed |
| `ted_bundy_subtitles.srt` | Subtitles synchronized to the narration (upload this to YouTube as a separate caption track) |
| `asset_manifest.csv` | Every asset used, with its source, creator and licence, plus the assets that could not be obtained |
| `chronological_timeline.csv` | All 54 shots with timecodes, historical period, asset and notes |
| `quality_control_report.txt` | Measured checks, historical notes and remaining limitations |

## Pipeline (`pipeline/`)
`build_voice.py` (Kokoro TTS, local) → `timeline.py` (shot list anchored to word timings) → `subtitles.py`
→ `build_audio.py` (synthesized score and SFX, ducking, EBU R128 loudness) → `thumbnail.py` → `render.py` (frames → FFmpeg)
→ `qc.py` (Whisper intelligibility check, subtitle sync, black frames, loudness, stills).

Run everything with `./run_all.sh`, or `./run_all.sh --preview` for a half-resolution pass.

Setup: `python3 -m venv /opt/docenv && /opt/docenv/bin/pip install kokoro-onnx sherpa-onnx soundfile scipy numpy pillow`.
Then download these model files into `/opt/models`:
- `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the kokoro-onnx GitHub release `model-files-v1.0`
- `sherpa-onnx-whisper-small.en` from the sherpa-onnx `asr-models` release

Fonts come from the apt packages `fonts-inter`, `fonts-bebas-neue` and `fonts-courier-prime`.

## Adding archival photographs
Wikimedia Commons and Pexels were not reachable from the cloud environment that built this version.
1. Run `assets/archival/descarrega_material.py` on a machine with internet access, inside `assets/archival/`.
2. Check each image: identity, date, and licence on its Commons page.
3. Assign the verified files to slots in `assets/archival/archival_assignments.json`. The available slots are `hook_portrait`, `uw_campus`, `portrait_1970s`, `vw_beetle`, `trial_1979`, `doc_1980` and `thumbnail_portrait`.
4. Re-run `./run_all.sh`. Each assigned shot switches from its illustration to a graded Ken Burns move on the photo, labelled ARCHIVAL with its caption and credit.
5. Add the photos to `output/asset_manifest.csv`.
