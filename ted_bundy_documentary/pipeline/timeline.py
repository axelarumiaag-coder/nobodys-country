"""Chronological shot list, anchored to the actual narration word timings.

Anchors: "L<line>w<word>" = start of that narration word (0-based), "L<line>e" = end
of that line, or a float in seconds. Each shot runs until the next shot starts.
Writes build/timeline.json (render + audio input) and output/chronological_timeline.csv.
"""
import csv, re
from common import BUILD, OUT, load_json, save_json, ARCHIVAL

T = load_json(BUILD / "voice_timing.json")
END_CARD_LEN = 6.4
TAIL = 1.2


def at(anchor, off=0.0):
    if isinstance(anchor, (int, float)):
        return float(anchor) + off
    m = re.fullmatch(r"L(\d+)(?:w(\d+)|(e))", anchor)
    line = T["lines"][int(m.group(1))]
    t = line["end"] if m.group(3) else line["words"][int(m.group(2))]["start"]
    return t + off


def typed(lines, t0, cps=26, gap=0.15):
    """Typing schedule for case-file cards: [(text, start, end)] (absolute seconds)."""
    out, t = [], t0
    for ln in lines:
        if isinstance(ln, tuple):  # (text, anchor) -> start typing at that anchor
            ln, t = ln[0], max(t, at(ln[1]))
        out.append([ln, round(t, 3), round(t + len(ln) / cps, 3)])
        t += len(ln) / cps + gap
    return out


GEN = "generated (this pipeline)"
MAP = "generated map; boundaries: US Census Bureau via us-atlas 3.0.1 (public domain/ISC)"

# (anchor, chapter, period, type, params, transition, note, photo_slot)
S = []


def shot(anchor, chapter, period, kind, params=None, trans="cut", note="", slot=None, subs=True, illus=False, sfx=None):
    S.append(dict(anchor=anchor, chapter=chapter, period=period, type=kind, params=params or {},
                  transition=trans, note=note, photo_slot=slot, subs=subs, illustrative=illus, sfx=sfx or []))


# ---------------- HOOK (deliberate flash-forward to the public image) ----------------
shot(0.0, 0, "Hook", "silhouette", {"mood": "warm", "z": (1.0, 1.07)}, "dip", "Cold open: the trustworthy public image (illustrative silhouette, no likeness)", "hook_portrait", illus=True)
shot("L0w6", 0, "Hook", "word", {"text": "TRUST", "accent": "?"}, "flash", "Hard cut on 'trust'", sfx=["hit_small"])
shot("L1w0", 0, "Hook", "silhouette", {"mood": "cold", "z": (1.10, 1.02)}, "cut", "Same figure, light turns cold: the mask", "hook_portrait", illus=True, sfx=["riser"])
shot("L1w6", 0, "Hook", "name", {}, "cut", "Name reveal; red slash on 'frightening'", sfx=["impact"])
shot("L1e", 0, "Hook", "title", {"text": "THE PERFECT MASK"}, "flash", "Title card in the breath before Chapter 1", subs=False, sfx=["impact_big"])

# ---------------- CHAPTER 1: EARLY LIFE AND BACKGROUND ----------------
shot("L2w0", 1, "Early life – early 1970s", "chapter", {"num": "01", "title": "THE PUBLIC IMAGE", "period": "1946 — 1973"}, "dip", "Chapter card", sfx=["whoosh"])
shot("L2w3", 1, "Early 1970s", "date", {"big": "EARLY 1970s", "sub": "SEATTLE, WASHINGTON"}, "cut", "Period stamp", sfx=["hit_small"])
shot("L2w4", 1, "Early 1970s", "map", {"cam": [["state", "Washington", 3.2], ["city", "Seattle", 6.2]], "hl": ["Washington"],
      "pins": [["Seattle", "SEATTLE, WASHINGTON", "UNIVERSITY OF WASHINGTON", 0.25]]}, "cut", "University years in Seattle", "uw_campus")
shot("L2w10", 1, "1972", "casefile", {"head": "CASE NOTES — BACKGROUND", "lines": typed(
      ["SUBJECT:  THEODORE ROBERT BUNDY", "BORN:     NOVEMBER 24, 1946", "1972:     B.A. PSYCHOLOGY,", "          UNIVERSITY OF WASHINGTON"], at("L2w10"), cps=34)},
      "cut", "Verified background facts (editorial graphic, not a police document)")
