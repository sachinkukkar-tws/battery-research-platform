"""Ask Amplifi, through the BRP proxy, one structured question per paper, and save each answer.

python scripts/explorer/extract.py <pdf_dir> <out_dir> CP01 CP02 ... [--question question-fullcells.txt]

Needs the proxy running with structured answers on (npm run amplifi:proxy, with AMPLIFI_WORKSPACE_ID and
AMPLIFI_AGENT_ID set). The question template is question.txt in this folder unless --question names another;
{pid} is the paper ID and {file} its file name in <pdf_dir>, which helps the agent find the right file.
Two papers are asked at a time. A failed call is tried twice more: a long paper can pass nginx's 60-second limit.
Each answer is saved as <out_dir>/<paper>.json; build_data.py then checks them against the PDFs.
"""
import argparse
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent
sys.stdout.reconfigure(encoding="utf-8")

parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
parser.add_argument("pdf_dir", type=pathlib.Path)
parser.add_argument("out_dir", type=pathlib.Path)
parser.add_argument("papers", nargs="+")
parser.add_argument("--question", type=pathlib.Path, default=HERE / "question.txt")
parser.add_argument("--proxy", default=os.environ.get("BRP_PROXY_URL", "http://localhost:8787"))
args = parser.parse_args()

schema = json.loads((HERE / "paper-schema.json").read_text(encoding="utf-8"))
question = args.question.read_text(encoding="utf-8").strip()
files = {p.name.split("_")[0]: p.name for p in args.pdf_dir.glob("*.pdf")}
args.out_dir.mkdir(parents=True, exist_ok=True)


def ask(pid: str) -> str:
    body = json.dumps({"question": question.format(pid=pid, file=files[pid]), "schema": schema}).encode("utf-8")
    for attempt in (1, 2, 3):
        start = time.time()
        req = urllib.request.Request(f"{args.proxy}/amplifi/structured", data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=170) as res:
                (args.out_dir / f"{pid}.json").write_text(res.read().decode("utf-8"), encoding="utf-8")
            return f"{pid}: answered in {time.time() - start:.0f} s"
        except urllib.error.HTTPError as e:
            error = f"HTTP {e.code}: {e.read().decode('utf-8')[:300]}"
        except OSError as e:
            error = repr(e)[:300]
        print(f"{pid}: try {attempt} failed after {time.time() - start:.0f} s: {error}", flush=True)
    return f"{pid}: FAILED"


started = time.time()
with ThreadPoolExecutor(max_workers=2) as pool:
    for line in pool.map(ask, args.papers):
        print(line, flush=True)
print(f"done in {time.time() - started:.0f} s")
