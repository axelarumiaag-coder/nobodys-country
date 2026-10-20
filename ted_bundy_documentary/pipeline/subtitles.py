"""Subtitle phrases from the narration timing; writes output/ted_bundy_subtitles.srt."""
import re
from common import BUILD, OUT, load_json

KEYWORDS = {"trust.", "Ted", "Bundy", "frightening.", "disappearing.", "1974,", "Utah", "Volkswagen", "Beetle.",
            "kidnapping.", "twice", "Colorado.", "January", "1978,", "two", "young", "women.", "Pensacola.", "spectacle.",
            "1979,", "murders.", "1989,", "executed", "1970s,", "help."}
KEY_PAIRS = {("Ted", "Bundy")}  # 'Bundy' alone stays white; only the full name is accented
MAX_WORDS, MAX_CHARS = 4, 26


def build_chunks(vt):
    chunks = []
    for line in vt["lines"]:
        words = line["words"]
        cur = []
        for i, w in enumerate(words):
            cur.append(w)
            text = " ".join(x["w"] for x in cur)
            nxt = words[i + 1]["w"] if i + 1 < len(words) else None
            brk = (re.search(r"[,.?;:]$", w["w"]) and len(cur) >= 2) or len(cur) >= MAX_WORDS or \
                (nxt and len(text) + 1 + len(nxt) > MAX_CHARS) or nxt is None
            if brk:
                chunks.append({"line": line["index"], "words": cur}); cur = []
    # keyword flags (Bundy only red when it follows Ted)
    for c in chunks:
        ws = c["words"]
        c["words"] = []
        for j, w in enumerate(ws):
            key = w["w"] in KEYWORDS
            if w["w"] == "Bundy":
                key = j > 0 and ws[j - 1]["w"] == "Ted"
            c["words"].append({"w": w["w"], "start": w["start"], "end": w["end"], "key": key})
    for i, c in enumerate(chunks):
        c["start"] = c["words"][0]["start"] - 0.04
        last = c["words"][-1]["end"]
        nxt = chunks[i + 1]["words"][0]["start"] - 0.04 if i + 1 < len(chunks) else last + 1.0
        c["end"] = min(nxt, last + 0.45) if nxt - last > 0.45 else nxt
        c["text"] = " ".join(w["w"] for w in c["words"])
    return chunks


def srt_tc(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main():
    vt = load_json(BUILD / "voice_timing.json")
    chunks = build_chunks(vt)
    OUT.mkdir(exist_ok=True)
    with open(OUT / "ted_bundy_subtitles.srt", "w", encoding="utf-8") as f:
        for i, c in enumerate(chunks, 1):
            f.write(f"{i}\n{srt_tc(c['start'])} --> {srt_tc(c['end'])}\n{c['text']}\n\n")
    print(len(chunks), "subtitle cues")


if __name__ == "__main__":
    main()