shot("L3w2", 1, "Early 1970s", "word", {"text": "INTELLIGENT"}, "cut", "Kinetic word", "portrait_1970s", subs=False)
shot("L3w4", 1, "Early 1970s", "word", {"text": "CHARMING"}, "cut", "Kinetic word", subs=False)
shot("L4w1", 1, "Early 1970s", "silhouette", {"mood": "shadow", "z": (1.04, 1.12)}, "cut", "'Behind that image' — face falls into shadow", illus=True)
shot("L4w4", 1, "1974", "frames", {}, "cut", "Empty frames fading — disappearances (no victim likeness used)", sfx=["drone_dip"])

# ---------------- CHAPTER 2: THE FIRST KNOWN CASES 1974–1975 ----------------
shot(at("L4e", 0.1), 2, "1974", "chapter", {"num": "02", "title": "THE FIRST KNOWN CASES", "period": "1974 — 1975"}, "dip", "Chapter card", sfx=["whoosh"])
shot("L5w1", 2, "1974", "date", {"big": "1974", "sub": "WASHINGTON · OREGON"}, "cut", "Year stamp", sfx=["impact"])
shot("L5w2", 2, "1974", "map", {"cam": [["xy", 120, 95, 3.4], ["xy", 125, 100, 3.9]], "hl": ["Washington", "Oregon"],
      "label": ["PACIFIC NORTHWEST", "1974"]}, "cut", "Region of the 1974 cases")
shot("L5w7", 2, "1974", "streetlight", {}, "cut", "Atmosphere: fear (illustrative)", illus=True)
shot("L6w0", 2, "1974", "casefile", {"head": "WITNESS DESCRIPTIONS — 1974", "lines": typed(
      [("— POLITE", "L6w3"), ("— CLEAN-CUT", "L6w4")], at("L6w0"), cps=22)}, "cut", "Witness descriptions, as narrated")
shot("L6w6", 2, "July 1974", "silhouette", {"mood": "sling", "z": (1.0, 1.06)}, "cut", "Lake Sammamish witnesses: man named 'Ted', arm in a sling (illustrative)", illus=True)
shot("L6w8", 2, "July 1974", "casefile", {"head": "WITNESS DESCRIPTIONS — 1974", "lines": typed(
      ["— POLITE", "— CLEAN-CUT", ("— ASKED WOMEN FOR HELP", "L6w9"), "  ARM IN A SLING · LAKE SAMMAMISH, JULY 1974"], at("L6w8") - 0.6, cps=60)},
      "cut", "Documented ruse")
shot("L7w0", 2, "1974–1975", "board", {}, "cut", "Investigators unable to link cases across states", sfx=["hit_small"])
shot("L7w6", 2, "Fall 1974", "map", {"cam": [["xy", 220, 120, 2.7], ["xy", 260, 160, 2.9]], "hl": ["Washington", "Utah"],
      "route": [["Seattle", "Salt Lake City"], 0.05, 0.55],
      "pins": [["Salt Lake City", "SALT LAKE CITY, UTAH", "FALL 1974 · LAW SCHOOL", 0.5]]}, "cut", "Moves to Utah", sfx=["whoosh"])
shot("L8w0", 2, "16 Aug 1975", "date", {"big": "AUGUST 16, 1975", "sub": "GRANGER, UTAH"}, "flash", "Date of the traffic stop", sfx=["impact"])
shot("L8w2", 2, "16 Aug 1975", "map", {"cam": [["state", "Utah", 4.6], ["city", "Granger", 7.0]], "hl": ["Utah"],
      "pins": [["Granger", "GRANGER, UTAH", "NEAR SALT LAKE CITY", 0.2]]}, "cut", "Location of the 1975 arrest")
shot("L8w8", 2, "16 Aug 1975", "policelights", {}, "cut", "Traffic stop at night (illustrative)", illus=True, sfx=["siren_hint"])
shot("L8w11", 2, "1975", "beetle", {}, "cut", "Volkswagen Beetle (line illustration, not his car)", "vw_beetle", illus=True)

# ---------------- CHAPTER 3: CONVICTION AND ESCAPES 1975–1977 ----------------
shot("L9w0", 3, "1975", "chapter", {"num": "03", "title": "CONVICTION AND ESCAPES", "period": "1975 — 1977"}, "dip", "Chapter card", sfx=["whoosh"])
shot("L9w3", 3, "Aug 1975", "casefile", {"head": "REPORTED FOUND IN THE CAR — 1975", "lines": typed(
      ["SKI MASK", "CROWBAR", "HANDCUFFS", "ROPE"], at("L9w3"), cps=30, gap=0.08)}, "cut", "Items reported found by Utah police")
