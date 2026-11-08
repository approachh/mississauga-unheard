"""Load datasets, pick clips, transcribe with caching (never pay twice for one clip)."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from .elevenlabs_client import transcribe_file
from .normalization import FORCED_CODE

load_dotenv()

ROOT = Path(__file__).resolve().parents[1]          # .../analysis
DATA_DIR = Path(os.getenv("DATA_DIR", ROOT.parent / "data" / "raw"))
CACHE_DIR = ROOT / "cache"

DATASETS = {
    "fleurs": "02_speech_home_languages_FLEURS",
    "accent": "03_accented_english_SpeechAccentArchive",
}


def load_metadata(dataset: str) -> pd.DataFrame:
    """Unified columns: dataset, file, audio_path, language, iso639_1, gender, duration_sec, reference, item_id"""
    folder = DATA_DIR / DATASETS[dataset]
    meta_path = folder / "metadata.csv"
    if not meta_path.exists():
        raise FileNotFoundError(f"Not found: {meta_path}\nSet DATA_DIR in analysis/.env to the folder with the dataset pack.")
    df = pd.read_csv(meta_path, encoding="utf-8-sig")
    df["dataset"] = dataset
    df["audio_path"] = df["file"].apply(lambda f: str(folder / f))

    if dataset == "fleurs":
        df["reference"] = df["transcription"]
        df["item_id"] = df["fleurs_id"]
        # iso639_1 already present (Cantonese = 'yue')
    else:  # accent: everyone speaks English, `language` = first language
        paragraph = (folder / "elicitation_paragraph.txt").read_text(encoding="utf-8-sig").strip()
        df["reference"] = paragraph
        df["iso639_1"] = "en"
        df["item_id"] = df["file"]
    cols = ["dataset", "file", "audio_path", "language", "iso639_1", "gender", "duration_sec", "reference", "item_id"]
    extra = [c for c in ["variety_note", "age", "english_onset_age", "length_of_english_residence_years",
                         "learning_style", "birth_country"] if c in df.columns]
    return df[cols + extra]


def select_clips(df: pd.DataFrame, languages: list[str] | None, per_language: int | None,
                 seed: int = 42) -> pd.DataFrame:
    if languages:
        wanted = {l.strip().lower() for l in languages}
        df = df[df["language"].str.lower().isin(wanted) |
                df["language"].str.lower().str.split().str[0].isin(wanted)]  # "mandarin" matches "Mandarin Chinese"
    if per_language:
        if df["dataset"].iloc[0] == "fleurs":
            # Same sentences in every language -> fair comparison
            ids = sorted(df["item_id"].unique())[:per_language]
            df = df[df["item_id"].isin(ids)]
        else:
            df = pd.concat([g.sample(min(len(g), per_language), random_state=seed)
                            for _, g in df.groupby("language")])
    return df.reset_index(drop=True)


def _cache_path(dataset: str, mode: str, file: str) -> Path:
    h = hashlib.sha1(file.encode()).hexdigest()[:16]
    return CACHE_DIR / dataset / mode / f"{h}.json"


def is_cached(dataset: str, mode: str, file: str) -> bool:
    p = _cache_path(dataset, mode, file)
    if not p.exists():
        return False
    return json.loads(p.read_text(encoding="utf-8")).get("error") is None


def run_transcriptions(clips: pd.DataFrame, mode: str, verbose: bool = True) -> pd.DataFrame:
    """mode='auto' -> Scribe detects the language (realistic 311 caller)
       mode='forced' -> we tell Scribe the language (best case)"""
    out = []
    for i, (_, row) in enumerate(clips.iterrows()):
        cp = _cache_path(row["dataset"], mode, row["file"])
        if is_cached(row["dataset"], mode, row["file"]):
            res = json.loads(cp.read_text(encoding="utf-8"))
            src = "cache"
        else:
            lang_code = FORCED_CODE.get(row["iso639_1"]) if mode == "forced" else None
            res = transcribe_file(row["audio_path"], language_code=lang_code)
            cp.parent.mkdir(parents=True, exist_ok=True)
            cp.write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
            src = "API"
        if verbose:
            status = "ERROR " + res["error"][:80] if res["error"] else (res["text"] or "")[:60]
            print(f"[{i + 1}/{len(clips)}] {src:5} {row['language']:<18} {status}")
        out.append({**row.to_dict(), "mode": mode, **{
            "prediction": res["text"], "detected_language": res["detected_language"],
            "language_probability": res["language_probability"], "error": res["error"]}})
    return pd.DataFrame(out)


def load_all_cached(dataset: str, mode: str) -> pd.DataFrame:
    """Rebuild results from everything already in the cache (no API calls)."""
    df = load_metadata(dataset)
    df = df[df["file"].apply(lambda f: is_cached(dataset, mode, f))]
    if df.empty:
        return df
    return run_transcriptions(df.reset_index(drop=True), mode, verbose=False)
