"""Writes output/asset_manifest.csv: used archival images, generated assets, excluded files."""
import csv, json
from collections import Counter
from common import ARCHIVAL, BUILD, OUT, load_json

CAT = load_json(ARCHIVAL / "selected" / "catalog.json")
TL = load_json(BUILD / "timeline.json")
uses = Counter()
for s in TL["shots"]:
    p = s["params"]
    if s["type"] in ("archive", "victim"):
        uses[p["img"]] += 1
    if s["type"] == "namelist":
        for r in p["rows"]:
            if r[3]:
                uses[r[3]] += 1

EXCLUDED = [
    ("Cafe_Coffee_Day_in_Salt_Lake_Kolkata_01/10.jpg", "Wrong place: Salt Lake, Kolkata (India), not Salt Lake City"),
    ("Pearland__Texas__*.jpg (5 files)", "Irrelevant: modern aerial photos of Pearland, Texas"),
    ("The_modulus__1922_.jpg", "Irrelevant: 1922 yearbook group photo"),
    ("Regional_ministers..._Sudan_1977_.jpg", "Irrelevant: Sudanese government poster"),
    ("Pekka_Siitoin...arrested_in_1977 (2 files)", "Misleading: an unrelated 1977 arrest in Finland"),
    ("Day_216_-_West_Midlands_Police..., A_Rover_police_car...", "Wrong country: UK police cars"),
    ("Santa_Fe_County_New_Mexico_Administrative_Offices.jpg", "Irrelevant location"),
    ("East-and-north-elevations-1-looking-SE-1024x607.jpg", "Unidentified building, no provenance"),
    ("The_Washington_Star_Building.jpg", "Not connected to the story"),
    ("Salt_Lake_City_Trolley_Square_2022 (2 files)", "Modern (2022) and not connected to the case"),
    ("Brigham_Young_Forest_Farmhouse_2019.jpg", "Not connected to the case"),
    ("Seattle_Park_Board_circa_1970s.jpg", "Unidentified private individuals"),
    ("Volkswagen_Beetle_-_Bangkok_Thailand.jpg", "Thai street scene; better US-style alternatives available"),
    ("Arlington_County_Police_Department_cars_1970s.gif.jpg", "Too small (288x90)"),
    ("1970_Volkswagen_Beetle_1200_Rear.jpg, 1972_Volkswagen_Beetle_1.6_Front.jpg", "Redundant generic Beetles (UK plates)"),
    ("Bundy_and_Dillinger_Car.jpg", "Redundant: same museum car, poorer view"),
    ("Denise_Naslund..._17_July_1974.jpg", "Not named in this script; not used to avoid unexplained victim images"),
    ("Ted_Bundy_1988_mugshot.jpg duplicates, numbered copies (001_..007_)", "Byte-identical duplicates removed"),
]
OUT.mkdir(exist_ok=True)
with open(OUT / "asset_manifest.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["asset_id", "type", "status", "times_used", "local_path", "original_file", "caption_on_screen", "date", "creator_or_source", "licence", "notes"])
    for k, m in CAT.items():
        w.writerow([k, "archival image", "USED" if uses[k] else "NOT USED", uses[k], "assets/archival/" + m["file"], m["source_file"], m["caption"],
                    m["date"], m["credit"], m["licence"], "From user-supplied TedBundy_Chronological_Pack.zip (Wikimedia Commons downloads); licence to be confirmed on each Commons page before publication"])
    rows = [
        ("VO-01", "narration (synthetic voice)", "USED", "", "build/voice_raw.wav", "", "", "", "Kokoro-82M (hexgrad) via kokoro-onnx", "Apache-2.0", "Disclosed on end card; consider YouTube 'altered or synthetic content' disclosure"),
        ("MUS-01", "original score (synthesized)", "USED", "", "build/music.wav", "", "", "", "this project (build_audio.py)", "Original work", "No third-party music"),
        ("SFX-01", "sound design (synthesized)", "USED", "", "build/sfx.wav", "", "", "", "this project (build_audio.py)", "Original work", "Not presented as authentic recordings"),
        ("MAP-01", "state boundaries", "USED", "", "assets/data/states-albers-10m.json", "", "", "2017", "US Census Bureau via us-atlas 3.0.1", "Public domain data; package ISC", ""),
        ("FNT-01..03", "fonts", "USED", "", "/usr/share/fonts", "", "", "", "Bebas Neue (Dharma Type), Inter (R. Andersson), Courier Prime", "SIL OFL 1.1", ""),
        ("GFX-01", "illustrative graphics", "USED", "", "pipeline/render.py", "", "ILLUSTRATION tag on screen", "", "this project", "Original work", "Silhouettes, rain, streetlight, police lights, TV, spotlight, lineup, frames, board"),
        ("ASR-01", "speech recognition model (QC only)", "QC ONLY", "", "/opt/models/sherpa-onnx-whisper-small.en", "", "", "", "OpenAI Whisper small.en (sherpa-onnx export)", "MIT", "Used only to verify intelligibility"),
        ("PEX-*", "Pexels music/SFX/B-roll", "NOT OBTAINED", "", "", "", "", "", "", "", "pexels.com is blocked by this environment's network policy"),
    ]
    for r in rows:
        w.writerow(r)
    for name, why in EXCLUDED:
        w.writerow(["EXCLUDED", "pack image", "EXCLUDED", 0, "assets/archival/pack/...", name, "", "", "", "", why])
print(sum(1 for k in CAT if uses[k]), "archival images used,", sum(uses.values()), "placements")
