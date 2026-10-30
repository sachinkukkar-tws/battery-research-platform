"""Build the Explorer's data from Amplifi's answers, checked against the PDFs, as JSON for the proxy to serve.

python scripts/explorer/build_data.py <pdf_dir> <answers_dir> [<answers_dir> ...] [--cells <answers_dir> ...] [--out <file>]

Everything in the output comes from Amplifi's answers or from the PDFs; nothing is added by hand.
Each answers folder holds one run of extract.py. For each paper the run with the most verified values is kept,
and full cells (with their full-cell values) that only another run found are added; --cells runs, asked only
about full cells (question-fullcells.txt), are used for that alone. Each item gets the PDF page its quote is on,
and a status:
- verified: the quote is on that page and the item's values are in the quote
- quote only: the quote is in the paper, but a value isn't in it
- unverified: the quote isn't in the paper
The website shows only verified items. The paper's own details (title, first author, journal, year, DOI) are
kept only when the PDF contains them, and a cathode formula only when the paper contains it. Cathodes are grouped
across papers by that formula, or by the short name Amplifi gives, and named by Amplifi's own names.
Matching ignores case, accents, spacing, dash and degree styles, hyphens, end punctuation, running headers and
footers, and the ff/fi/fl ligatures some text layers drop. Amplifi often joins passages with "...": each passage
of 20+ characters is looked up on its own, and only the passages found in the paper are kept in the quote the
website shows. A passage that crosses a page break or a figure counts when 90% of its 24-character pieces are in
the paper. Only the matched text is used to check values.
Needs pymupdf (pip install pymupdf).
"""
import argparse
import collections
import datetime
import json
import pathlib
import re
import sys
import unicodedata

import pymupdf

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent.parent / "server" / "cache" / "explorer.json"
SECTIONS = ("anodes", "fullCells", "materials", "performance")
DASHES = dict.fromkeys(map(ord, "‐‑‒–—−­"), "-")
DEGREES = dict.fromkeys(map(ord, "◦˚º"), "°")
QUOTES = {"‘": "'", "’": "'", "“": '"', "”": '"'}
PLACEHOLDER = re.compile(r"^\s*(not\b|n/?a\b|none\b|unknown\b|unspecified\b)", re.I)
COUNTER_ELECTRODE = re.compile(r"\b(sodium|lithium|na|li)\b.*\b(metal|foil)\b|metallic (sodium|lithium)", re.I)
HEDGE = re.compile(r"\b(likely|typical(ly)?|probably|assumed|presumably|not (explicitly )?stated|unknown|see )", re.I)
sys.stdout.reconfigure(encoding="utf-8")


def fold(text) -> str:
    """Without accents, so "Ångstrom" matches "Angstrom"."""
    return "".join(c for c in unicodedata.normalize("NFKD", text or "") if not unicodedata.combining(c))


def key(text) -> str:
    text = unicodedata.normalize("NFKC", fold(text).translate(DEGREES)).translate(DASHES)
    for k, v in QUOTES.items():
        text = text.replace(k, v)
    text = re.sub(r"(?<=\d),(?=\d{3})", "", text)
    return re.sub(r"[\s-]+", "", text).lower().rstrip(".,;:")


def loose(k: str) -> str:
    """A key without ff, fi and fl, which some PDF text layers drop (Amplifi's text says "specic" for "specific")."""
    return re.sub(r"f[fil]", "", k)


def numbers(text) -> list:
    return re.findall(r"\d+(?:\.\d+)?", re.sub(r"(?<=\d),(?=\d{3})", "", unicodedata.normalize("NFKC", text or "")))


def formula_key(formula) -> str:
    """A formula without spacing, brackets or dots, so "Na4Fe3(PO4)2(P2O7)" and "Na4Fe3(PO4)2P2O7" group together."""
    return re.sub(r"[\s()\[\]·.\-]+", "", unicodedata.normalize("NFKC", formula or "")).lower()


