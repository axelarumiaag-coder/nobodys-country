"""Local speech recognition (Whisper small.en via sherpa-onnx) used for QC of the narration."""
import sys, numpy as np, soundfile as sf, sherpa_onnx
from scipy.signal import resample_poly

M = "/opt/models/sherpa-onnx-whisper-small.en/small.en-"
_rec = None

def recognizer():
    global _rec
    if _rec is None:
        _rec = sherpa_onnx.OfflineRecognizer.from_whisper(
            encoder=M + "encoder.int8.onnx", decoder=M + "decoder.int8.onnx",
            tokens=M + "tokens.txt", language="en", task="transcribe", num_threads=4)
    return _rec

def transcribe(samples, sr):
    if samples.ndim > 1:
        samples = samples.mean(axis=1)
    if sr != 16000:
        samples = resample_poly(samples, 16000, sr)
    r = recognizer()
    out = []
    for i in range(0, len(samples), 16000 * 25):  # whisper window is 30 s
        s = r.create_stream()
        s.accept_waveform(16000, samples[i:i + 16000 * 25].astype(np.float32))
        r.decode_stream(s)
        out.append(s.result.text.strip())
    return " ".join(out)

if __name__ == "__main__":
    for p in sys.argv[1:]:
        a, sr = sf.read(p, dtype="float32")
        print(p.split("/")[-1], "->", transcribe(a, sr))
