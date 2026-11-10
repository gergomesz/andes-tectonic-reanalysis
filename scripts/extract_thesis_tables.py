"""
Rebuild the datasets in /data from Heidi Daxberger's open-access PhD thesis.

    Daxberger, H. (2013). Tectonomorphologic and kinematic characterization of
    Neogene deformation in the southern Central Andes (23-28 S, NW Argentina).
    PhD thesis, McMaster University. http://hdl.handle.net/11375/13458

Usage:
    1. Download the thesis PDF from the handle above (open access, ~23 MB).
    2. python scripts/extract_thesis_tables.py path/to/thesis.pdf

Writes:
    data/mountain_fronts.csv      Table 4.1  (189 mountain-front segments)
    data/basins.csv               Table 4.A1 (one row per second-order basin)
    data/t_factor_by_province.json  summaries used by the website

Parsing rules (identical to the ones used to build the shipped CSVs):
  * Table 4.1 is on PDF pages 191-194. Hyphenated epoch names that wrap
    ("Mio-\\nPliocene") are re-joined, numbers that wrap ("128.0\\n6") are re-joined,
    and each row is matched with one regular expression.
  * Table 4.A1 is on PDF pages 204-229, laid out in two columns. Every text line
    holds 6 or 12 numbers (segment, Vf median, T azimuth, R, Curry probability %,
    domain), which are cut into rows of six.
  * Validation: 189 fronts; every front's basin count in 4.A1 equals its N in 4.1.

Needs: pypdf (pip install pypdf)
"""
from __future__ import annotations

import csv
import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

ROW_41 = re.compile(
    r"^(\d+) (\d) (?:([A-Za-z-]+) )?([\d, ]+?) (\d{1,3}) (\d\.\d\d) (\d+) ([\d.]+) ([\d.]+) ([\d.]+) ([123]) (\d+)$"
)
HEADER = re.compile(r"Ph\.D\. Thesis[^\n]*\n\s*\d+\s*\n")


def page_texts(pdf: Path) -> list[str]:
    reader = PdfReader(str(pdf))
    return [p.extract_text() or "" for p in reader.pages]


def parse_table41(pages: list[str]) -> list[dict]:
    t = re.sub(r"[ \t]+", " ", "\n".join(pages[190:194]))
    t = t[re.search(r"Puna\s*\n?\s*Plateau 1 1", t).start():]
    t = HEADER.sub("\n", t)
    t = re.sub(r"Puna\s*\n?\s*Plateau\s*", "#Puna Plateau\n", t, count=1)
    t = re.sub(r"Eastern\s*\n\s*Cordillera\s*", "#Eastern Cordillera\n", t, count=1)
    t = re.sub(r"Pampean\s*\n\s*Ranges\s*", "#Pampean Ranges\n", t, count=1)
    t = re.sub(r"-\s*\n\s*", "-", t)
    t = re.sub(r"(\d+\.\d)\s*\n\s*(\d)\s+(\d)\s+(\d+)", r"\1\2 \3 \4", t)
    rows, prov = [], ""
    for line in (l.strip() for l in t.split("\n")):
        if not line:
            continue
        if line.startswith("#"):
            prov = line[1:]
            continue
        m = ROW_41.match(line)
        if m:
            g = m.groups()
            rows.append(dict(province=prov, segment_id=int(g[0]), fault_type=int(g[1]), age=g[2] or "",
                             sources=re.sub(r"\s", "", g[3]).replace(",", ";"), trend_deg=int(g[4]), smf=g[5],
                             n_basins=int(g[6]), vf_median=g[7], vf_min=g[8], vf_max=g[9], **{"class": int(g[10])},
                             domain_id=int(g[11])))
        elif line.startswith("164 5 inferred"):
            # the one row whose source column reads "inferred" and that has no age
            v = line.split()
            rows.append(dict(province=prov, segment_id=164, fault_type=5, age="", sources="inferred", trend_deg=int(v[3]),
                             smf=v[4], n_basins=int(v[5]), vf_median=v[6], vf_min=v[7], vf_max=v[8],
                             **{"class": int(v[9])}, domain_id=int(v[10])))
    order = {"Puna Plateau": 0, "Eastern Cordillera": 1, "Pampean Ranges": 2}
    rows.sort(key=lambda r: (order[r["province"]], r["segment_id"]))
    assert len(rows) == 189, f"expected 189 fronts, parsed {len(rows)}"
    return rows


