"""Asset description per shot for the timeline CSV."""
from common import ARCHIVAL, load_json

CAT = load_json(ARCHIVAL / "selected" / "catalog.json")
MAP = "generated map; boundaries: US Census Bureau via us-atlas 3.0.1"


def asset_of(d):
    p = d["params"]
    if d["type"] in ("archive", "victim"):
        m = CAT[p["img"]]
        return "assets/archival/" + m["file"], f"ARCHIVAL · {m['caption']} · {m['credit']} · {m['licence']}"
    if d["type"] == "namelist":
        imgs = [r[3] for r in p["rows"] if r[3]]
        return "; ".join("assets/archival/" + CAT[i]["file"] for i in imgs), "ARCHIVAL portraits (newspaper, 1974) + generated text"
    if d["type"] == "map":
        return "assets/data/states-albers-10m.json", MAP
    return f"generated:{d['type']}", "generated (this pipeline)" + (" — ILLUSTRATIVE, labelled on screen" if d["illustrative"] else "")
