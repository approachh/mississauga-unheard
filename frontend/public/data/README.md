# Frontend data files

The app loads `<name>.json` first. If it does not exist it falls back to
`<name>.sample.json` and labels everything on screen as **sample data**.

| File | Producer | Shape |
| --- | --- | --- |
| `language_results.json` | Python/analysis | `[{ language, language_code, clips_tested, wer, cer }]` — `wer`/`cer` as fractions (0.12 = 12%) |
| `transcription_results.json` | Python/analysis | `[{ id, language, language_code, reference, hypothesis, wer?, cer? }]` |

Rows that fail validation are skipped and the UI reports how many.

The `*.sample.json` files contain **made-up placeholder values** purely for
layout. Delete them once real files are in place. Do not put audio or raw
datasets here.