def page_keys(texts: list) -> list:
    """Each page's loose key, without running headers and footers: (the page alone, the page plus the start of the next).

    The start of the next page is there for a quote that runs over a page break.
    A line counts as a header or footer when, with its digits blanked, it appears on three or more pages.
    """
    def shape(line: str) -> str:
        return re.sub(r"\d+", "#", line.strip().lower())

    seen = {}
    for text in texts:
        for s in {shape(line) for line in text.splitlines() if line.strip()}:
            seen[s] = seen.get(s, 0) + 1
    cleaned = ["\n".join(line for line in t.splitlines() if seen.get(shape(line), 0) < 3) for t in texts]
    return [
        (loose(key(t)), loose(key(t + " " + (cleaned[i + 1][:1500] if i + 1 < len(cleaned) else ""))))
        for i, t in enumerate(cleaned)
    ]


def page_of(text: str, pages):
    """The first page that has the text on it; else the page it starts on, for text that runs over a page break.

    Checking each page alone first matters: a sentence at the top of page 7 is also in page 6's key, which
    ends with the start of page 7.
    """
    alone = next((i + 1 for i, (own, _) in enumerate(pages) if text in own), None)
    return alone or next((i + 1 for i, (_, joined) in enumerate(pages) if text in joined), None)


def locate(quote, pages):
    """(the first found passage's page, the matched loose text, the quote to show), or (None, "", quote) when no
    passage of the quote is in the paper. The quote to show keeps only the passages found in the paper."""
    passages = [p.strip() for p in re.split(r"\.{3}|…", quote or "") if len(loose(key(p))) >= 20]
    kept = []
    for passage in passages:
        k = loose(key(passage))
        page = page_of(k, pages)
        if not page:
            chunks = [k[i:i + 24] for i in range(0, len(k) - 23, 24)]
            found = [(c, page_of(c, pages)) for c in chunks]
            hits = [p for _, p in found if p]
            if len(chunks) < 2 or len(hits) < 0.9 * len(chunks):
                continue
            page, k = min(hits), "".join(c for c, p in found if p)
        kept.append((passage, k, page))
    if not kept:
        return None, "", quote
    shown = quote if len(kept) == len(passages) else " … ".join(passage for passage, _, _ in kept)
    return kept[0][2], "".join(k for _, k, _ in kept), shown


def has_all(text, checked: str) -> bool:
    found = numbers(text)
    return bool(found) and all(n in checked for n in found)


def problem(section: str, item: dict, checked: str):
    """What the matched quote doesn't contain, or None."""
    if section == "performance" and not has_all(item["value"], checked):
        return f"value {item['value']!r} not in quote"
    if section == "fullCells":
        names = [loose(key(n)) for n in (item["cathode"], item.get("cathodeFormula"), item.get("cathodeShortName")) if n and key(n)]
        if not any(n in checked for n in names):
            return f"cathode {item['cathode']!r} not in quote"
    if section == "materials" and loose(key(item["value"])) not in checked:
        return f"value {item['value']!r} not in quote"
    return None


def tidy(section: str, item: dict, checked: str, whole: str, notes: list) -> dict:
    """Clears fields the paper doesn't support, so the website never shows them. Adds nothing."""
    item = dict(item)
    if section == "anodes":
        if item.get("temperature") and not has_all(item["temperature"], checked):
            notes.append(f"    cleared    temperature {item['temperature']!r} of {item['sample']} (not in quote)")
            item["temperature"] = None
        for field in ("precursor", "method"):
            if item.get(field) and HEDGE.search(item[field]):
                item[field] = None
    if item.get("condition") and (HEDGE.search(item["condition"]) or (numbers(item["condition"]) and not has_all(item["condition"], checked))):
        item["condition"] = None
    for field in ("sample", "anodeSample"):
        name = item.get(field)
        if name and " (" in name and len(name.split(" (", 1)[1]) > 20:
            item[field] = name.split(" (", 1)[0]
    if section == "fullCells":
        for field in ("cathodeFormula", "cathodeShortName"):
            if item.get(field) and loose(key(item[field])) not in whole:
                notes.append(f"    cleared    {field} {item[field]!r} (not in the paper)")
                item[field] = None
    return item


