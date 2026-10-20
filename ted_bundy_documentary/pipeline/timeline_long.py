"""Long-cut shot list (~26 min), anchored to the narration word timings.

PLAN maps "chapter.paragraph" to visuals. Each visual starts at the paragraph start,
at a word ("at": first word in the paragraph starting with that text, searched after
the previous anchor), or is spread over the remaining sentences. Shots longer than
MAX_VIS / MAX_TEXT are split with a reframed variant or a chapter B-roll insert, so
the edit keeps moving without inventing content.
Writes build/timeline.json and output/chronological_timeline.csv.
"""
import csv, re
from common import BUILD, OUT, load_json, save_json

T = load_json(BUILD / "voice_timing.json")
LINES = T["lines"]
MAX_VIS, MAX_TEXT, MIN_SHOT = 5.6, 7.0, 1.2
END_CARD_LEN, TAIL = 8.0, 1.5

CHAPTERS = [  # (kicker, title, period, tag)
    ("INTRODUCTION", "", "Overview 1946–1989", "INTRODUCTION"),
    ("CHAPTER 01", "A CHILDHOOD BUILT ON SECRETS", "1946 — 1960s", "A CHILDHOOD BUILT ON SECRETS"),
    ("CHAPTER 02", "THE MAKING OF A RESPECTABLE YOUNG MAN", "1965 — 1974", "A RESPECTABLE YOUNG MAN"),
    ("CHAPTER 03", "THE DISAPPEARANCES BEGIN", "1974", "THE DISAPPEARANCES BEGIN"),
    ("CHAPTER 04", "A SUSPECT EMERGES", "1974 — 1976", "A SUSPECT EMERGES"),
    ("CHAPTER 05", "TWO ESCAPES AND A NEW WAVE OF VIOLENCE", "1977 — 1978", "TWO ESCAPES"),
    ("CHAPTER 06", "THE FINAL ARREST", "FEBRUARY 1978", "THE FINAL ARREST"),
    ("CHAPTER 07", "THE TRIALS THAT SHOCKED AMERICA", "1979 — 1980", "THE TRIALS"),
    ("CHAPTER 08", "CONFESSIONS, MANIPULATION AND THE UNKNOWN VICTIMS", "1980 — 1989", "CONFESSIONS"),
    ("CHAPTER 09", "THE END OF TED BUNDY", "1989", "THE END OF TED BUNDY"),
    ("CONCLUSION", "THE LEGACY OF A SERIAL KILLER", "", "CONCLUSION"),
]


# ---------------------------------------------------------------- visual constructors
def V(kind, at=None, **params):
    opts = {k: params.pop(k) for k in ("sfx", "illus", "subs", "note", "trans") if k in params}
    return dict(kind=kind, at=at, params=params, **opts)


def ph(img, at=None, **kw): return V("archive", at, img=img, **kw)
def date(big, sub="", at=None, **kw): return V("date", at, big=big, sub=sub, sfx=kw.pop("sfx", ["impact"]), **kw)
def loc(big, sub, at=None, **kw): return V("location", at, big=big, sub=sub, **kw)
def word(text, at=None, **kw): return V("word", at, text=text, subs=False, **{"sfx": ["hit_small"], **kw})
def sil(mood, at=None, **kw): return V("silhouette", at, mood=mood, illus=True, **kw)
def case(head, lines, at=None, **kw): return V("casefile", at, head=head, lines=lines, **kw)
def stamp(st, top, bottom="", at=None, **kw): return V("stamp", at, stamp=st, top=top, bottom=bottom, **{"sfx": ["stamp"], **kw})
def say(sent=0, at=None, **kw): return V("say", at, sent=sent, **{"subs": False, **kw})
def ask(sent=0, at=None, **kw): return V("question", at, sent=sent, subs=False, **kw)
def stack(items, at=None, **kw): return V("wordstack", at, items=items, **kw)
def board(cards=None, at=None, **kw): return V("board", at, cards=cards, **{"sfx": ["hit_small"], **kw})
def tv(label, sub, at=None): return V("tv", at, label=label, sub=sub, illus=True)
def mem(names, sub, at=None): return V("memorial", at, names=names, sub=sub, sfx=["drone_dip"])
def frames(at=None): return V("frames", at, sfx=["drone_dip"])
def rain(at=None): return V("rain", at, illus=True)
def street(at=None): return V("streetlight", at, illus=True)
def lights(at=None): return V("policelights", at, illus=True)
def spot(wide=False, at=None): return V("spotlight", at, wide=wide, illus=True)
def years(a, b, at=None): return V("years", at, **{"from": a, "to": b}, sfx=["ticks"])
def tl(a, b, at=None, **kw): return V("timeline", at, **{"from": a, "to": b}, **kw)


def mp(cam, hl=(), pins=(), route=None, label=None, at=None, note=None):
    p = {"cam": cam, "hl": list(hl), "pins": [list(x) for x in pins]}
    if route: p["route"] = route
    if label: p["label"] = label
    if note: p["note"] = note
    return V("map", at, sfx=["whoosh"] if route else [], **p)


US = [["xy", 487.5, 305, 1.75], ["xy", 470, 300, 1.95]]
WA = [["state", "Washington", 3.6], ["state", "Washington", 4.4]]
NW = [["xy", 110, 95, 3.0], ["xy", 115, 100, 3.5]]
UT = [["state", "Utah", 4.2], ["state", "Utah", 5.0]]
CO = [["state", "Colorado", 4.4], ["state", "Colorado", 5.2]]
FL = [["state", "Florida", 3.4], ["state", "Florida", 4.0]]
WEST = [["xy", 230, 150, 2.4], ["xy", 240, 160, 2.7]]