shot("L9w8", 3, "1976", "stamp", {"stamp": "CONVICTED", "top": "UTAH · 1976", "bottom": "AGGRAVATED KIDNAPPING"}, "cut", "Kidnapping conviction (1976)", sfx=["stamp"])
shot("L10w0", 3, "1976–1977", "timeline", {"from": 1975.6, "to": 1977.3}, "cut", "Time moves on", sfx=["drone_dip"])
shot("L11w0", 3, "1977", "date", {"big": "1977", "sub": "COLORADO"}, "flash", "Year stamp", sfx=["impact"])
shot("L11w2", 3, "7 Jun 1977", "map", {"cam": [["state", "Colorado", 4.6], ["city", "Aspen", 8.0]], "hl": ["Colorado"],
      "pins": [["Aspen", "ESCAPE 1 · JUNE 7, 1977", "PITKIN COUNTY COURTHOUSE, ASPEN", 0.12]]}, "cut", "First escape: courthouse window", sfx=["hit_small"])
shot("L11w5", 3, "30 Dec 1977", "map", {"cam": [["city", "Glenwood Springs", 9.5], ["city", "Glenwood Springs", 8.4]], "hl": ["Colorado"],
      "pins": [["Aspen", "", "", 0.0], ["Glenwood Springs", "ESCAPE 2 · DECEMBER 30, 1977", "GARFIELD COUNTY JAIL, GLENWOOD SPRINGS", 0.06]]}, "flash", "Second escape: jail ceiling", sfx=["hit_small"])

# ---------------- CHAPTER 4: FLORIDA AND FINAL ARREST 1978 ----------------
shot("L12w0", 4, "Jan 1978", "chapter", {"num": "04", "title": "FLORIDA", "period": "1978"}, "dip", "Chapter card", sfx=["whoosh"])
shot("L12w2", 4, "Jan 1978", "map", {"cam": [["xy", 520, 330, 1.75], ["xy", 600, 380, 1.95]], "hl": ["Colorado", "Florida"],
      "route": [["Glenwood Springs", "Tallahassee"], 0.0, 0.7], "pins": [["Tallahassee", "TALLAHASSEE, FLORIDA", "JANUARY 1978", 0.6]],
      "note": "ROUTE SIMPLIFIED"}, "cut", "To Florida (route simplified)", sfx=["whoosh"])
shot("L12w5", 4, "15 Jan 1978", "date", {"big": "JANUARY 15, 1978", "sub": "TALLAHASSEE, FLORIDA"}, "flash", "Date of the Chi Omega attack", sfx=["impact_big"])
shot("L12w8", 4, "15 Jan 1978", "location", {"big": "CHI OMEGA", "sub": "SORORITY HOUSE · FLORIDA STATE UNIVERSITY"}, "cut", "Location card (no images of the scene)")
shot("L12w12", 4, "15 Jan 1978", "memorial", {"names": ["LISA LEVY", "MARGARET BOWMAN"], "sub": "KILLED JANUARY 15, 1978"}, "dip", "Victims named respectfully", subs=True, sfx=["drone_dip"])
shot("L13w0", 4, "15 Feb 1978", "map", {"cam": [["city", "Tallahassee", 5.0], ["city", "Pensacola", 7.5]], "hl": ["Florida"],
      "pins": [["Tallahassee", "", "", 0.0], ["Pensacola", "PENSACOLA, FLORIDA", "FEBRUARY 15, 1978", 0.3]]}, "cut", "Pensacola arrest location")
shot("L13w4", 4, "15 Feb 1978", "stamp", {"stamp": "ARRESTED", "top": "PENSACOLA, FLORIDA", "bottom": "FEBRUARY 15, 1978"}, "flash", "Final arrest", sfx=["stamp"])

# ---------------- CHAPTER 5: THE TRIALS 1979 ----------------
shot("L14w0", 5, "1979", "chapter", {"num": "05", "title": "THE TRIALS", "period": "1979"}, "dip", "Chapter card", sfx=["whoosh"])
shot("L14w3", 5, "1979", "tv", {"label": "TELEVISED NATIONWIDE", "sub": "MIAMI, FLORIDA · 1979"}, "cut", "Televised trial (illustrative TV set)", "trial_1979", illus=True)
shot("L15w0", 5, "1979", "spotlight", {"wide": False}, "cut", "Represented himself (illustrative stage light)", "trial_1979", illus=True)
shot("L15w4", 5, "1979", "spotlight", {"wide": True}, "cut", "Courtroom as a stage — pull back", illus=True)
shot("L16w0", 5, "July 1979", "date", {"big": "JULY 1979", "sub": "MIAMI, FLORIDA"}, "cut", "Verdict month", sfx=["impact"])
shot("L16w4", 5, "July 1979", "stamp", {"stamp": "GUILTY", "top": "CHI OMEGA MURDERS · MIAMI, FLORIDA", "bottom": "JULY 1979", "late": "SENTENCED TO DEATH · JULY 31, 1979"}, "cut", "Conviction", sfx=["stamp"])