def check_run(pid: str, body: dict, pages: list, whole: str):
    parts = [body["data"], *body.get("more", [])]
    record = {"paper": parts[0].get("paper") or {}, "kind": parts[0].get("kind"), "battery": parts[0].get("battery"), **{s: [] for s in SECTIONS}}
    notes = []
    for part in parts:
        for section in SECTIONS:
            for item in part.get(section, []):
                if section == "materials" and PLACEHOLDER.match(item.get("value") or ""):
                    continue
                if section == "fullCells" and (PLACEHOLDER.match(item["cathode"]) or COUNTER_ELECTRODE.search(item["cathode"])):
                    notes.append(f"    dropped    {item['cathode']!r}: not a full-cell cathode")
                    continue
                page, checked, shown = locate(item.get("quote"), pages)
                why = problem(section, item, checked) if page else None
                status = "unverified" if not page else "quote only" if why else "verified"
                what = item.get("sample") or item.get("cathode") or item.get("value")
                if shown != item.get("quote"):
                    notes.append(f"    trimmed    {section}: {what}: kept only the passages found in the PDF")
                record[section].append({"paper": pid, **tidy(section, {**item, "quote": shown}, checked, whole, notes), "page": page, "status": status})
                if status != "verified":
                    notes.append(f"    {status:<10} {section}: {what} | {why or (item.get('quote') or '')[:90]}")
    return record, notes


def paper_details(answers: list, texts: list) -> dict:
    """The paper's own details from Amplifi's answers, each kept only when the PDF contains it."""
    first, whole = loose(key(" ".join(texts[:2]))), loose(key(" ".join(texts)))
    out = {"title": None, "firstAuthor": None, "journal": None, "year": None, "doi": None}
    for meta in answers:
        for field, haystack in (("title", first), ("firstAuthor", first), ("journal", whole), ("doi", whole)):
            value = (meta.get(field) or "").strip()
            if not out[field] and value and len(loose(key(value))) >= 2 and loose(key(value)) in haystack:
                out[field] = value
        year = meta.get("year")
        if not out["year"] and isinstance(year, int) and str(year) in first:
            out["year"] = year
    return out


def count(record: dict, status: str) -> int:
    return sum(i["status"] == status for s in SECTIONS for i in record[s])


parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
parser.add_argument("pdf_dir", type=pathlib.Path)
parser.add_argument("runs", nargs="+", type=pathlib.Path)
parser.add_argument("--cells", nargs="*", type=pathlib.Path, default=[], help="runs used only to add full cells")
parser.add_argument("--out", type=pathlib.Path, default=OUT)
args = parser.parse_args()

