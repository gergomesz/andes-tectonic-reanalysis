"""
Independent re-analysis of the mountain-front data published in
Daxberger (2013, PhD thesis, McMaster University), Table 4.1, and
Daxberger & Riller (2015, Geomorphology 248, 57-76).

Inputs  : data/mountain_fronts.csv, data/t_factor_by_province.json
Outputs : analysis/results.json   (every number quoted on the website)
          assets/data.js          (the same data, embedded for the static site)

Run:  python scripts/reanalysis.py
Needs: pandas, numpy, scipy
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

ONSET_RANK = {
    "Holocene": 0,
    "Pleisto-Holocene": 1, "Pleist-Holocene": 1, "Quaternary": 1,
    "Plio-Holocene": 2, "Plio-Pleistocene": 2, "Pliocene": 2,
    "Mio-Holocene": 3, "Mio-Pliocene": 3, "Miocene": 3,
    "Oligocene": 4,
    "Eocene": 5,
}
ONSET_LABEL = ["Holocene", "Pleistocene", "Pliocene", "Miocene", "Oligocene", "Eocene"]
STILL_ACTIVE = ("Holocene", "Quaternary")  # reported activity reaches the Quaternary/Holocene

# Thesis class thresholds (Daxberger 2013, p. 156)
CLASS_EDGES = {"class1_max": 1.65, "class2_max": 2.50}


def r(x, n=3):
    return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), n)


def spearman(x, y):
    res = stats.spearmanr(x, y)
    return {"rho": r(res.statistic), "p": float(f"{res.pvalue:.3g}"), "n": int(len(x))}


def main() -> None:
    fronts = pd.read_csv(DATA / "mountain_fronts.csv")
    tfac = json.loads((DATA / "t_factor_by_province.json").read_text())

    assert len(fronts) == 189, "expected 189 mountain-front segments"
    out: dict = {}

    # ---- 1. Basic description -------------------------------------------------
    out["n_fronts"] = int(len(fronts))
    out["n_basins_table41"] = int(fronts.n_basins.sum())
    out["smf_by_province"] = {
        p: {"n": int(len(g)), "min": r(g.smf.min(), 2), "median": r(g.smf.median(), 2), "max": r(g.smf.max(), 2)}
        for p, g in fronts.groupby("province")
    }
    out["class_counts_table41"] = {
        p: {str(k): int(v) for k, v in g["class"].value_counts().sort_index().items()}
        for p, g in fronts.groupby("province")
    }
    out["class_counts_table42_reported"] = {
        "Puna Plateau": {"1": 51, "2": 20, "3": 5},
        "Eastern Cordillera": {"1": 62, "2": 17, "3": 0},
        "Pampean Ranges": {"1": 13, "2": 10, "3": 7},
    }

    # ---- 2. Smf as a fault-age proxy (the paper's central claim) ---------------
    dated = fronts.dropna(subset=["age"]).copy()
    dated["onset"] = dated.age.map(ONSET_RANK)
    assert dated.onset.notna().all(), set(dated.age) - set(ONSET_RANK)
    active = dated.age.str.contains("|".join(STILL_ACTIVE))
    mw = stats.mannwhitneyu(dated.smf[active], dated.smf[~active], alternative="less")
    out["smf_vs_age"] = {
        "n_dated": int(len(dated)),
        "all": spearman(dated.onset, dated.smf),
        "kendall_tau": r(stats.kendalltau(dated.onset, dated.smf).statistic),
        "by_province": {p: spearman(g.onset, g.smf) for p, g in dated.groupby("province")},
        "still_active_median_smf": r(dated.smf[active].median(), 2),
        "still_active_n": int(active.sum()),
        "ended_earlier_median_smf": r(dated.smf[~active].median(), 2),
        "ended_earlier_n": int((~active).sum()),
        "mannwhitney_one_sided_p": float(f"{mw.pvalue:.3g}"),
        "by_onset": [
            {"onset": ONSET_LABEL[k], "n": int(len(g)), "median": r(g.smf.median(), 2)}
            for k, g in dated.groupby("onset")
        ],
    }

    out["vf_vs_smf"] = {
        "all": spearman(fronts.smf, fronts.vf_median),
        "by_province": {p: spearman(g.smf, g.vf_median) for p, g in fronts.groupby("province")},
        "vf_median_by_class": {str(k): r(g.vf_median.median(), 2) for k, g in fronts.groupby("class")},
        "vf_vs_onset": spearman(dated.onset, dated.vf_median),
    }
    t_out = {}
    for p, d in tfac.items():
        if p.startswith("_"):
            continue
        bins = np.array(d["azimuth_bins_10deg"])
        north = int(bins[27:].sum() + bins[:9].sum())   # 270-90 deg
        south = int(bins[9:27].sum())                    # 90-270 deg
        binom = stats.binomtest(north, north + south, 0.5)
        t_out[p] = {
            "n": d["n"],
            "north_half": north,
            "south_half": south,
            "north_share": r(north / (north + south)),
            "binomial_p": float(f"{binom.pvalue:.3g}"),
            "mean_vector_T": d["mean_vector_T"],
            "reported_mean_T_thesis": d["reported_mean_T_thesis"],
            "unit_Rbar": d["unit_Rbar"],
            "mean_R": d["mean_R"],
        }
    out["t_factor"] = t_out

    qs = []
    for _, row in fronts[fronts.smf < 1].iterrows():
        qs.append(f"Segment {row.segment_id} in the {row.province} has an Smf of {row.smf:.2f}. "
                  "How can Smf be below 1 for this segment?")
    t = {k: v for k, v in tfac.items() if not k.startswith("_")}
    qs.append("The thesis reports province-average T values of "
              + ", ".join(f"{t[p]['reported_mean_T_thesis']:.2f}" for p in t)
              + "; the vector mean of the tabulated per-basin values gives "
              + ", ".join(f"{t[p]['mean_vector_T']:.3f}" for p in t)
              + ". How were the province averages calculated?")
    rho = out["vf_vs_smf"]["all"]["rho"]
    qs.append(f"Across all 189 fronts, median Vf falls as Smf rises (ρ = {'−' if rho < 0 else ''}{abs(rho):.2f}), "
              "the opposite of the Bull and McFadden expectation. What do you think explains this?")
    qs.append("How did you choose the topic for your PhD, and how would you advise a student "
              "to choose a topic for a master's or PhD?")
    out["questions_for_author"] = [{"question": q, "answer": ""} for q in qs]

    (ROOT / "analysis").mkdir(exist_ok=True)
    (ROOT / "analysis" / "results.json").write_text(json.dumps(out, indent=2))

    keep = ["province", "segment_id", "fault_type", "age", "trend_deg", "smf", "n_basins", "vf_median", "class"]
    rows = fronts[keep].copy()
    rows["age"] = rows.age.fillna("")
    rows["onset"] = rows.age.map(ONSET_RANK)
    rows["onset"] = rows.onset.where(rows.onset.notna(), None)
    payload = {
        "fronts": rows.to_dict(orient="records"),
        "tfactor": {k: v for k, v in tfac.items() if not k.startswith("_")},
        "results": out,
        "onsetLabels": ONSET_LABEL,
        "classEdges": CLASS_EDGES,
    }
    js = "// Generated by scripts/reanalysis.py - do not edit by hand.\nwindow.DATA = " + json.dumps(payload, separators=(",", ":")) + ";\n"
    (ROOT / "assets" / "data.js").write_text(js)
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