# ---------------- CHAPTER 6: PRISON AND EXECUTION 1980–1989 ----------------
shot(at("L16e", 0.15), 6, "1980–1989", "chapter", {"num": "06", "title": "PRISON AND EXECUTION", "period": "1980 — 1989"}, "dip", "Chapter card", sfx=["whoosh"])
shot("L17w1", 6, "1980–1989", "years", {"from": 1980, "to": 1989}, "cut", "A decade on death row", "doc_1980", sfx=["ticks"])
shot("L17w4", 6, "24 Jan 1989", "execdate", {"big": "JANUARY 24, 1989", "sub": "EXECUTED · FLORIDA STATE PRISON, NEAR STARKE"}, "cut", "Execution date — slow, quiet", sfx=["impact_soft"])
shot("L18w0", 6, "Reflection", "silhouette", {"mood": "fade", "z": (1.12, 1.18)}, "dip", "Callback to the opening image, dissolving", illus=True)
shot("L19w0", 6, "Reflection", "question", {"line": 19, "red": ["extreme", "violence"]}, "dip", "The central question, word-synced", subs=False, sfx=["riser_soft"])
shot("L20w0", 6, "Reflection", "statement", {"line": 20, "red": ["character."]}, "cut", "Closing line 1", subs=False)
shot("L21w0", 6, "Reflection", "statement", {"line": 21, "red": ["whole", "story."]}, "cut", "Closing line 2", subs=False)
shot(at("L21e", 1.1), 6, "End", "endcard", {"q": "WHY DO YOU THINK HIS PUBLIC IMAGE FOOLED SO MANY PEOPLE?",
      "cta": "Share your view in the comments.", "mem": "In memory of the victims and their families."}, "dip", "Comment prompt + memorial", subs=False)


def main():
    total = at("L21e", 1.1) + END_CARD_LEN + TAIL
    starts = [round(at(s["anchor"]) if not isinstance(s["anchor"], float) else s["anchor"], 3) for s in S]
    assign = {}
    ap = ARCHIVAL / "archival_assignments.json"
    if ap.exists():
        assign = {k: v for k, v in load_json(ap).get("slots", {}).items() if v and (ARCHIVAL / v["file"]).exists()}
    shots = []
    for i, s in enumerate(S):
        st = starts[i]
        en = starts[i + 1] if i + 1 < len(S) else round(total, 3)
        assert en > st, (i, s["type"], st, en)
        d = dict(s, index=i + 1, start=st, end=en, duration=round(en - st, 3))
        d.pop("anchor")
        if s["photo_slot"] and s["photo_slot"] in assign:
            d["photo"] = assign[s["photo_slot"]]
        shots.append(d)
    chapters = {1: "THE PUBLIC IMAGE", 2: "THE FIRST KNOWN CASES", 3: "CONVICTION AND ESCAPES", 4: "FLORIDA", 5: "THE TRIALS", 6: "PRISON AND EXECUTION"}
    save_json(BUILD / "timeline.json", {"duration": round(total, 3), "fps": 30, "shots": shots, "chapters": chapters})
    OUT.mkdir(exist_ok=True)
    with open(OUT / "chronological_timeline.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["shot", "start_tc", "end_tc", "start_s", "end_s", "duration_s", "chapter", "historical_period", "visual_type",
                    "transition", "asset_path", "asset_status", "subtitles", "narration_during_shot", "notes"])
        for d in shots:
            words = [x["w"] for l in T["lines"] for x in l["words"] if d["start"] <= x["start"] < d["end"]]
            if "photo" in d:
                asset, status = "assets/archival/" + d["photo"]["file"], "ARCHIVAL (user-verified)"
            elif d["type"] == "map":
                asset, status = "assets/data/states-albers-10m.json", MAP
            else:
                asset, status = f"generated:{d['type']}", GEN + (" — ILLUSTRATIVE, labelled on screen" if d["illustrative"] else "")
            w.writerow([d["index"], tc(d["start"]), tc(d["end"]), d["start"], d["end"], d["duration"],
                        f"{d['chapter']} {chapters.get(d['chapter'], 'HOOK')}", d["period"], d["type"], d["transition"], asset, status,
                        "on" if d["subs"] else "off (text is the visual)", " ".join(words), d["note"]])
    durs = [d["duration"] for d in shots]
    print(f"{len(shots)} shots, total {total:.2f}s, shot length min {min(durs):.2f} / median {sorted(durs)[len(durs)//2]:.2f} / max {max(durs):.2f}")


def tc(t):
    return f"{int(t // 60):02d}:{t % 60:06.3f}"


if __name__ == "__main__":
    main()
