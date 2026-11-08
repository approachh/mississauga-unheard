# Mississauga, Unheard

**ElevenLabs Track · Sheridan Datathon 2026** · team project. The web app is called **VOXELO**: *What you say. What AI hears.*

Which Mississauga residents are least likely to be understood by a voice-AI city line, how many of them are there, and where do they live?

We ran real speech from the datathon pack through **ElevenLabs Scribe**, measured the errors, and joined the results to the 2021 Census by ward.

## Key findings

**1. Accented English is not the problem. Language detection is.**
Out of 130 speakers reading the same English paragraph (12 first-language groups plus a Canadian English baseline), no group had a mean character error rate (CER) above 5%. The worst was Arabic-accented English at 4.6% CER.

**2. When Scribe has to guess the language, some communities lose.** These results are from FLEURS, the same sentences read aloud in each language.

| Language | Clips | CER, auto-detect | CER, language specified | What went wrong |
| --- | ---: | ---: | ---: | --- |
| Urdu | 40 | **24.0%** | 4.0% | 20% of clips were detected as Hindi and written in Devanagari |
| Cantonese | 40 | **23.4%** | 21.0% | 100% of clips were detected as generic Chinese; 65% came back in Simplified rather than Traditional characters (55% even with the language specified) |
| Punjabi | 40 | 8.9% | 7.2% | 5% of clips were detected as Hindi |
| Hindi | 40 | 4.6% | 4.7% | |
| Mandarin | 40 | 2.7% | 2.6% | |
| English (baseline) | 5 | 0.2% | 0.2% | |

Ignoring the script, Cantonese CER is only about 3%: Scribe hears the words but writes them in the wrong script. For Urdu, **specifying the language cuts the error six-fold**, from 24% to 4%. A 311 line that confirms the caller's language before transcribing would recover most of the gap.

**3. Where the gap lands: Unheard Index by ward.**
The index is a relative score. For each ward we take each language's share of residents who speak it at home and multiply it by that language's CER, then sum across languages. 100 is the highest ward under auto-detect.

| Rank | Ward | Index (auto) | 95% interval | Index (language specified) | Main drivers |
| ---: | ---: | ---: | --- | ---: | --- |
| 1 | 6 | 100 | 75–127 | 57 | Urdu, Cantonese, Punjabi |
| 2 | 5 | 92 | 64–127 | 60 | Punjabi, Urdu, Cantonese |
| 3 | 10 | 89 | 60–122 | 38 | Urdu, Cantonese, Arabic |
| 4 | 11 | 81 | 59–106 | 43 | Urdu, Cantonese, Punjabi |
| … | … | … | … | … | … |
| 11 | 1 | 12 | 9–16 | 9 | Cantonese, Urdu, Polish |

The intervals come from resampling the clips (bootstrap). Wards 6, 5, 10 and 11 overlap, so read them as a top group rather than a strict order. Specifying the language lowers every ward's score, and Ward 10's by more than half. The full method is in [frontend/scripts/build-unheard-index.mjs](frontend/scripts/build-unheard-index.mjs).

## Limits

- **Samples.** Every language has 40 FLEURS clips in auto-detect mode (560 clips in all). The comparison with the language specified is thinner: Urdu, Cantonese, Punjabi, Hindi and Mandarin have 40 clips in that mode; Tamil, Arabic, Vietnamese, Polish, Tagalog, Spanish, Portuguese, Gujarati and English have only 5. Bengali has no FLEURS audio in the pack.
- **Language effect or speaker effect?** FLEURS has only a few speakers per language. The Urdu, Punjabi and Arabic clips are all female; the Portuguese, Tagalog and Vietnamese clips are all male. We have not yet separated a language effect from a speaker effect.
- **Read speech is not a service request.** FLEURS and the accent archive are read aloud. Real 311 calls are spontaneous, noisy and recorded over the phone.
- **Dialects differ from Mississauga's communities.** FLEURS Portuguese is Brazilian, Spanish is Latin American and Arabic was recorded in Egypt.
- **The index is a priority ranking, not a head count.** Home-language counts can include the same person twice. 3% of residents speak a home language we did not test (Russian, Korean, Bengali, Malayalam and others); they are reported separately and left out of the score.
- **Census quirk.** Ward 10 is rebuilt from the neighbourhood table, because the City's raw ward table has wrong values for it.

## Repository

```
analysis/   Python pipeline: ElevenLabs Scribe transcription, WER/CER, bootstrap CIs, live 311 demo
  main.py           CLI: check / test / run / evaluate / examples / demo
  src/              transcription, normalization, evaluation, export, live_demo
  cache/            every API response, so re-runs never spend credits twice
  outputs/          speech_results.csv (per clip), speech_summary.csv (per language), showcase clips
frontend/   VOXELO web app (React + TypeScript + Vite), deployed on Vercel
  api/transcribe.ts serverless proxy to ElevenLabs Scribe (the API key never reaches the browser)
  scripts/          census conversion, speech conversion, Unheard Index builder
  public/data/      JSON the app reads
```

### Run the analysis

```powershell
cd analysis
python -m venv .venv; .venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env      # set ELEVENLABS_API_KEY and DATA_DIR (the unpacked datathon pack)
python main.py check        # no API calls
python main.py evaluate     # rebuild outputs/*.csv from the cache, no API calls
python main.py demo my_recording.wav   # live 311 prototype: Scribe -> language check -> reply in the caller's language via ElevenLabs TTS
```

See [analysis/README.md](analysis/README.md) for every command.

### Run the web app

```bash
cd frontend
npm install
cp .env.example .env.local  # set ELEVENLABS_API_KEY for live transcription
npm run dev                 # http://localhost:5173
```

To refresh the app's data from the analysis outputs:
`npm run data:speech:pull && npm run data:speech && npm run data:accents && npm run data:index`.
See [frontend/README.md](frontend/README.md) for details.

## Data and licences

The 2021 Census (City of Mississauga), FLEURS, the Speech Accent Archive, MInDS-14 and Speech-MASSIVE all come from the datathon pack. Some of these datasets are licensed for non-commercial use only. Raw datasets and full audio are not committed; only a handful of short showcase clips are.
