"""WER / CER and per-language summaries with bootstrap confidence intervals.

Edit distance is implemented here, so no extra dependency (jiwer) is needed.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .normalization import NO_WORD_BOUNDARY, normalize


def _edit_distance(ref: list, hyp: list) -> int:
    prev = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        cur = [i] + [0] * len(hyp)
        for j, h in enumerate(hyp, 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r != h))
        prev = cur
    return prev[-1]


def wer(ref: str, hyp: str) -> float:
    r, h = ref.split(), hyp.split()
    if not r:
        return np.nan
    return _edit_distance(r, h) / len(r)


def cer(ref: str, hyp: str) -> float:
    r, h = ref.replace(" ", ""), hyp.replace(" ", "")
    if not r:
        return np.nan
    return _edit_distance(list(r), list(h)) / len(r)


def score_row(reference: str, prediction: str | None, iso: str) -> tuple[float, float, str, str]:
    ref_n = normalize(reference, iso)
    hyp_n = normalize(prediction, iso)
    w = np.nan if iso in NO_WORD_BOUNDARY else wer(ref_n, hyp_n)
    return w, cer(ref_n, hyp_n), ref_n, hyp_n


def bootstrap_ci(values, n_boot: int = 2000, seed: int = 0) -> tuple[float, float]:
    v = pd.Series(values).dropna().to_numpy()
    if len(v) < 2:
        return (np.nan, np.nan)
    rng = np.random.default_rng(seed)
    means = rng.choice(v, size=(n_boot, len(v)), replace=True).mean(axis=1)
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def summarize(results: pd.DataFrame) -> pd.DataFrame:
    """One row per dataset x mode x language."""
    rows = []
    for (ds, mode, lang), g in results.groupby(["dataset", "mode", "language"]):
        ok = g[g["error"].isna()] if "error" in g else g
        cer_lo, cer_hi = bootstrap_ci(ok["cer"])
        wer_lo, wer_hi = bootstrap_ci(ok["wer"])
        rows.append({
            "dataset": ds, "mode": mode, "language": lang,
            "n_clips": len(ok), "n_errors": len(g) - len(ok),
            "genders": "/".join(sorted(ok["gender"].dropna().astype(str).unique())),
            "mean_wer": ok["wer"].mean(), "wer_ci_low": wer_lo, "wer_ci_high": wer_hi,
            "median_wer": ok["wer"].median(),
            "mean_cer": ok["cer"].mean(), "cer_ci_low": cer_lo, "cer_ci_high": cer_hi,
            "median_cer": ok["cer"].median(),
            "pct_language_mismatch": 100 * ok["language_mismatch"].astype(float).mean(),
            "pct_script_mismatch": 100 * ok["script_mismatch"].astype(float).mean(),
            "audio_minutes": ok["duration_sec"].sum() / 60,
        })
    return pd.DataFrame(rows).sort_values(["dataset", "mode", "mean_cer"], ascending=[True, True, False])
