"""Shared paths and constants for the Ted Bundy documentary pipeline."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent.parent
PIPE = ROOT / "pipeline"
BUILD = ROOT / "build"
OUT = ROOT / "output"
ARCHIVAL = ROOT / "assets" / "archival"
MODELS = Path("/opt/models")

W, H, FPS = 1920, 1080, 25
SR = 48000
VOICE_OFFSET = 0.30  # seconds of drone before the first word

FONTS = {
    "display": "/usr/share/fonts/opentype/bebas-neue/BebasNeue-Bold.otf",
    "sans_black": "/usr/share/fonts/opentype/inter/Inter-Black.otf",
    "sans_xbold": "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf",
    "sans_bold": "/usr/share/fonts/opentype/inter/Inter-Bold.otf",
    "sans_semi": "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf",
    "sans_med": "/usr/share/fonts/opentype/inter/Inter-Medium.otf",
    "sans": "/usr/share/fonts/opentype/inter/Inter-Regular.otf",
    "mono": "/usr/share/fonts/opentype/courier-prime/Courier Prime.otf",
    "mono_bold": "/usr/share/fonts/opentype/courier-prime/Courier Prime Bold.otf",
}

# Palette: black / charcoal / muted grey with a restrained deep red
BG = (11, 11, 12)
CHAR = (24, 24, 26)
GREY = (120, 120, 124)
LIGHT = (232, 230, 226)
RED = (178, 24, 30)
RED_SOFT = (214, 58, 52)


def load_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def save_json(p, data):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