PLAN = {
    # ---------------- INTRODUCTION
    "0.0": [sil("warm", z=(1.0, 1.08)), stack([["INTELLIGENT", "intelligent"], ["POLITE", "polite"], ["ORDINARY", "ordinary"]], at="intelligent"),
            sil("cold", at="terrifying", z=(1.1, 1.02))],
    "0.1": [ph("seattle_first_ave"), stack([["STUDIED LAW", "studied"], ["WORKED IN POLITICS", "worked"], ["HELPED PEOPLE IN CRISIS", "helped"]], at="studied")],
    "0.2": [frames()],
    "0.3": [ph("bundy_headshot_1978", z=(1.0, 1.12)),
            V("title", "END", text="TED BUNDY", size=260, sub="THE LIFE AND CRIMES OF AMERICA'S MOST INFAMOUS SERIAL KILLER", subs=False, sfx=["impact_big"], trans="flash")],
    "0.4": [mp(US, hl=["Washington", "Oregon", "Utah", "Colorado", "Florida"], label=["SEVERAL STATES", "1974 — 1978"]),
            stamp("ESCAPED", "POLICE CUSTODY", "TWICE · 1977", at="escaping"), lights(at="continuing")],
    "0.5": [date("30", "MURDERS CONFESSED"), date("?", "THE TRUE NUMBER REMAINS UNKNOWN", at="although", sfx=["hit_small"])],
    "0.6": [sil("split", z=(1.0, 1.06)), ph("bundy_court_1979", at="It")],
    "0.7": [tl(1989.2, 1946.5, events={1946.9: "BORN", 1974.1: "FIRST KNOWN CASES", 1978.04: "FLORIDA", 1989.07: "EXECUTION"}),
            stack([["UNCERTAINTY", "uncertainty"], ["AMBITION", "ambition"], ["DARKNESS", "darkness"]], at="childhood")],
    # ---------------- 1 CHILDHOOD
    "1.0": [date("NOVEMBER 24, 1946", "BURLINGTON, VERMONT"),
            mp([["city", "Burlington", 5.0], ["city", "Burlington", 6.5]], hl=["Vermont"], pins=[["Burlington", "BURLINGTON, VERMONT", "BORN · NOVEMBER 24, 1946", 0.15]], at="Burlington")],
    "1.1": [case("CASE NOTES — EARLY LIFE", [["BIRTH NAME:  THEODORE ROBERT COWELL", "His"], ["MOTHER:      ELEANOR LOUISE COWELL", "mother,"],
                                             ["RAISED BY:   HIS MATERNAL GRANDPARENTS", "raised"], ["             (PHILADELPHIA)", "grandparents."]])],
    "1.2": [V("family"), word("THE TRUTH", at="Eventually,")],
    "1.3": [mp([["xy", 500, 160, 1.9], ["xy", 400, 140, 2.1]], hl=["Pennsylvania", "Washington"], route=[["Philadelphia", "Tacoma"], 0.05, 0.6],
               pins=[["Philadelphia", "", "", 0.0], ["Tacoma", "TACOMA, WASHINGTON", "EARLY 1950s", 0.55]]),
            date("BUNDY", "STEPFATHER: JOHNNIE BUNDY · 1951", at="married", sfx=["hit_small"])],
    "1.4": [rain(), sil("warm", at="identity", z=(1.0, 1.06))],
    "1.5": [sil("shadow", z=(1.04, 1.12)), word("PERCEPTION", at="perceived")],
    "1.6": [say(0), rain(at="Millions")],
    "1.7": [board([["EARLY LIFE", "1946 — 1960s"], ["SECRETS", "FAMILY"], ["LATER CRIMES", "1974 — 1978"], ["THE LINK", "UNCERTAIN"]])],
    "1.8": [sil("warm", z=(1.02, 1.1)), stack([["SUCCESSFUL", "successful,"], ["INTELLIGENT", "intelligent,"], ["SOCIALLY CAPABLE", "socially"]], at="successful,")],
    "1.9": [say(0)],
    "1.10": [say(0)],
    "1.11": [sil("warm", z=(1.08, 1.0)), word("TRUST", at="trust")],
    "1.12": [frames()],
    # ---------------- 2 RESPECTABLE YOUNG MAN
    "2.0": [ph("seattle_rowing_uw"), case("UNIVERSITY OF WASHINGTON", [["B.A. PSYCHOLOGY · 1972", "psychology."]], at="psychology.")],
    "2.1": [ph("seattle_university_way"), case("POLITICS — WASHINGTON STATE", [["REPUBLICAN PARTY CAMPAIGN WORK", "Republican"], ["EARLY 1970s", "political"]], at="Republican"),
            stack([["PUBLIC IMAGE", "image,"], ["PERSUASION", "persuasion,"], ["RELATIONSHIPS", "relationships"]], at="image,")],
    "2.2": [ph("seattle_45th_roosevelt")],
    "2.3": [stack([["INTELLIGENT", "intelligent,"], ["AMBITIOUS", "ambitious,"], ["A CLEAR DIRECTION", "clear"]])],
    "2.4": [ph("seattle_aquarium"), case("IN ACCOUNTS OF HIS LIFE", [['PSEUDONYM: "STEPHANIE BROOKS"', "Stephanie"]], at="One")],
    "2.5": [sil("shadow"), word("TURNING POINT?", at="turning"),
            case("NOTE", [["BUNDY'S OWN EXPLANATIONS WERE", "although"], ["OFTEN SELF-SERVING.", "self-serving"], ["TREAT THEM WITH CAUTION.", "cautiously."]], at="although")],
    "2.6": [sil("cold", z=(1.0, 1.08))],
    "2.7": [mp([["xy", 140, 110, 2.6], ["xy", 220, 150, 2.9]], hl=["Washington", "Utah"], route=[["Seattle", "Salt Lake City"], 0.1, 0.6],
               pins=[["Salt Lake City", "UNIVERSITY OF UTAH", "LAW SCHOOL · 1974", 0.55]])],
    "2.8": [ph("seattle_city_light_cafeteria"), case("SEATTLE · 1971", [["CRISIS CLINIC TELEPHONE HOTLINE", "crisis"], ["BUNDY WORKED THERE AS A STUDENT", "assisted"]], at="crisis")],
    "2.9": [loc("ANN RULE", "WRITER · FORMER POLICE OFFICER · CRISIS CLINIC COLLEAGUE")],
    "2.10": [loc("THE STRANGER BESIDE ME", "BOOK BY ANN RULE · FIRST PUBLISHED 1980")],
    "2.11": [sil("split")],
    "2.12": [say(0)],
    "2.13": [word("UNKNOWN"), date("?", "HIS FIRST MURDER · NEVER ESTABLISHED", at="Investigators", sfx=["hit_small"])],
    "2.14": [ph("seattle_the_alley"), sil("shadow", at="concealed")],
    "2.15": [date("1974", "", at="1974,"), frames(at="young")],
    # ---------------- 3 DISAPPEARANCES
    "3.0": [mp(WA, hl=["Washington"], label=["WASHINGTON STATE", "EARLY 1974"]), ph("seattle_university_inn", at="many")],
    "3.1": [ph("seattle_university_way", var=1), V("victim", "Lynda", img="victim_lynda_healy", name="LYNDA ANN HEALY", lines=["21 · UNIVERSITY OF WASHINGTON STUDENT", "SEATTLE"])],
    "3.2": [date("FEBRUARY 1974", "SEATTLE · UNIVERSITY DISTRICT")],
    "3.3": [V("victim", img="victim_lynda_healy", name="LYNDA ANN HEALY", lines=["READ SKI REPORTS ON LOCAL RADIO", "DISAPPEARED FEBRUARY 1974"]), rain(at="alarmed")],
    "3.4": [frames()],
    "3.5": [V("namelist", None, rows=[["DONNA MANSON", "MARCH 1974 · OLYMPIA, WASHINGTON", "Donna", "victim_donna_manson"],
                                     ["SUSAN RANCOURT", "APRIL 1974 · ELLENSBURG, WASHINGTON", "Susan", None],
                                     ["KATHY PARKS", "MAY 1974 · CORVALLIS, OREGON", "Kathy", None],
                                     ["BRENDA BALL", "JUNE 1974 · BURIEN, WASHINGTON", "Brenda", None],
                                     ["GEORGEANN HAWKINS", "JUNE 1974 · SEATTLE, WASHINGTON", "Georgeann", "victim_georgann_hawkins"]])],
    "3.6": [mp(NW, hl=["Washington", "Oregon"], pins=[["Olympia", "", "", 0], ["Ellensburg", "", "", 0], ["Corvallis", "", "", 0], ["Burien", "", "", 0],
                                                     ["Seattle", "DIFFERENT LOCATIONS", "WASHINGTON · OREGON · 1974", 0.1]]),
            board([["UNIVERSITIES", "COMMON LINK"], ["YOUNG WOMEN", "COMMON LINK"], ["A MAN NAMED TED", "WITNESSES"], ["VW BEETLE", "WITNESSES"]], at="similarities.")],
    "3.7": [ph("seattle_rowing_uw", var=1), case("WITNESS ACCOUNTS — 1974", [["— AN INJURED ARM OR LEG", "injured"], ["— ASKED WOMEN FOR HELP", "asking"]], at="Witnesses"),
            sil("sling", at="approached", z=(1.0, 1.06))],
    "3.8": [word('"TED"', at="Ted"), ph("vw_beetle_generic_1972", at="Volkswagen")],
    "3.9": [ph("bundy_vw_museum_a")],
    "3.10": [sil("shadow"), stack([["PRETENDED INJURY", "injured,"], ["NEEDED HELP", "help,"], ["AUTHORITY", "authority."]], at="pretended")],
    "3.11": [say(0)],
    "3.12": [street()],
    "3.13": [frames()],
    "3.14": [rain(), ph("seattle_owl_cafe", at="Friends"), street(at="women")],
    "3.15": [ph("police_car_1970s"), mp(NW, hl=["Washington", "Oregon", "Idaho"], label=["MANY JURISDICTIONS", "LITTLE SHARED INFORMATION"], at="disappearances")],
    "3.16": [board([["SEATTLE PD", "1974"], ["KING COUNTY", "1974"], ["OREGON", "1974"], ["UTAH", "1974"]]),
             case("CONTEXT", [["FBI'S NATIONAL VIOLENT CRIME DATABASE", "database"], ["(ViCAP) WAS NOT LAUNCHED UNTIL 1985", "connected"]], at="database")],
    "3.17": [lights()],
    "3.18": [mp(WEST, hl=["Washington", "Utah"], route=[["Seattle", "Salt Lake City"], 0.05, 0.85])],
    "3.19": [frames()],
    "3.20": [sil("fade", z=(1.12, 1.18))],
    # ---------------- 4 A SUSPECT EMERGES
    "4.0": [mp(UT, hl=["Utah"], pins=[["Salt Lake City", "SALT LAKE CITY, UTAH", "1974 · LAW SCHOOL", 0.15]])],
    "4.1": [frames()],
    "4.2": [mp(WEST, hl=["Utah", "Colorado", "Idaho"], label=["UTAH · COLORADO · IDAHO", "1974 — 1975"]),
            board([["UTAH", "1974"], ["COLORADO", "1975"], ["IDAHO", "1974"], ["WASHINGTON", "1974"]], at="Although")],
    "4.3": [date("BUNDY", "A NAME ENTERS THE INVESTIGATION", sfx=["hit_small"])],
    "4.4": [date("NOVEMBER 8, 1974", "MURRAY, UTAH")],
    "4.5": [loc("CAROL DaRONCH", "18 · FASHION PLACE MALL · MURRAY, UTAH"), lights(at="police"),
            case("WHAT SHE WAS TOLD", [["— HE CLAIMED TO BE A POLICE OFFICER", "He"], ["— SAID SOMEONE TRIED TO BREAK", "break"], ["  INTO HER CAR", "car"]], at="He")],
    "4.6": [ph("vw_beetle_generic_1970")],
    "4.7": [sil("cold")],
    "4.8": [street(), stamp("ESCAPED", "CAROL DaRONCH", "NOVEMBER 8, 1974", at="DaRonch", trans="flash")],
    "4.9": [say(0)],
    "4.10": [mp(UT, hl=["Utah"], pins=[["Murray", "", "", 0], ["Bountiful", "BOUNTIFUL, UTAH", "SAME EVENING · DEBRA KENT, 17", 0.15]]),
             case("VIEWMONT HIGH SCHOOL, BOUNTIFUL", [["A HANDCUFF KEY WAS FOUND THERE.", "Investigators"], ["IT FIT THE HANDCUFFS LEFT ON", "evidence"], ["CAROL DaRONCH'S WRIST.", "connect"]], at="Investigators")],
    "4.11": [sil("shadow")],
    "4.12": [V("lineup", illus=True)],
    "4.13": [word("BREAKTHROUGH"), case("THE CASE IN 1975", [["SURVIVING WITNESS: CAROL DaRONCH", "They"], ["CHARGE: ATTEMPTED KIDNAPPING", "attempted"]], at="They")],
    "4.14": [board([["DaRONCH CASE", "WITNESS"], ["MURDERS", "UNPROVEN"], ["EVIDENCE", "NEEDED"]], mark="≠")],
    "4.15": [say(0)],
    "4.16": [date("AUGUST 16, 1975", "GRANGER, UTAH"), ph("police_car_1970s_b", at="highway"), ph("bundy_vw_museum_b", at="Volkswagen")],
    "4.17": [case("REPORTED FOUND IN THE CAR — 1975", [["HANDCUFFS", "handcuffs"], ["SKI MASK", "and"], ["CROWBAR", "other"], ["ROPE", "attracted"]])],
    "4.18": [stamp("ARRESTED", "GRANGER, UTAH", "AUGUST 16, 1975", trans="flash")],
    "4.19": [board([["IDENTITY", "COMPARED"], ["VEHICLE", "COMPARED"], ["POSSESSIONS", "COMPARED"], ["OLD CASES", "1974"]]),
             stack([["IDENTITY", "identity,"], ["VEHICLE", "vehicle,"], ["POSSESSIONS", "possessions"]], at="identity,")],
    "4.20": [case("STATE OF UTAH v. THEODORE R. BUNDY", [["CHARGE: AGGRAVATED KIDNAPPING", "evidence"], ["VICTIM: CAROL DaRONCH", "DaRonch's"]])],
    "4.21": [stamp("CONVICTED", "UTAH · MARCH 1976", "AGGRAVATED KIDNAPPING", late="SENTENCE: 1 TO 15 YEARS")],
    "4.22": [V("years", None, **{"from": 1976, "to": 1976}, label="UTAH STATE PRISON · 1976")],
    "4.23": [tl(1975.9, 1977.2)],
    "4.24": [mp(WEST, hl=["Utah", "Colorado", "Washington"], label=["SEVERAL STATES", "1976"])],
    "4.25": [word("ESCAPE", at="escape.", sfx=["riser"]), sil("cold", z=(1.1, 1.0))],
    # ---------------- 5 TWO ESCAPES
    "5.0": [mp(CO, hl=["Colorado"], pins=[["Snowmass", "SNOWMASS, COLORADO", "JANUARY 1975", 0.1]]),
            loc("CARYN CAMPBELL", "23 · DISAPPEARED JANUARY 12, 1975 · SNOWMASS", at="Caryn")],
    "5.1": [case("COLORADO · 1976", [["BUNDY CHARGED IN THE DEATH OF", "Bundy"], ["CARYN CAMPBELL", "connection"]], at="Bundy")],
    "5.2": [mp(WEST, hl=["Utah", "Colorado"], route=[["Salt Lake City", "Aspen"], 0.05, 0.6], pins=[["Aspen", "ASPEN, COLORADO", "JANUARY 1977", 0.55]])],
    "5.3": [ph("pitkin_courthouse_habs")],
    "5.4": [date("JUNE 7, 1977", "PITKIN COUNTY COURTHOUSE, ASPEN", trans="flash"), ph("pitkin_courthouse_b", at="second-floor")],
    "5.5": [mp([["city", "Aspen", 7.0], ["city", "Aspen", 8.5]], hl=["Colorado"], pins=[["Aspen", "MANHUNT · ASPEN", "JUNE 1977", 0.1]]), street(at="For")],
    "5.6": [stamp("RECAPTURED", "ASPEN, COLORADO", "JUNE 13, 1977")],
    "5.7": [sil("shadow")],
    "5.8": [say(0, sfx=["hit_small"])],
    "5.9": [mp([["city", "Glenwood Springs", 7.0], ["city", "Glenwood Springs", 8.5]], hl=["Colorado"],
               pins=[["Aspen", "", "", 0], ["Glenwood Springs", "GARFIELD COUNTY JAIL", "GLENWOOD SPRINGS, COLORADO", 0.15]])],
    "5.10": [date("DECEMBER 30, 1977", "GLENWOOD SPRINGS, COLORADO", trans="flash"),
             case("THE SECOND ESCAPE", [["AN OPENING IN THE CELL CEILING", "ceiling"], ["HE HAD LOST WEIGHT TO FIT THROUGH", "lost"]], at="ceiling")],
    "5.11": [mp(US, hl=["Colorado", "Florida"], route=[["Glenwood Springs", "Tallahassee"], 0.05, 0.9], note="ROUTE SIMPLIFIED")],
    "5.12": [mp(FL, hl=["Florida"], pins=[["Tallahassee", "TALLAHASSEE, FLORIDA", "JANUARY 1978", 0.15]])],
    "5.13": [lights(), stamp("WANTED", "FBI · TEN MOST WANTED FUGITIVES", "FEBRUARY 1978", at="FBI")],
    "5.14": [sil("cold", z=(1.0, 1.1), sfx=["riser"])],
    "5.15": [date("JANUARY 15, 1978", "TALLAHASSEE, FLORIDA", sfx=["impact_big"]), loc("CHI OMEGA", "SORORITY HOUSE · FLORIDA STATE UNIVERSITY", at="Chi")],
    "5.16": [mem(["MARGARET BOWMAN", "LISA LEVY"], "KILLED JANUARY 15, 1978")],
    "5.17": [tv("NATIONAL ATTENTION", "TALLAHASSEE · JANUARY 1978")],
    "5.18": [rain()],
    "5.19": [board([["WITNESSES", "STATEMENTS"], ["EVIDENCE", "PHYSICAL"], ["SURVIVORS", "ACCOUNTS"], ["SUSPECT", "UNKNOWN"]]),
             stack([["WITNESS STATEMENTS", "Witness"], ["PHYSICAL EVIDENCE", "physical"], ["SURVIVORS' ACCOUNTS", "surviving"]], at="Witness")],
    "5.20": [sil("shadow", z=(1.1, 1.02))],
    "5.21": [mp(FL, hl=["Florida"], pins=[["Tallahassee", "", "", 0], ["Lake City", "LAKE CITY, FLORIDA", "FEBRUARY 9, 1978", 0.15]]),
             mem(["KIMBERLY LEACH"], "12 · DISAPPEARED FEBRUARY 9, 1978", at="Kimberly")],
    "5.22": [rain(), case("FLORIDA · 1978", [["A LARGE SEARCH FOLLOWED", "Her"], ["BUNDY WAS LATER CHARGED", "Investigators"]], at="Investigators")],
    "5.23": [mp(US, hl=["Washington", "Oregon", "Utah", "Colorado", "Florida"], route=[["Seattle", "Tallahassee"], 0.05, 0.9],
                label=["THOUSANDS OF MILES", "1974 — 1978"])],
    "5.24": [ph("police_car_1970s")],
    "5.25": [tv("NATIONWIDE SEARCH", "FEBRUARY 1978")],
    # ---------------- 6 FINAL ARREST
    "6.0": [date("FEBRUARY 15, 1978", "PENSACOLA, FLORIDA"),
            mp([["city", "Pensacola", 5.5], ["city", "Pensacola", 7.5]], hl=["Florida"], pins=[["Pensacola", "PENSACOLA, FLORIDA", "FEBRUARY 15, 1978", 0.15]], at="Pensacola,"),
            ph("vw_beetle_generic_1970", var=1, at="Volkswagen")],
    "6.1": [stamp("STOLEN", "VOLKSWAGEN BEETLE", "PENSACOLA · 1978")],
    "6.2": [lights()],
    "6.3": [street()],
    "6.4": [ph("bundy_pensacola_mugshot_1978", sfx=["impact"])],
    "6.5": [ph("police_car_1970s_b", var=1), ph("bundy_custody_1978", at="But")],
    "6.6": [mp(US, hl=["Colorado", "Florida"], route=[["Glenwood Springs", "Pensacola"], 0.05, 0.6]),
            stamp("CAPTURED", "PENSACOLA, FLORIDA", "FEBRUARY 15, 1978", at="finally")],
    "6.7": [ph("bundy_custody_1978", var=1)],
    "6.8": [board([["CHI OMEGA", "TALLAHASSEE"], ["K. LEACH", "LAKE CITY"], ["COLORADO", "C. CAMPBELL"], ["UTAH", "DaRONCH"]]), ph("courthouse_florida_generic", at="present")],
    "6.9": [say(0)],
    "6.10": [stack([["DIFFERENT VICTIMS", "victims,"], ["DIFFERENT LOCATIONS", "locations,"], ["DIFFERENT EVIDENCE", "types"]]),
             ph("courthouse_generic_1977", at="Prosecutors")],
    "6.11": [mp(FL, hl=["Florida"], pins=[["Tallahassee", "CHI OMEGA", "TALLAHASSEE", 0.1], ["Lake City", "KIMBERLY LEACH", "LAKE CITY", 0.4]])],
    "6.12": [case("THE FLORIDA CASES", [["1. CHI OMEGA SORORITY HOUSE, TALLAHASSEE", "They"], ["2. KIMBERLY LEACH, LAKE CITY", "linking"]])],
    "6.13": [spot(False)],
    # ---------------- 7 TRIALS
    "7.0": [date("JUNE 1979", "MIAMI, FLORIDA"), mem(["MARGARET BOWMAN", "LISA LEVY"], "CHI OMEGA · JANUARY 15, 1978", at="Margaret")],
    "7.1": [tv("TELEVISED NATIONWIDE", "MIAMI, FLORIDA · 1979")],
    "7.2": [ph("bundy_court_1979"), spot(False, at="He")],
    "7.3": [tv("PUBLIC FASCINATION", "1979")],
    "7.4": [sil("split", z=(1.04, 1.1))],
    "7.5": [say(0)],
    "7.6": [ph("courthouse_generic_1977", var=1), ph("bitemark_evidence_1979", at="bite-mark")],
    "7.7": [ph("bitemark_evidence_1979", var=1),
            case("NOTE ON THE SCIENCE", [["BITE-MARK COMPARISON HAS SINCE BEEN", "criticized"], ["WIDELY CRITICIZED AS UNRELIABLE", "scientific"], ["(NAS REPORT 2009 · PCAST 2016)", "unreliability."]], at="although")],
    "7.8": [stamp("GUILTY", "CHI OMEGA MURDERS · MIAMI", "JULY 24, 1979", trans="flash")],
    "7.9": [stamp("DEATH SENTENCE", "MIAMI, FLORIDA", "JULY 31, 1979")],
    "7.10": [tl(1979.4, 1980.1)],
    "7.11": [date("JANUARY 1980", "ORLANDO, FLORIDA"), mem(["KIMBERLY LEACH"], "12 · LAKE CITY, FLORIDA", at="Kimberly")],
    "7.12": [frames()],
    "7.13": [rain()],
    "7.14": [ph("courthouse_florida_generic", var=1)],
    "7.15": [stamp("GUILTY", "MURDER OF KIMBERLY LEACH · ORLANDO", "FEBRUARY 1980", late="SENTENCED TO DEATH")],
    "7.16": [ph("bundy_custody_1978", var=2)],
    "7.17": [tv("MEDIA SPECTACLE", "1979 — 1980"), stack([["APPEARANCE", "appearance,"], ["CONFIDENCE", "confidence,"], ["SPECTACLE", "spectacle"]], at="appearance,")],
    "7.18": [frames()],
    "7.19": [ph("courthouse_generic_1977", var=2)],
    "7.20": [say(0)],
    "7.21": [board([["HOW MANY?", "VICTIMS"], ["WHEN?", "FIRST CRIME"], ["WHO ELSE?", "UNKNOWN"]])],
    "7.22": [ask(0), ask(1), ask(2)],
    "7.23": [ph("bundy_fdoc_1980")],
    "7.24": [sil("shadow")],
    # ---------------- 8 CONFESSIONS
    "8.0": [V("years", None, **{"from": 1980, "to": 1988}, label="DEATH ROW · FLORIDA STATE PRISON", sfx=["ticks"]), ph("bundy_fdoc_1980", var=1, at="death")],
    "8.1": [stack([["BOOKS", "books,"], ["DOCUMENTARIES", "documentaries,"], ["PSYCHOLOGICAL ANALYSIS", "psychological"], ["PUBLIC DEBATE", "public"]])],
    "8.2": [ph("bundy_hagmaier")],
    "8.3": [date("30", "CONFESSED MURDERS · 1974 — 1978"),
            mp(US, hl=["Washington", "Oregon", "Idaho", "Utah", "Colorado", "California", "Florida"], label=["SEVEN STATES", "NAMED IN HIS CONFESSIONS"], at="multiple")],
    "8.4": [date("30+?", "THE TRUE NUMBER REMAINS UNKNOWN", sfx=["hit_small"])],
    "8.5": [frames(), rain(at="victims'")],
    "8.6": [ph("bundy_hagmaier", var=1)],
    "8.7": [sil("shadow"), case("HIS STATEMENTS", [["— SOME INFORMATION OFFERED", "offered"], ["— OTHER DETAILS WITHHELD", "withholding"], ["— ACCOUNTS INCOMPLETE", "accounts"]], at="At")],
    "8.8": [board([["CONFESSIONS", "VALUABLE"], ["EVIDENCE", "REQUIRED"], ["GAPS", "REMAIN"]])],
    "8.9": [word("UNCERTAINTY")],
    "8.10": [rain()],
    "8.11": [frames()],
    "8.12": [tv("PUBLIC FASCINATION", "1980s")],
    "8.13": [sil("split"), ph("bundy_court_1979", var=1, at="image")],
    "8.14": [tv("MEDIA ATTENTION", "1980s"), stack([["APPEARANCE", "appearance,"], ["RELATIONSHIPS", "relationships,"], ["BEHAVIOR", "behavior."]], at="appearance,")],
    "8.15": [say(0)],
    "8.16": [sil("fade"), frames(at="Nor")],
    "8.17": [say(0)],
    "8.18": [stack([["LIVES LOST", "Women"], ["FAMILIES GRIEVING", "Families"], ["SURVIVORS' TRAUMA", "Survivors"], ["COMMUNITIES IN FEAR", "Communities"]])],
    "8.19": [say(0)],
    # ---------------- 9 THE END
    "9.0": [date("JANUARY 1989", "FLORIDA STATE PRISON"), tl(1986.0, 1989.05, events={1989.07: "EXECUTION DATE"}, at="legal")],
    "9.1": [ph("bundy_mugshot_1988")],
    "9.2": [ph("bundy_hagmaier", var=2), tv("FINAL INTERVIEWS", "JANUARY 1989", at="He")],
    "9.3": [case("NOTE", [["HIS FINAL EXPLANATIONS ARE", "Such"], ["SELF-REPORTED — NOT AN IMPARTIAL", "manipulating"], ["ACCOUNT OF HIS PSYCHOLOGY.", "impartial"]])],
    "9.4": [V("execdate", None, big="JANUARY 24, 1989", sub="EXECUTED · FLORIDA STATE PRISON, NEAR STARKE", sfx=["impact_soft"]),
            mp([["city", "Starke", 6.0], ["city", "Starke", 7.5]], hl=["Florida"], pins=[["Starke", "FLORIDA STATE PRISON", "NEAR STARKE · JANUARY 24, 1989", 0.1]], at="Florida")],
    "9.5": [date("42", "1946 — 1989", sfx=["hit_small"])],
    "9.6": [loc("OUTSIDE FLORIDA STATE PRISON", "CROWDS GATHERED · JANUARY 24, 1989"), tl(1974.0, 1989.1, at="For")],
    "9.7": [rain()],
    "9.8": [date("30", "MURDERS ADMITTED", sfx=["hit_small"]), date("?", "THE EXACT NUMBER REMAINS UNKNOWN", at="but", sfx=["hit_small"])],
    "9.9": [sil("fade")],
    "9.10": [frames()],
    "9.11": [tv("PUBLIC FASCINATION", "1989 — TODAY")],
    "9.12": [stack([["BOOKS", "books,"], ["FILMS", "films,"], ["DOCUMENTARIES", "documentaries,"], ["INVESTIGATIONS", "investigations."]])],
    "9.13": [ph("bundy_headshot_1978", var=1)],
    "9.14": [sil("split")],
    "9.15": [sil("shadow"), say(1)],
    "9.16": [say(0)],
    # ---------------- CONCLUSION
    "10.0": [sil("warm", z=(1.0, 1.08))],
    "10.1": [ask(0)],
    "10.2": [ask(0)],
    "10.3": [word("NO SINGLE ANSWER")],
    "10.4": [board([["MANIPULATION", "1"], ["MISPLACED TRUST", "2"], ["INVESTIGATIVE GAPS", "3"], ["SYSTEM FAILURES", "4"]])],
    "10.5": [stack([["TAKE MISSING-PERSON CASES SERIOUSLY", "missing-person"], ["SHARE INFORMATION", "sharing"], ["LISTEN TO SURVIVORS", "listening"],
                    ["EXAMINE THE EVIDENCE", "examining"]])],
    "10.6": [sil("shadow", z=(1.0, 1.1))],
    "10.7": [stack([["CHARM", "charm,"], ["INTELLIGENCE", "intelligence,"], ["EDUCATION", "education,"], ["STATUS", "status"], ["ARE NOT EVIDENCE", "evidence"]], red_last=True)],
    "10.8": [ph("bundy_court_1979", var=2)],
    "10.9": [ph("bundy_custody_1978", var=3)],
    "10.10": [ph("bundy_mugshot_1988", var=1)],
    "10.11": [V("roll", None, names=["LYNDA ANN HEALY", "DONNA MANSON", "SUSAN RANCOURT", "KATHY PARKS", "BRENDA BALL", "GEORGEANN HAWKINS",
                                     "DEBRA KENT", "CARYN CAMPBELL", "MARGARET BOWMAN", "LISA LEVY", "KIMBERLY LEACH",
                                     "AND THE OTHER VICTIMS, NAMED AND UNNAMED"], subs=True)],
    "10.12": [],  # the roll continues
    "10.13": [sil("fade")],
    "10.14": [stack([["THE LIVES HE DESTROYED", "lives"], ["THE FAMILIES LEFT BEHIND", "families"], ["EVIDENCE · VIGILANCE", "evidence,"],
                     ["PROTECTING THE INNOCENT", "protecting"]])],
    "10.15": [ph("bundy_headshot_1978", var=3, z=(1.0, 1.15))],
}

