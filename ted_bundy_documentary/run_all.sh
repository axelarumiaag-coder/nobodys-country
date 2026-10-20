#!/usr/bin/env bash
# Rebuilds every deliverable. Requires: ffmpeg, Python venv at /opt/docenv (kokoro-onnx, sherpa-onnx,
# soundfile, scipy, numpy, pillow) and model files in /opt/models (see README.md).
set -euo pipefail
cd "$(dirname "$0")/pipeline"
PY=${PY:-/opt/docenv/bin/python}
$PY build_voice.py        # narration + word timing
$PY timeline.py           # shot list -> build/timeline.json + output/chronological_timeline.csv
$PY subtitles.py          # output/ted_bundy_subtitles.srt
$PY build_audio.py        # score, SFX, ducking, loudness
$PY thumbnail.py          # output/ted_bundy_thumbnail.jpg
$PY render.py ${1:-}      # pass --preview for a fast half-res pass
if [ "${1:-}" != "--preview" ]; then
  ffmpeg -y -loglevel error -i ../build/video_final.mp4 -i ../build/mix.wav -c:v copy -c:a aac -b:a 320k \
    -movflags +faststart -shortest ../output/ted_bundy_final.mp4
  $PY qc.py ../output/ted_bundy_final.mp4
fi
