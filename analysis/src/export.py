"""Score transcriptions and write the team CSVs."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from .evaluation import score_row, summarize
from .normalization import chinese_variant, language_mismatch, latin_word_share, script_mismatch

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs"

# Contract agreed with the team (docs/csv_formats.md)
RESULT_COLUMNS = ["dataset", "file", "language", "iso639_1", "gender", "mode", "reference", "prediction",
                  "wer", "cer", "cer_script_neutral", "detected_language", "language_mismatch", "script_mismatch", "latin_word_share", "duration_sec"]


def score(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    scored = df.apply(lambda r: score_row(r["reference"], r["prediction"], r["iso639_1"])
                      if r["error"] is None or pd.isna(r["error"]) else (None,) * 5, axis=1)
    df[["wer", "cer", "cer_script_neutral", "reference_norm", "prediction_norm"]] = pd.DataFrame(scored.tolist(), index=df.index)
    df["language_mismatch"] = df.apply(lambda r: language_mismatch(r["iso639_1"], r["detected_language"]), axis=1)
    df["script_mismatch"] = df.apply(lambda r: script_mismatch(r["iso639_1"], r["prediction"]), axis=1)
    df["latin_word_share"] = df.apply(lambda r: latin_word_share(r["prediction"], r["iso639_1"]), axis=1)
    df["chinese_variant"] = df.apply(lambda r: chinese_variant(r["prediction"])
                                     if r["iso639_1"] in ("zh", "yue") else None, axis=1)
    return df


def export(scored: pd.DataFrame) -> tuple[Path, Path, Path]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results_path = OUT_DIR / "speech_results.csv"
    detailed_path = OUT_DIR / "speech_results_detailed.csv"
    summary_path = OUT_DIR / "speech_summary.csv"

    scored[RESULT_COLUMNS].to_csv(results_path, index=False, encoding="utf-8-sig")
    scored.to_csv(detailed_path, index=False, encoding="utf-8-sig")
    summarize(scored).round(4).to_csv(summary_path, index=False, encoding="utf-8-sig")
    return results_path, detailed_path, summary_path
