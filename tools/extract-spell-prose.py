"""Extract spell prose from the Rules Cyclopedia PDF text layer.

The two-column OCR used by tools/extract-spells.mjs attaches the prose of one
spell to the previous heading whenever a page has stacked headings or a
multi-line stat block. The PDF text layer keeps the columns separate, so this
helper reads pages 33-61 column by column and emits a JSON map keyed by spell
list and name.

Requires PyMuPDF (`py -3 -m pip install pymupdf`). The PDF is not part of the
system; point BECMI_PDF at your copy if it is not in the default location.

Usage:
  py -3 tools/extract-spell-prose.py
  node tools/repair-spell-prose.mjs [path-to-json]
"""

import json
import os
import re
import tempfile
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
PDF = Path(os.environ.get(
    "BECMI_PDF",
    r"C:\Users\Usuário\OneDrive\Documents\Arquivos RPG\BECMI\1- Boxed Sets\Rules - Cyclopedia.pdf"
))
RC = ROOT / "data" / "rc-tables.json"
OUT = Path(os.environ.get(
    "BECMI_SPELL_PROSE_OUT",
    str(Path(tempfile.gettempdir()) / "becmi-spell-prose.json")
))


def norm(value):
    return re.sub(r"[^a-z0-9]+", "", str(value).lower())


with RC.open(encoding="utf-8") as handle:
    rc = json.load(handle)
canon = {norm(entry["name"]): entry["name"] for entry in rc["spells"]}

doc = pymupdf.open(PDF)
levels = {"First": 1, "Second": 2, "Third": 3, "Fourth": 4, "Fifth": 5,
          "Sixth": 6, "Seventh": 7, "Eighth": 8, "Ninth": 9}
stat_re = re.compile(r"^(Range|Duration|Effect):", re.I)
level_re = re.compile(r"^(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth)\s+Level", re.I)
skip_re = re.compile(r"^(?:\d+\s*$|Rules Cyclopedia|Chapter 3(?::|$)|TADS\b)", re.I)

records = []
current = None
collecting_stats = False
level = 0


def list_for(page):
    if page <= 40:
        return "cleric"
    if page <= 43:
        return "druid"
    return "magic-user"


def clean(text):
    text = text.replace("\ufffd", "—")
    return re.sub(r"-\n(?=[a-z])", "", text)


def flush():
    global current, collecting_stats
    if current and current["prose"]:
        text = re.sub(r"\s+", " ", " ".join(current["prose"])).strip()
        current["description"] = text
        records.append(current)
    current = None
    collecting_stats = False


for page_no in range(33, 62):
    page = doc[page_no - 1]
    # Three-column spell pages start at x ~ 24, 211 and 398. Two-column pages
    # simply have no blocks in the third band.
    blocks = sorted(
        page.get_text("blocks"),
        key=lambda block: (0 if block[0] < 200 else 1 if block[0] < 390 else 2, block[1])
    )
    for block in blocks:
        lines = [line.strip() for line in clean(block[4]).splitlines()]
        lines = [line for line in lines if line and not skip_re.match(line)]
        if not lines:
            continue

        level_match = level_re.match(lines[0])
        if level_match:
            flush()
            level = levels[level_match.group(1).title()]
            continue

        first_key = norm(lines[0].rstrip("*"))
        name = canon.get(first_key)
        is_heading = bool(name and lines[0][:1].isupper()
                          and any(stat_re.match(line) for line in lines[1:6]))

        if is_heading:
            flush()
            current = {
                "name": name,
                "list": list_for(page_no),
                "level": level,
                "reversible": lines[0].rstrip().endswith("*"),
                "prose": []
            }
            collecting_stats = True
            for line in lines[1:]:
                if stat_re.match(line):
                    collecting_stats = True
                    continue
                if collecting_stats and line[:1].islower():
                    continue  # multi-line Range/Duration/Effect value
                collecting_stats = False
                current["prose"].append(line)
            continue

        if current is None:
            continue
        if collecting_stats and lines[0][:1].islower():
            continue
        collecting_stats = False
        current["prose"].extend(lines)

flush()

by_key = {}
for record in records:
    by_key.setdefault(f'{record["list"]}|{norm(record["name"])}', record)
    by_key.setdefault(f'any|{norm(record["name"])}', record)

OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open("w", encoding="utf-8") as handle:
    json.dump({"records": records, "byKey": by_key}, handle, ensure_ascii=False, indent=2)
print(f"Parsed {len(records)} spell descriptions -> {OUT}")
