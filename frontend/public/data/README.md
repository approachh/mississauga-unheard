# Published data files

Everything in this folder is served publicly with the site.

| File | Producer | Shape |
| --- | --- | --- |
| `language_results.json` | Python/analysis | `[{ language, language_code, clips_tested, wer, cer }]` (`wer`/`cer` as fractions) |
| `transcription_results.json` | Python/analysis | `[{ id, language, language_code, reference, hypothesis, wer?, cer? }]` |
| `census_citywide_languages.json` | `npm run data:census` | validated citywide home-language ranking |
| `census_ward_languages.json` | `npm run data:census` | ward profile: populations and home speakers per language |
| `speech_dataset_coverage.json` | `npm run data:census` | per-language counts in FLEURS, Speech Accent Archive, MINDS-14, Speech-MASSIVE |
| `census_checks.json` | `npm run data:census` | results of the cross-file consistency checks |

If `language_results.json` / `transcription_results.json` are missing, the app falls back to the
`*.sample.json` placeholders and labels every figure as **sample data**.

Census source CSVs are **not** kept here. They live in `frontend/data/census/` (not deployed);
older releases are in `frontend/data/census/archive/`. Rows that fail validation are skipped and
the UI reports how many. Do not put audio or raw datasets in this folder.
