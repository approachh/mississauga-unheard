# Speech evaluation (Member 1)

Measures how well ElevenLabs Scribe understands Mississauga's home languages (FLEURS)
and accented English (Speech Accent Archive).

## Setup (Windows PowerShell, inside `analysis/`)
    python -m venv .venv
    .venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    copy .env.example .env      # then put your API key and DATA_DIR in .env

## Commands
    python main.py check                      # no API calls
    python main.py test                       # 1 English clip
    python main.py test --language Urdu
    python main.py run --dataset fleurs --mode auto --per-language 5
    python main.py run --dataset fleurs --mode forced --per-language 5 --languages urdu,punjabi
    python main.py run --dataset accent --per-language 10
    python main.py evaluate                   # rebuild CSVs from cache, no API calls

Every API result is cached in `cache/`, so re-running never spends credits twice.

## Modes
- `auto`: Scribe detects the language (what a real 311 line faces)
- `forced`: we tell Scribe the language (best case)

## Outputs (`outputs/`)
- `speech_results.csv` — one row per clip (team contract)
- `speech_results_detailed.csv` — plus normalized text, detection confidence, speaker details
- `speech_summary.csv` — per dataset x mode x language: mean/median WER & CER, 95% bootstrap CI,
  % wrong language detected, % wrong script (e.g. Urdu written in Devanagari = transcribed as Hindi)

## Notes
- Chinese/Cantonese: CER only (no word boundaries), WER = NaN
- FLEURS: same sentences across languages are used when sampling (fair comparison)
- FLEURS has few speakers per language, some single-gender: check `genders` column before claiming a language effect