POOL = {  # neutral B-roll per chapter, used only to break up long holds
    0: [V("silhouette", mood="warm", illus=True), V("rain", illus=True)],
    1: [V("rain", illus=True), V("silhouette", mood="shadow", illus=True), V("frames")],
    2: [V("archive", img="seattle_first_ave", var=2), V("archive", img="seattle_canal_market"), V("archive", img="seattle_sherwood_apts"),
        V("archive", img="seattle_university_bridge"), V("archive", img="seattle_aquarium", var=1)],
    3: [V("archive", img="seattle_the_alley", var=1), V("rain", illus=True), V("streetlight", illus=True), V("archive", img="seattle_45th_roosevelt", var=1)],
    4: [V("streetlight", illus=True), V("policelights", illus=True), V("rain", illus=True)],
    5: [V("streetlight", illus=True), V("archive", img="pitkin_courthouse_b", var=1), V("rain", illus=True), V("policelights", illus=True)],
    6: [V("policelights", illus=True), V("archive", img="police_car_1970s", var=2), V("streetlight", illus=True)],
    7: [V("spotlight", wide=True, illus=True), V("archive", img="courthouse_generic_1977", var=3), V("tv", label="1979", sub="MIAMI, FLORIDA", illus=True)],
    8: [V("rain", illus=True), V("silhouette", mood="shadow", illus=True), V("frames")],
    9: [V("rain", illus=True), V("silhouette", mood="fade", illus=True), V("streetlight", illus=True)],
    10: [V("silhouette", mood="warm", illus=True), V("rain", illus=True)],
}
TEXT_KINDS = {"casefile", "stamp", "date", "location", "memorial", "namelist", "roll", "wordstack", "board", "say", "question", "family",
              "victim", "word", "execdate", "title", "chapter", "timeline", "years"}
