#!/usr/bin/env python3
"""
Ted Bundy chronological media pack downloader.

Downloads images from Wikimedia Commons search results only when Commons reports
a file URL. Saves the page URL, license/credit metadata and source information.
It does NOT download YouTube videos or copyrighted news/documentary footage.
Run with Python 3.10+ and internet access:
    py -m pip install requests
    py descarrega_material.py
"""
from pathlib import Path
from urllib.parse import quote
import csv, time, requests

ROOT = Path(__file__).resolve().parent
HEADERS = {"User-Agent": "ChronologicalTrueCrimeResearchPack/1.0 (personal research)"}
API = "https://commons.wikimedia.org/w/api.php"

STAGES = [
    ("01_Origens_1960s-1973", "1960s–1973", [
        "Ted Bundy young", "University of Washington 1970s", "Seattle 1970s"
    ]),
    ("02_Primers_casos_1974-1975", "1974–1975", [
        "Ted Bundy 1974", "Ted Bundy Volkswagen Beetle", "Salt Lake City 1975"
    ]),
    ("03_Detencions_i_fugides_1976-1977", "1976–1977", [
        "Ted Bundy 1976", "Ted Bundy Aspen 1977", "Colorado courthouse 1970s"
    ]),
    ("04_Florida_i_captura_1978", "1978", [
        "Ted Bundy prison Florida", "Ted Bundy wanted poster", "Ted Bundy Pensacola"
    ]),
    ("05_Judici_1979", "1979", [
        "Ted Bundy in court", "TedBundyincustody", "Ted Bundy trial"
    ]),
    ("06_Preso_i_ultims_anys_1980-1989", "1980–1989", [
        "TedBundy1980DOCPhotoColor", "Ted Bundy 1988 mugshot", "Bundy Hagmaier"
    ]),
    ("07_Context_i_broll_1970s", "B-roll", [
        "1970s Seattle", "1970s police car", "1970s newspaper printing press",
        "1970s courthouse", "1970s Volkswagen Beetle"
    ]),
]
VIDEO_SEARCHES = [
    ("1974–1975", "Ted Bundy 1974 original television news archive"),
    ("1976–1977", "Ted Bundy Aspen escape 1977 archival news footage"),
    ("1978", "Ted Bundy arrest Pensacola 1978 original news footage"),
    ("1979", "Ted Bundy trial 1979 original courtroom footage"),
    ("1980–1989", "Ted Bundy 1989 news archive execution coverage"),
    ("B-roll", "1970s Seattle archival footage"),
    ("B-roll", "1970s American police car archival footage"),
    ("B-roll", "1970s newspaper newsroom archival footage"),
]
def commons_search(query, limit=10):
    params = {
        "action":"query", "format":"json", "generator":"search",
        "gsrsearch": f"filetype:bitmap {query}", "gsrnamespace": 6,
        "gsrlimit": limit, "prop":"imageinfo", "iiprop":"url|extmetadata",
        "iiurlwidth": 1800
    }
    r = requests.get(API, params=params, headers=HEADERS, timeout=30)
    r.raise_for_status()
    pages = r.json().get("query", {}).get("pages", {})
    return list(pages.values())

def metadata(page):
    ii = (page.get("imageinfo") or [{}])[0]
    ext = ii.get("extmetadata", {})
    def val(key):
        return ext.get(key, {}).get("value", "")
    return {
        "title": page.get("title","").replace("File:",""),
        "download_url": ii.get("url",""),
        "page_url": ii.get("descriptionurl",""),
        "license": val("LicenseShortName"),
        "artist": val("Artist"),
        "credit": val("Credit"),
        "usage_terms": val("UsageTerms"),
        "attribution_required": val("AttributionRequired"),
    }

def safe_name(name):
    return "".join(c if c.isalnum() or c in "._- " else "_" for c in name).strip().replace(" ","_")

def main():
    sess = requests.Session()
    sess.headers.update(HEADERS)
    index = []
    downloaded = 0
    seen = set()
    for folder, period, queries in STAGES:
        dest = ROOT / folder
        dest.mkdir(parents=True, exist_ok=True)
        for query in queries:
            try:
                pages = commons_search(query, limit=8)
            except Exception as e:
                print(f"[WARN] Search failed for {query}: {e}")
                continue
            for page in pages:
                item = metadata(page)
                if not item["download_url"] or item["download_url"] in seen:
                    continue
                seen.add(item["download_url"])
                # Only download file types suitable as still images.
                url = item["download_url"]
                if not url.lower().split("?")[0].endswith((".jpg",".jpeg",".png",".webp",".tif",".tiff")):
                    continue
                item.update({"period":period, "search_term":query, "folder":folder})
                try:
                    resp = sess.get(url, timeout=45)
                    resp.raise_for_status()
                    content_type = resp.headers.get("content-type","")
                    if not content_type.startswith("image/") or len(resp.content) < 5000:
                        continue
                    filename = f"{downloaded+1:03d}_{safe_name(item['title'])}"
                    suffix = ".jpg" if "jpeg" in content_type else (".png" if "png" in content_type else Path(url.split("?")[0]).suffix or ".img")
                    path = dest / (filename + suffix)
                    path.write_bytes(resp.content)
                    item["local_file"] = str(path.relative_to(ROOT))
                    downloaded += 1
                    index.append(item)
                    print(f"[OK] {item['local_file']}")
                    time.sleep(0.15)
                except Exception as e:
                    print(f"[WARN] Download failed: {item['title']}: {e}")
    with (ROOT / "08_Llicencies" / "INDEX_IMATGES_DESCARREGADES.csv").open("w", newline="", encoding="utf-8-sig") as f:
        (ROOT / "08_Llicencies").mkdir(exist_ok=True)
        fields = ["period","local_file","title","page_url","license","artist","credit","usage_terms","attribution_required","search_term","download_url"]
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for item in index:
            w.writerow({k:item.get(k,"") for k in fields})
    with (ROOT / "07_Videos_enllacos.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["ordre","periode","consulta","enllac","nota"])
        for i,(period,query) in enumerate(VIDEO_SEARCHES,1):
            w.writerow([i,period,query,"https://www.youtube.com/results?search_query="+quote(query),
                        "Enllaç de cerca; comprova drets i no descarreguis clips sense autorització."])
    print(f"\nFet: {downloaded} imatges descarregades. Revisa sempre les llicències abans de publicar.")

if __name__ == "__main__":
    main()