def parse_table4a1(pages: list[str]) -> list[list[float]]:
    rows = []
    for i in range(203, 229):
        t = HEADER.sub("", re.sub(r"[ \t]+", " ", pages[i]), count=1)
        for line in t.split("\n"):
            toks = [x for x in line.strip().split(" ") if re.fullmatch(r"-?\d+(\.\d+)?", x)]
            if not toks:
                continue
            assert len(toks) % 6 == 0, f"page {i + 1}: unexpected line {line!r}"
            rows += [[float(x) for x in toks[k:k + 6]] for k in range(0, len(toks), 6)]
    return rows


def summarise(fronts: list[dict], basins: list[list[float]]) -> dict:
    prov_of = {r["segment_id"]: r["province"] for r in fronts}
    out = {}
    for p in ["Puna Plateau", "Eastern Cordillera", "Pampean Ranges"]:
        rs = [b for b in basins if prov_of[int(b[0])] == p]
        n = len(rs)
        cx = sum(b[3] * math.sin(math.radians(b[2])) for b in rs)
        cy = sum(b[3] * math.cos(math.radians(b[2])) for b in rs)
        ux = sum(math.sin(math.radians(b[2])) for b in rs)
        uy = sum(math.cos(math.radians(b[2])) for b in rs)
        rbar = math.hypot(ux, uy) / n
        bins = [0] * 36
        rh = [0] * 10
        for b in rs:
            bins[min(35, int((b[2] % 360) // 10))] += 1
            rh[min(9, int(b[3] * 10))] += 1
        vf = sorted(b[1] for b in rs)
        out[p] = {
            "n": n,
            "azimuth_bins_10deg": bins,
            "R_bins_0.1": rh,
            "mean_vector_T": round(math.hypot(cx, cy) / n, 3),
            "mean_vector_azimuth": round((math.degrees(math.atan2(cx, cy)) + 360) % 360),
            "unit_Rbar": round(rbar, 3),
            "rayleigh_p": float(f"{math.exp(math.sqrt(1 + 4 * n + 4 * (n * n - (n * rbar) ** 2)) - (1 + 2 * n)):.3g}"),
            "mean_R": round(sum(b[3] for b in rs) / n, 3),
            "frac_curry_p_lt_5pct": round(sum(b[4] < 5 for b in rs) / n, 3),
            "vf_quartiles": [vf[n // 4], vf[n // 2], vf[3 * n // 4]],
            "vf_classes": [sum(v <= 0.5 for v in vf), sum(0.5 < v <= 1.7 for v in vf), sum(v > 1.7 for v in vf)],
        }
    out["Puna Plateau"]["reported_mean_T_thesis"] = 0.04
    out["Eastern Cordillera"]["reported_mean_T_thesis"] = 0.03
    out["Pampean Ranges"]["reported_mean_T_thesis"] = 0.01
    return out


def main(pdf: Path) -> None:
    pages = page_texts(pdf)
    fronts = parse_table41(pages)
    basins = parse_table4a1(pages)

    n_expected = {r["segment_id"]: r["n_basins"] for r in fronts}
    n_found = Counter(int(b[0]) for b in basins)
    bad = {k: (v, n_found.get(k, 0)) for k, v in n_expected.items() if n_found.get(k, 0) != v}
    assert not bad, f"basin counts differ from Table 4.1 N: {bad}"
    print(f"OK: {len(fronts)} fronts, {len(basins)} basins, all counts match Table 4.1")

    DATA.mkdir(exist_ok=True)
    cols = ["province", "segment_id", "fault_type", "age", "sources", "trend_deg", "smf", "n_basins",
            "vf_median", "vf_min", "vf_max", "class", "domain_id"]
    with open(DATA / "mountain_fronts.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(fronts)
    prov_of = {r["segment_id"]: r["province"] for r in fronts}
    with open(DATA / "basins.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["province", "segment_id", "vf_median", "t_azimuth_deg", "t_R", "curry_probability_pct", "domain_id"])
        for b in basins:
            w.writerow([prov_of[int(b[0])], int(b[0]), b[1], int(b[2]), b[3], b[4], int(b[5])])
    summary = summarise(fronts, basins)
    old = json.loads((DATA / "t_factor_by_province.json").read_text()) if (DATA / "t_factor_by_province.json").exists() else {}
    summary = {**{k: v for k, v in old.items() if k.startswith("_")}, **summary}
    (DATA / "t_factor_by_province.json").write_text(json.dumps(summary, indent=2))
    print("Wrote data/mountain_fronts.csv, data/basins.csv, data/t_factor_by_province.json")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