files = {p.name.split("_")[0]: p for p in sorted(args.pdf_dir.glob("*.pdf"))}
store = {"extractedAt": None, "method": "", "papers": {}, **{s: [] for s in SECTIONS}}
newest = 0.0
for pid, path in files.items():
    texts = [p.get_text("text") for p in pymupdf.open(path)]
    pages, whole = page_keys(texts), loose(key(" ".join(texts)))
    checked_runs, cell_runs = [], []
    for run in [*args.runs, *args.cells]:
        answer = run / f"{pid}.json"
        if answer.exists():
            newest = max(newest, answer.stat().st_mtime)
            record, notes = check_run(pid, json.loads(answer.read_text(encoding="utf-8")), pages, whole)
            (checked_runs if run in args.runs else cell_runs).append((run.name, record, notes))
            print(f"{pid} {run.name}: {count(record, 'verified')} verified, {count(record, 'quote only')} quote only, {count(record, 'unverified')} unverified")
    paper = {"id": pid, "file": path.name, "title": None, "firstAuthor": None, "journal": None, "year": None, "doi": None, "kind": None, "battery": None}
    if not checked_runs:
        print(f"{pid}: no answer from Amplifi")
        store["papers"][pid] = paper
        continue
    name, kept, notes = max(checked_runs, key=lambda r: (count(r[1], "verified"), -count(r[1], "unverified")))

    # Full cells (an anode sample with a cathode in a cell format), and their full-cell values, that only another run
    # found. Runs name the same sample differently ("pure graphite", "pure graphite anode (control)"), so names that
    # contain one another count as the same sample.
    def same_cell(a, b):
        x, y = (re.sub(r"[^a-z0-9]", "", c["anodeSample"].lower()) for c in (a, b))
        same_sample = x == y or (min(len(x), len(y)) >= 3 and (x in y or y in x))
        same_cathode = loose(key(a["cathode"])) == loose(key(b["cathode"])) or (
            a.get("cathodeFormula") and formula_key(a["cathodeFormula"]) == formula_key(b.get("cathodeFormula"))
        )
        return same_cathode and a["cellFormat"] == b["cellFormat"] and same_sample

    have = [c for c in kept["fullCells"] if c["status"] == "verified"]
    for other, record, _ in checked_runs + cell_runs:
        if other == name:
            continue
        new = []
        for c in record["fullCells"]:
            if c["status"] == "verified" and not any(same_cell(c, h) for h in have):
                new.append(c)
                have.append(c)
        if not new:
            continue
        kept["fullCells"] += new
        known = {(v["metric"], tuple(numbers(v["value"]))) for v in kept["performance"]}
        kept["performance"] += [v for v in record["performance"] if v["status"] == "verified" and v["testType"] == "full cell"
                                and (v["metric"], tuple(numbers(v["value"]))) not in known]
        notes.append(f"    added      from {other}: {len(new)} full cells")
    paper.update(paper_details([kept["paper"], *(r["paper"] for _, r, _ in checked_runs + cell_runs)], texts), kind=kept["kind"], battery=kept["battery"])
    store["papers"][pid] = paper
    for s in SECTIONS:
        store[s] += kept[s]
    missing = [f for f in ("title", "firstAuthor", "journal", "year", "doi") if not paper[f]]
    print(f"  kept {name}; paper details not found in the PDF: {', '.join(missing) or 'none'}")
    print("\n".join(notes))

# Cathodes, grouped across papers by the formula the papers give, else by Amplifi's short name, else its name.
# Each group is named by the short name Amplifi gives most often, else the formula, else the shortest name.
groups = collections.defaultdict(list)
for c in store["fullCells"]:
    group = ("f", formula_key(c["cathodeFormula"])) if c.get("cathodeFormula") else ("s", loose(key(c["cathodeShortName"]))) if c.get("cathodeShortName") else ("n", loose(key(c["cathode"])))
    groups[group].append(c)
for cells in groups.values():
    shorts = collections.Counter(c["cathodeShortName"] for c in cells if c.get("cathodeShortName") and c["status"] == "verified")
    formulas = collections.Counter(c["cathodeFormula"] for c in cells if c.get("cathodeFormula") and c["status"] == "verified")
    formula = formulas.most_common(1)[0][0] if formulas else None
    label = shorts.most_common(1)[0][0] if shorts else formula or min((c["cathode"] for c in cells), key=len)
    for c in cells:
        c["cathodeLabel"], c["cathodeLabelFormula"] = label, formula

store["extractedAt"] = datetime.datetime.fromtimestamp(newest).astimezone().isoformat(timespec="minutes") if newest else None
store["method"] = "Amplifi answered two structured questions about each paper, and each value shown was found on a page of its PDF."
totals = {status: sum(i["status"] == status for s in SECTIONS for i in store[s]) for status in ("verified", "quote only", "unverified")}
print("\nall papers: " + ", ".join(f"{n} {s}" for s, n in totals.items()))
args.out.parent.mkdir(parents=True, exist_ok=True)
args.out.write_text(json.dumps(store, indent=1, ensure_ascii=False), encoding="utf-8")
print(f"wrote {args.out}")
