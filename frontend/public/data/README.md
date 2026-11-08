# Published data files

Everything in this folder is served publicly with the site.

| File | Producer | Shape |
| --- | --- | --- |
| `language_results.json` | Python/analysis | `[{ language, language_code, clips_tested, wer, cer }]` (`wer`/`cer` as fractions) |
| `transcription_results.json` | Python/analysis | `[{ id, language, language_code, reference, hypothesis, wer?, cer? }]` |
| `census_citywide_languages.json` | `npm run data:census` | validated citywide home-language ranking |
| `census_ward_languages.json` | `npm run data:census` | ward profile: populations and home speakers per language |
| `speech_dataset_coverage.json` | `npm run data:census` | per-language counts in FLEURS, Speech Accent Archive, MINDS-14, Speech-MASSIVE |
| `census_official_language.json` | `npm run data:census` | residents who cannot conduct a conversation in English or French, per ward (2021 census, counts rounded to 5). Source: `data/census/official_language_knowledge_2021.csv`; the converter checks the denominator against the ward profile and the city total (24,305) and Ward 10 against the neighbourhood table |
| `census_checks.json` | `npm run data:census` | results of the cross-file consistency checks |
| `accent_results.json` | `npm run data:accents` | accented English (Speech Accent Archive): per-group scores, every speaker's WER as an unlabelled list, and two example transcripts per group. No speaker metadata, no audio |
| `unheard_index.json` | `npm run data:index` | Unheard Index per ward (both recognition modes), per-language CER, untested-language coverage, plus an experimental view weighted by residents with no English or French; method in `scripts/build-unheard-index.mjs` |
| `routing/*.csv` | `ElevenLabsTrack/src/routing/outputs/` | Static snapshot for the Routing page: per-language metrics, coverage, misroutes, confusion pairs, held-out cases, unscored examples, and Toronto 311 context |

If `language_results.json` / `transcription_results.json` are missing, the app falls back to the
`*.sample.json` placeholders and labels every figure as **sample data**.

Census source CSVs are **not** kept here. They live in `frontend/data/census/` (not deployed);
older releases are in `frontend/data/census/archive/`. Rows that fail validation are skipped and
the UI reports how many. Do not put audio or raw datasets in this folder.

To refresh the speech results and the index from the analysis branch:
`npm run data:speech:pull && npm run data:speech && npm run data:accents && npm run data:index`

The Routing page reads the CSV snapshot in `routing/` directly. After rerunning
`ElevenLabsTrack/src/routing/analyze_routing.py`, copy the refreshed
`routing_metrics.csv`, `routing_language_coverage.csv`, `routing_confusion.csv`,
`routing_misroutes.csv`, `routing_test_results.csv`, `routing_unscored_examples.csv`,
`toronto_311_request_types.csv`, and `toronto_311_divisions.csv` into this folder
to publish the new evaluation.

The speech CSVs hold two datasets: FLEURS (language recognition, feeds `language_results.json`, `transcription_results.json` and the Unheard Index) and the Speech Accent Archive
(feeds `accent_results.json` only). Each script keeps to its own dataset, so accent recordings never count as language-recognition results.
(`data:speech:pull` copies `analysis/outputs/*.csv` from `origin/feature/speech-evaluation` into
`frontend/data/speech/` and records the commit in `source.json`; nothing is checked out.)