REFRAME = {"archive", "silhouette", "rain", "streetlight", "policelights", "tv", "spotlight", "frames", "map", "lineup"}


# ---------------------------------------------------------------- resolution
def para_lines():
    out = {}
    ch = -1; last = None
    for l in LINES:
        if l["section"] != last:
            ch += 1; last = l["section"]
        out.setdefault(f"{ch}.{l['para']}", []).append(l)
    return out


def words_in(lines):
    return [(w, li["index"]) for li in lines for w in li["words"]]


def find_word(words, token, after):
    tok = token.lower()
    for w, _ in words:
        if w["start"] + 1e-6 >= after and re.sub(r"[^\w'-]", "", w["w"].lower()).startswith(re.sub(r"[^\w'-]", "", tok)):
            return w["start"]
    raise KeyError(f"word '{token}' not found after {after:.2f}")


def resolve_stack(items, words, t0):
    out, t = [], t0
    for txt, tok in items:
        t = find_word(words, tok, t)
        out.append([txt, round(t, 3)])
    return out


def nearest_word_start(words, target, lo, hi):
    cands = [w["start"] for w, _ in words if lo + MIN_SHOT <= w["start"] <= hi - MIN_SHOT]
    return min(cands, key=lambda x: abs(x - target)) if cands else None


