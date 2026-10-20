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
  # two-pass 6.4 Mb/s delivery encode (keeps the file under GitHub's 100 MB limit); the CRF-15 master stays in build/
  V="-c:v libx264 -preset slow -b:v 6400k -maxrate 9000k -bufsize 12000k -pix_fmt yuv420p -passlogfile ../build/x264pass"
  ffmpeg -y -loglevel error -i ../build/video_final.mp4 $V -pass 1 -an -f null -
  ffmpeg -y -loglevel error -i ../build/video_final.mp4 -i ../build/mix.wav $V -pass 2 -c:a aac -b:a 320k \
    -movflags +faststart -shortest ../output/ted_bundy_final.mp4
  $PY qc.py ../output/ted_bundy_final.mp4
fi
