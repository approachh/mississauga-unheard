"""Speech evaluation pipeline — Mississauga, Unheard.

Usage (run from the analysis/ folder):
  python main.py check                                   # no API calls: checks key, data, clip counts
  python main.py test                                    # 1 English clip -> confirms the API works
  python main.py test --language Urdu                    # 1 clip in another language
  python main.py run --dataset fleurs --mode auto --per-language 5
  python main.py run --dataset fleurs --mode forced --per-language 5 --languages urdu,punjabi
  python main.py run --dataset accent --mode auto --per-language 10
  python main.py evaluate                                # score everything in the cache -> outputs/*.csv
"""
from __future__ import annotations

import argparse
import os
import sys

import pandas as pd

from src.export import export, score
from src.transcription import (DATA_DIR, is_cached, load_all_cached, load_metadata,
                               run_transcriptions, select_clips)

# Windows console: allow Urdu/Chinese/Tamil output
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except AttributeError:
    pass


def cmd_check(_):
    key = os.getenv("ELEVENLABS_API_KEY", "")
    print("API key:", "OK" if key and key != "your_key_here" else "MISSING (edit analysis/.env)")
    print("DATA_DIR:", DATA_DIR)
    for ds in ["fleurs", "accent"]:
        try:
            df = load_metadata(ds)
        except FileNotFoundError as e:
            print(f"\n[{ds}] {e}")
            continue
        missing = (~df["audio_path"].apply(os.path.exists)).sum()
        print(f"\n[{ds}] {len(df)} clips, {df['duration_sec'].sum() / 60:.1f} min of audio, "
              f"{missing} audio files missing")
        print(df.groupby("language").agg(clips=("file", "size"),
                                         minutes=("duration_sec", lambda s: round(s.sum() / 60, 1)),
                                         genders=("gender", lambda s: "/".join(sorted(s.dropna().astype(str).unique()))))
              .to_string())


def cmd_test(args):
    df = load_metadata("fleurs")
    df = df[df["language"].str.lower().str.startswith(args.language.lower())]
    if df.empty:
        sys.exit(f"No FLEURS clips for language '{args.language}'")
    clip = df.head(1)
    res = score(run_transcriptions(clip, args.mode)).iloc[0]
    print("\nReference :", res["reference_norm"])
    print("Prediction:", res["prediction_norm"])
    print(f"Detected  : {res['detected_language']} (p={res['language_probability']})")
    print(f"WER={res['wer']}  CER={res['cer']:.3f}  language_mismatch={res['language_mismatch']}  "
          f"script_mismatch={res['script_mismatch']}")
    if res["error"]:
        print("ERROR:", res["error"])


def cmd_run(args):
    langs = args.languages.split(",") if args.languages else None
    clips = select_clips(load_metadata(args.dataset), langs, args.per_language)
    todo = clips[~clips["file"].apply(lambda f: is_cached(args.dataset, args.mode, f))]
    print(f"{len(clips)} clips selected, {len(clips) - len(todo)} already cached, "
          f"{len(todo)} to send = {todo['duration_sec'].sum() / 60:.1f} min of audio")
    print(clips.groupby("language").size().to_string())
    if len(todo) and not args.yes:
        if input("Spend credits on these? [y/N] ").strip().lower() != "y":
            sys.exit("Cancelled.")
    results = run_transcriptions(clips, args.mode)
    n_err = results["error"].notna().sum()
    print(f"\nDone. {n_err} errors." + (" Re-run the same command to retry them." if n_err else ""))
    cmd_evaluate(args)


def cmd_evaluate(_):
    frames = [load_all_cached(ds, mode) for ds in ["fleurs", "accent"] for mode in ["auto", "forced"]]
    frames = [f for f in frames if not f.empty]
    if not frames:
        sys.exit("Cache is empty. Run `python main.py run ...` first.")
    scored = score(pd.concat(frames, ignore_index=True))
    paths = export(scored)
    from src.evaluation import summarize
    cols = ["dataset", "mode", "language", "n_clips", "genders", "mean_wer", "mean_cer",
            "cer_ci_low", "cer_ci_high", "pct_language_mismatch", "pct_script_mismatch"]
    print("\n", summarize(scored)[cols].round(3).to_string(index=False))
    print("\nSaved:", *[str(p) for p in paths], sep="\n  ")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check")
    t = sub.add_parser("test")
    t.add_argument("--language", default="English")
    t.add_argument("--mode", choices=["auto", "forced"], default="auto")
    r = sub.add_parser("run")
    r.add_argument("--dataset", choices=["fleurs", "accent"], default="fleurs")
    r.add_argument("--mode", choices=["auto", "forced"], default="auto")
    r.add_argument("--per-language", type=int, default=5)
    r.add_argument("--languages", help="comma-separated, e.g. urdu,punjabi,arabic")
    r.add_argument("--yes", action="store_true", help="don't ask for confirmation")
    sub.add_parser("evaluate")
    args = p.parse_args()
    {"check": cmd_check, "test": cmd_test, "run": cmd_run, "evaluate": cmd_evaluate}[args.cmd](args)


if __name__ == "__main__":
    main()