def content_end(s):
    p = s["params"]
    if s["kind"] == "casefile":
        return max(l[2] for l in p["lines"])
    if s["kind"] == "wordstack":
        return max(i[1] for i in p["items"])
    if s["kind"] == "namelist":
        return max(r[2] for r in p["rows"])
    return s["start"]


def build():
    PL = para_lines()
    keys = list(PL.keys())
    shots = []  # dicts with start, kind, params, ch
    for key in keys:
        ch = int(key.split(".")[0])
        lines = PL[key]
        words = words_in(lines)
        p_start, p_end = lines[0]["start"], lines[-1]["end"]
        vis = PLAN.get(key)
        if vis is None:
            raise KeyError(f"no plan for paragraph {key}")
        if key.endswith(".0"):  # chapter card in the breath before the chapter
            if ch == 0:
                pass
            else:
                prev_end = shots[-1]["_p_end"] if shots else 0
                k, title, period, _ = CHAPTERS[ch]
                shots.append(dict(start=prev_end + 0.25, kind="chapter", params={"kicker": k, "title": title, "period": period, "num": str(ch)},
                                  ch=ch, sfx=["whoosh"], trans="dip", subs=True, _p_end=p_end, illus=False, note="Chapter card"))
        if ch == 0 and key == "0.0":
            pass
        t_cursor = p_start
        placed = []
        for i, v in enumerate(vis):
            v = dict(v); params = dict(v["params"])
            if v["at"] == "END":
                st = p_end + 0.12
            elif v["at"]:
                st = find_word(words, v["at"], t_cursor + (0.01 if placed else 0))
            elif i == 0:
                st = p_start
            else:
                # spread unanchored visuals over sentence starts after the cursor
                starts = [l["start"] for l in lines if l["start"] > t_cursor + MIN_SHOT]
                st = starts[0] if starts else t_cursor + (p_end - t_cursor) / 2
            if "items" in params:
                params["items"] = resolve_stack(params["items"], words, st - 0.05)
            if v["kind"] == "casefile":
                lines_out, t = [], st + 0.35
                for txt, tok in params["lines"]:
                    t = max(t, find_word(words, tok, st - 0.05) if tok else t)
                    d = len(txt) / 30
                    lines_out.append([txt, round(t, 3), round(t + d, 3)]); t += d + 0.1
                params["lines"] = lines_out
            if v["kind"] == "namelist":
                params["rows"] = [[n, sub, round(find_word(words, tok, st - 0.05), 3), img] for n, sub, tok, img in params["rows"]]
            if v["kind"] in ("say", "question"):
                params["line"] = lines[params.pop("sent")]["index"]
                if i > 0 or v["at"] is None:
                    st = max(st, LINES[params["line"]]["start"] - 0.1) if i > 0 else st
            red = params.pop("red", None)
            shot = dict(start=round(st, 3), kind=v["kind"], params=params, ch=ch, sfx=v.get("sfx", []), trans=v.get("trans", "cut"),
                        subs=v.get("subs", True), illus=v.get("illus", False), note=v.get("note", ""), _p_end=p_end, _key=key)
            if v["kind"] == "chapter":
                shot["subs"] = True
            placed.append(shot)
            t_cursor = st
        # first visual of a chapter starts ~1 s into the narration (the card covers the breath)
        if key.endswith(".0") and ch > 0 and placed:
            placed[0]["start"] = round(max(placed[0]["start"], p_start + 0.9), 3)
            if len(placed) > 1 and placed[1]["start"] <= placed[0]["start"] + MIN_SHOT:
                placed[1]["start"] = round(placed[0]["start"] + MIN_SHOT, 3)
        shots.extend(placed)
    shots.sort(key=lambda s: s["start"])
    # end card
    end_t = LINES[-1]["end"] + 1.2
    shots.append(dict(start=round(end_t, 3), kind="endcard", params={"q": "WHAT DO YOU THINK ALLOWED HIM TO AVOID SUSPICION FOR SO LONG?",
                     "cta": "Share your view in the comments.", "mem": "In memory of the victims, and for the families and survivors."},
                      ch=10, sfx=[], trans="dip", subs=False, illus=False, note="Comment prompt + memorial", _p_end=end_t))
    total = end_t + END_CARD_LEN + TAIL
    # drop shots that collapse to < MIN_SHOT (keep the later one)
    clean = []
    for s in shots:
        if clean and s["start"] - clean[-1]["start"] < MIN_SHOT and clean[-1]["kind"] != "chapter":
            if s["kind"] == "chapter":
                clean[-1] = s  # the chapter card wins over a sliver of the previous shot
                continue
            if s["start"] - clean[-1]["start"] < 0.5:
                continue
            s["start"] = clean[-1]["start"] + MIN_SHOT
        elif clean and s["start"] - clean[-1]["start"] < MIN_SHOT:
            s["start"] = clean[-1]["start"] + MIN_SHOT
        clean.append(s)
    shots = clean
    # split long holds
    allwords = [(w, l["index"]) for l in LINES for w in l["words"]]
    out, pool_i = [], {}
    for i, s in enumerate(shots):
        en = shots[i + 1]["start"] if i + 1 < len(shots) else total
        lim = MAX_TEXT if s["kind"] in TEXT_KINDS else MAX_VIS
        if s["kind"] in ("endcard", "roll", "question", "say") or en - s["start"] <= lim:
            out.append(s); continue
        cur = s; out.append(cur)
        t0 = s["start"]
        n = 1
        ce = content_end(s)
        while en - t0 > lim:
            target = t0 + (min(lim, 4.2) if s["kind"] in TEXT_KINDS else min(lim, 3.6))
            if t0 == s["start"]:
                target = max(target, ce + 1.0)
            cut = nearest_word_start(allwords, target, t0, en) or (target if en - target > MIN_SHOT else None)
            if cut is None or cut - t0 < MIN_SHOT:
                break
            if s["kind"] in REFRAME and n % 2 == 1:
                nxt = dict(s, params=dict(s["params"], var=s["params"].get("var", 0) + n), start=round(cut, 3), sfx=[], trans="cut", note="reframe")
                if s["kind"] == "map":
                    c0, c1 = s["params"]["cam"]
                    nxt["params"]["cam"] = [c1, c1[:-1] + [c1[-1] * 1.15]]
                    nxt["params"].pop("route", None)
                    nxt["params"]["pins"] = [[p[0], p[1], p[2], 0.0] for p in s["params"].get("pins", [])]
            else:
                pool = POOL[s["ch"]]
                j = pool_i.get(s["ch"], 0); pool_i[s["ch"]] = j + 1
                pv = pool[j % len(pool)]
                nxt = dict(start=round(cut, 3), kind=pv["kind"], params=dict(pv["params"]), ch=s["ch"], sfx=[], trans="cut", subs=True,
                           illus=pv.get("illus", False), note="B-roll insert (pacing)", _p_end=s["_p_end"])
            out.append(nxt); t0 = cut; n += 1
    shots = out
    chapters = {str(i): c[3] for i, c in enumerate(CHAPTERS)}
    final = []
    for i, s in enumerate(shots):
        en = shots[i + 1]["start"] if i + 1 < len(shots) else total
        sfx = list(s["sfx"])
        final.append({"index": i + 1, "start": s["start"], "end": round(en, 3), "duration": round(en - s["start"], 3), "chapter": s["ch"],
                      "period": period_of(s), "type": s["kind"], "params": s["params"], "transition": s["trans"], "note": s["note"],
                      "photo_slot": None, "subs": s["subs"], "illustrative": s["illus"], "sfx": sfx})
    for s in final:
        assert s["duration"] > 0.3, s
    save_json(BUILD / "timeline.json", {"duration": round(total, 3), "fps": 25, "shots": final, "chapters": chapters})
    write_csv(final, chapters)
    d = [s["duration"] for s in final]
    print(f"{len(final)} shots · total {total / 60:.2f} min · median {sorted(d)[len(d) // 2]:.2f}s · max {max(d):.2f}s · >7s: {sum(x > 7 for x in d)}")


def period_of(s):
    return {0: "Overview", 1: "1946–1960s", 2: "1965–1974", 3: "1974", 4: "1974–1976", 5: "1977–1978", 6: "Feb 1978", 7: "1979–1980",
            8: "1980–1989", 9: "1989", 10: "Legacy"}[s["ch"]]


def tc(t):
    return f"{int(t // 60):02d}:{t % 60:06.3f}"


def write_csv(final, chapters):
    from render_meta import asset_of
    OUT.mkdir(exist_ok=True)
    with open(OUT / "chronological_timeline.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["shot", "start_tc", "end_tc", "start_s", "end_s", "duration_s", "chapter", "historical_period", "visual_type",
                    "transition", "asset_path", "asset_status", "subtitles", "narration_during_shot", "notes"])
        for d in final:
            words = [x["w"] for l in LINES for x in l["words"] if d["start"] <= x["start"] < d["end"]]
            asset, status = asset_of(d)
            w.writerow([d["index"], tc(d["start"]), tc(d["end"]), d["start"], d["end"], d["duration"], f"{d['chapter']} {chapters[str(d['chapter'])]}",
                        d["period"], d["type"], d["transition"], asset, status, "on" if d["subs"] else "off (text is the visual)", " ".join(words), d["note"]])


if __name__ == "__main__":
    build()
